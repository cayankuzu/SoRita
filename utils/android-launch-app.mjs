import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import net from 'node:net';

import {
  ANDROID_APP_ID as PACKAGE_NAME,
  EXPECTED_EXPO_PROJECT_SLUG,
  METRO_PORT,
  readExpoProjectSlug,
} from './android-dev-config.mjs';

const DEVICE_METRO_PORT = METRO_PORT;
const REVERSED_PORTS = [DEVICE_METRO_PORT];
const LEGACY_METRO_PORTS = [8081];
const WAIT_TIMEOUT_MS = 120000;
const POLL_INTERVAL_MS = 1000;

function resolveAdbPath() {
  const explicitCandidates = [
    process.env.ADB_PATH,
    process.env.ANDROID_HOME ? join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe') : null,
    process.env.ANDROID_HOME ? join(process.env.ANDROID_HOME, 'platform-tools', 'adb') : null,
    process.env.ANDROID_SDK_ROOT ? join(process.env.ANDROID_SDK_ROOT, 'platform-tools', 'adb.exe') : null,
    process.env.ANDROID_SDK_ROOT ? join(process.env.ANDROID_SDK_ROOT, 'platform-tools', 'adb') : null,
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe') : null,
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb') : null,
  ].filter(Boolean);

  for (const candidate of explicitCandidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  return 'adb';
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, '127.0.0.1');
  });
}

async function waitForMetroProject() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < WAIT_TIMEOUT_MS) {
    if (await canConnect(METRO_PORT)) {
      const actualProject = await readExpoProjectSlug(METRO_PORT);

      if (actualProject === EXPECTED_EXPO_PROJECT_SLUG) {
        console.log(
          `[SoRita][android] Metro hazir: ${METRO_PORT} (${actualProject})`,
        );
        return;
      }

      if (actualProject) {
        throw new Error(
          `Metro proje kimligi uyusmuyor: ${actualProject}. Beklenen: ${EXPECTED_EXPO_PROJECT_SLUG}.`,
        );
      }
    }

    await wait(POLL_INTERVAL_MS);
  }

  throw new Error(`SoRita Metro zamaninda hazir olmadi (${METRO_PORT}).`);
}

function runAdb(adbPath, adbArgs, deviceSerial) {
  const args = deviceSerial ? ['-s', deviceSerial, ...adbArgs] : adbArgs;

  return spawnSync(adbPath, args, {
    encoding: 'utf8',
    shell: false,
  });
}

function listOnlineDevices(adbPath) {
  const devices = runAdb(adbPath, ['devices']);
  const lines = (devices.stdout ?? '').split(/\r?\n/).filter(Boolean);
  return lines
    .filter((line) => /\tdevice$/.test(line))
    .map((line) => line.split('\t')[0])
    .filter(Boolean);
}

function ensureDevice(adbPath) {
  const onlineDevices = listOnlineDevices(adbPath);
  if (onlineDevices.length === 0) {
    throw new Error('Bagli Android emulatoru veya cihaz bulunamadi.');
  }

  const requestedDevice = process.env.ANDROID_SERIAL?.trim();

  if (requestedDevice) {
    if (!onlineDevices.includes(requestedDevice)) {
      throw new Error(
        `ANDROID_SERIAL=${requestedDevice} cihazi bagli degil. Aktif cihazlar: ${onlineDevices.join(', ')}`,
      );
    }

    return requestedDevice;
  }

  if (onlineDevices.length > 1) {
    const devicesWithSoRita = onlineDevices.filter((deviceSerial) =>
      isPackageInstalled(adbPath, deviceSerial),
    );

    if (devicesWithSoRita.length === 1) {
      return devicesWithSoRita[0];
    }

    throw new Error(
      `Birden fazla Android cihaz bagli. ANDROID_SERIAL ayarlayin. Aktif cihazlar: ${onlineDevices.join(', ')}`,
    );
  }

  return onlineDevices[0];
}

function isPackageInstalled(adbPath, deviceSerial) {
  const result = runAdb(
    adbPath,
    ['shell', 'pm', 'list', 'packages', PACKAGE_NAME],
    deviceSerial,
  );
  return (result.stdout ?? '').includes(`package:${PACKAGE_NAME}`);
}

function isDebugPackageInstalled(adbPath, deviceSerial) {
  if (!isPackageInstalled(adbPath, deviceSerial)) {
    return false;
  }

  const result = runAdb(
    adbPath,
    ['shell', 'dumpsys', 'package', PACKAGE_NAME],
    deviceSerial,
  );

  return /\bDEBUGGABLE\b/.test(result.stdout ?? '');
}

function reversePort(adbPath, deviceSerial, devicePort, hostPort) {
  const result = runAdb(
    adbPath,
    ['reverse', `tcp:${devicePort}`, `tcp:${hostPort}`],
    deviceSerial,
  );

  if (result.status !== 0) {
    throw new Error(
      result.stderr?.trim() ||
        `adb reverse ayarlanamadi (tcp:${devicePort} -> tcp:${hostPort}).`,
    );
  }
}

function removeReversePort(adbPath, deviceSerial, devicePort) {
  const result = runAdb(
    adbPath,
    ['reverse', '--remove', `tcp:${devicePort}`],
    deviceSerial,
  );

  // A missing reverse rule is already the desired state.
  if (result.status !== 0 && !/listener .* not found/i.test(result.stderr ?? '')) {
    throw new Error(
      result.stderr?.trim() ||
        `Eski adb reverse kaldirilamadi (tcp:${devicePort}).`,
    );
  }
}

function configureDevNetworking(adbPath, deviceSerial) {
  for (const port of LEGACY_METRO_PORTS) {
    if (port !== METRO_PORT) {
      removeReversePort(adbPath, deviceSerial, port);
    }
  }

  for (const port of REVERSED_PORTS) {
    reversePort(adbPath, deviceSerial, port, METRO_PORT);
  }

  console.log(
    `[SoRita][android] adb reverse hazir: ${REVERSED_PORTS.map((port) => `tcp:${port}->tcp:${METRO_PORT}`).join(', ')}`,
  );
}

function ensurePackageInstalled(adbPath, deviceSerial) {
  if (!isPackageInstalled(adbPath, deviceSerial)) {
    throw new Error(
      `Native SoRita uygulamasi yuklu degil (${PACKAGE_NAME}). Ilk kurulum icin once "npm run android:rebuild" calistir.`,
    );
  }

  if (!isDebugPackageInstalled(adbPath, deviceSerial)) {
    throw new Error(
      'Kurulu SoRita APK canli yenilemeyi destekleyen debug varyanti degil. "npm run android:rebuild" ile debug APK kur.',
    );
  }
}

function forceStopApp(adbPath, deviceSerial) {
  const result = runAdb(
    adbPath,
    ['shell', 'am', 'force-stop', PACKAGE_NAME],
    deviceSerial,
  );

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || 'Android uygulamasi durdurulamadi.');
  }
}

function launchApp(adbPath, deviceSerial) {
  const result = runAdb(adbPath, [
    'shell',
    'am',
    'start',
    '-W',
    '-n',
    `${PACKAGE_NAME}/.MainActivity`,
    '-a',
    'android.intent.action.MAIN',
    '-c',
    'android.intent.category.LAUNCHER',
  ], deviceSerial);

  if (result.status !== 0) {
    const fallback = runAdb(adbPath, [
      'shell',
      'monkey',
      '-p',
      PACKAGE_NAME,
      '-c',
      'android.intent.category.LAUNCHER',
      '1',
    ], deviceSerial);

    if (fallback.status !== 0) {
      throw new Error(fallback.stderr?.trim() || 'Android uygulamasi acilamadi.');
    }
  }

  console.log(`[SoRita][android] Native uygulama acildi: ${PACKAGE_NAME}`);
}

async function main() {
  const adbPath = resolveAdbPath();
  const deviceSerial = ensureDevice(adbPath);

  console.log(`[SoRita][android] Hedef cihaz: ${deviceSerial}`);
  console.log('[SoRita][android] Metro bekleniyor...');
  await waitForMetroProject();

  configureDevNetworking(adbPath, deviceSerial);
  ensurePackageInstalled(adbPath, deviceSerial);
  forceStopApp(adbPath, deviceSerial);
  launchApp(adbPath, deviceSerial);
}

main().catch((error) => {
  console.error(`[SoRita][android] ${error.message}`);
  process.exit(1);
});
