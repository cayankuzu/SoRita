import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import net from 'node:net';

const PACKAGE_NAME = process.env.ANDROID_APP_ID || 'com.cayan.sorita.socialmap';
const METRO_PORT = 8081;
const REVERSED_PORTS = [8081, 19000, 19001, 19002];
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

async function waitForPort(port, label) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < WAIT_TIMEOUT_MS) {
    if (await canConnect(port)) {
      console.log(`[SoRita][android] ${label} hazir: ${port}`);
      return;
    }

    await wait(POLL_INTERVAL_MS);
  }

  throw new Error(`${label} zamaninda hazir olmadi (${port}).`);
}

function runAdb(adbPath, adbArgs, deviceSerial) {
  const args = deviceSerial ? ['-s', deviceSerial, ...adbArgs] : adbArgs;

  return spawnSync(adbPath, args, {
    encoding: 'utf8',
    shell: true,
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
    throw new Error(
      `Birden fazla Android cihaz bagli. ANDROID_SERIAL ayarlayin. Aktif cihazlar: ${onlineDevices.join(', ')}`,
    );
  }

  return onlineDevices[0];
}

function reversePort(adbPath, deviceSerial, port) {
  const result = runAdb(adbPath, ['reverse', `tcp:${port}`, `tcp:${port}`], deviceSerial);

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `adb reverse ayarlanamadi (tcp:${port}).`);
  }
}

function configureDevNetworking(adbPath, deviceSerial) {
  for (const port of REVERSED_PORTS) {
    reversePort(adbPath, deviceSerial, port);
  }

  console.log(
    `[SoRita][android] adb reverse hazir: ${REVERSED_PORTS.map((port) => `tcp:${port}`).join(', ')}`,
  );
}

function ensurePackageInstalled(adbPath, deviceSerial) {
  const result = runAdb(adbPath, ['shell', 'pm', 'list', 'packages', PACKAGE_NAME], deviceSerial);
  const stdout = result.stdout ?? '';

  if (!stdout.includes(`package:${PACKAGE_NAME}`)) {
    throw new Error(
      `Native SoRita uygulamasi yuklu degil (${PACKAGE_NAME}). Ilk kurulum icin once "npm run android:rebuild" calistir.`,
    );
  }
}

function launchApp(adbPath, deviceSerial) {
  const result = runAdb(adbPath, [
    'shell',
    'monkey',
    '-p',
    PACKAGE_NAME,
    '-c',
    'android.intent.category.LAUNCHER',
    '1',
  ], deviceSerial);

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || 'Android uygulamasi acilamadi.');
  }

  console.log(`[SoRita][android] Native uygulama acildi: ${PACKAGE_NAME}`);
}

async function main() {
  const adbPath = resolveAdbPath();
  const deviceSerial = ensureDevice(adbPath);

  console.log(`[SoRita][android] Hedef cihaz: ${deviceSerial}`);
  console.log('[SoRita][android] Metro bekleniyor...');
  await waitForPort(METRO_PORT, 'Metro');

  configureDevNetworking(adbPath, deviceSerial);
  ensurePackageInstalled(adbPath, deviceSerial);
  launchApp(adbPath, deviceSerial);
}

main().catch((error) => {
  console.error(`[SoRita][android] ${error.message}`);
  process.exit(1);
});
