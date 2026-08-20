import { execFileSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const mode = process.argv[2];
if (!['generate', 'measure'].includes(mode)) {
  console.error('Usage: node utils/android-benchmark.mjs <generate|measure>');
  process.exit(1);
}

const isWindows = os.platform() === 'win32';
const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (
  isWindows && process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
    : path.join(os.homedir(), 'Android', 'Sdk')
);
const adb = path.join(sdkRoot, 'platform-tools', isWindows ? 'adb.exe' : 'adb');
const gradle = path.resolve('android', isWindows ? 'gradlew.bat' : 'gradlew');

let deviceAbi;
let deviceSerial;
let isEmulator;
try {
  const devices = execFileSync(adb, ['devices'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts[0] && parts[1] === 'device');
  const requestedSerial = process.env.ANDROID_SERIAL?.trim();
  const selectedDevice = requestedSerial
    ? devices.find(([serial]) => serial === requestedSerial)
    : devices.length === 1
      ? devices[0]
      : undefined;

  if (!selectedDevice) {
    if (requestedSerial) {
      throw new Error(`ANDROID_SERIAL device is not connected: ${requestedSerial}.`);
    }

    throw new Error(`Expected exactly one connected Android device, found ${devices.length}.`);
  }

  deviceSerial = selectedDevice[0];
  deviceAbi = execFileSync(
    adb,
    ['-s', deviceSerial, 'shell', 'getprop', 'ro.product.cpu.abi'],
    { encoding: 'utf8' },
  ).trim();
  isEmulator = execFileSync(
    adb,
    ['-s', deviceSerial, 'shell', 'getprop', 'ro.kernel.qemu'],
    { encoding: 'utf8' },
  ).trim() === '1';
} catch (error) {
  console.error(`[android-benchmark] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (mode === 'measure' && isEmulator) {
  console.error('[android-benchmark] Macrobenchmark measurements require a physical Android device.');
  process.exit(1);
}

const supportedAbi = ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'].find(
  (abi) => deviceAbi === abi,
);
if (!supportedAbi) {
  console.error(`[android-benchmark] Unsupported device ABI: ${deviceAbi}`);
  process.exit(1);
}

const task = mode === 'generate'
  ? ':app:generateBaselineProfile'
  : ':baselineprofile:connectedCheck';
const args = [
  task,
  '--console=plain',
  `-PreactNativeArchitectures=${supportedAbi}`,
  '-PsoritaReleaseStoreFile=app/debug.keystore',
  '-PsoritaReleaseStorePassword=android',
  '-PsoritaReleaseKeyAlias=androiddebugkey',
  '-PsoritaReleaseKeyPassword=android',
];
if (mode === 'measure') {
  args.push('-Pandroid.testInstrumentationRunnerArguments.androidx.benchmark.enabledRules=Macrobenchmark');
}

console.log(`[android-benchmark] ${mode} on ${deviceSerial} (${supportedAbi})`);
const result = spawnSync(gradle, args, {
  cwd: path.resolve('android'),
  env: {
    ...process.env,
    ANDROID_SERIAL: deviceSerial,
    SENTRY_DISABLE_AUTO_UPLOAD: 'true',
  },
  shell: isWindows,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
