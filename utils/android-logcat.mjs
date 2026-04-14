import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const showAll = args.has('--all');
const clearFirst = args.has('--clear');

const tagMatchers = [
  /\bReactNativeJS\b/,
  /\bReactNative\b/,
  /\bExpo\b/,
  /\bExpoModulesCore\b/,
  /\bAndroidRuntime\b/,
  /\bSystem\.err\b/,
  /\bSystem\.out\b/,
];

const textMatchers = [
  /\[SoRita\]/i,
  /host\.exp\.exponent/i,
  /com\.sorita\.app/i,
  /supabase/i,
  /hermes/i,
  /unhandled/i,
  /typeerror/i,
  /referenceerror/i,
];

function isRelevant(line) {
  return [...tagMatchers, ...textMatchers].some((pattern) => pattern.test(line));
}

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

const adbPath = resolveAdbPath();

if (clearFirst) {
  spawnSync(adbPath, ['logcat', '-c'], { stdio: 'inherit', shell: true });
}

const logcat = spawn(adbPath, ['logcat', '-v', 'time'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
});

console.log(
  showAll
    ? '[SoRita][logs] Android logcat basladi. Tum loglar terminale akiyor.'
    : '[SoRita][logs] Android logcat basladi. Uygulama ile ilgili loglar filtrelenerek gosteriliyor.',
);

let stdoutBuffer = '';
let stderrBuffer = '';

function flushBuffer(chunk, bufferName) {
  const source = bufferName === 'stdout' ? stdoutBuffer : stderrBuffer;
  const next = source + chunk.toString();
  const lines = next.split(/\r?\n/);
  const remainder = lines.pop() ?? '';

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    if (showAll || isRelevant(line)) {
      console.log(line);
    }
  }

  if (bufferName === 'stdout') {
    stdoutBuffer = remainder;
  } else {
    stderrBuffer = remainder;
  }
}

logcat.stdout.on('data', (chunk) => flushBuffer(chunk, 'stdout'));
logcat.stderr.on('data', (chunk) => flushBuffer(chunk, 'stderr'));

logcat.on('error', (error) => {
  console.error('[SoRita][logs] adb logcat baslatilamadi.', error.message);
  console.error(
    '[SoRita][logs] ANDROID_HOME veya ANDROID_SDK_ROOT tanimli degilse adb yolu bulunamayabilir.',
  );
});

logcat.on('close', (code) => {
  console.log(`[SoRita][logs] logcat kapandi. Cikis kodu: ${code ?? 'unknown'}`);
});

process.on('SIGINT', () => {
  logcat.kill('SIGINT');
  process.exit(0);
});
