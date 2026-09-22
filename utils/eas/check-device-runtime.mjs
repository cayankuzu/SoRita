#!/usr/bin/env node

// Reads the runtime the app installed on a connected Android device embeds and
// compares it with the runtime this repository publishes for. See
// device-runtime.mjs for why a mismatch is invisible from the device itself.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describeRuntimeMatch, readApkRuntimeVersion } from './device-runtime.mjs';
import { git, readRuntimeVersion, workspaceRoot } from './ota-binaries.mjs';

const ANDROID_PACKAGE = 'com.cayan.sorita.socialmap';

function fail(message) {
  console.error(`[device-runtime] ${message}`);
  process.exit(1);
}

function resolveAdb() {
  const candidates = [
    process.env.ADB_PATH,
    process.env.ANDROID_HOME && join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe'),
    process.env.ANDROID_HOME && join(process.env.ANDROID_HOME, 'platform-tools', 'adb'),
    process.env.LOCALAPPDATA &&
      join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
    process.env.HOME && join(process.env.HOME, 'Library', 'Android', 'sdk', 'platform-tools', 'adb'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return 'adb';
}

function adb(adbPath, args) {
  const result = spawnSync(adbPath, args, { encoding: 'utf8' });

  if (result.error) {
    fail(`Could not run adb (${adbPath}). Install platform-tools or set ADB_PATH.`);
  }

  if (result.status !== 0) {
    fail(`adb ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`);
  }

  return result.stdout ?? '';
}

function parseArguments(argv) {
  if (argv.length === 0) {
    return { apkPath: null };
  }

  if (argv.length === 2 && argv[0] === '--apk') {
    return { apkPath: argv[1] };
  }

  fail('Usage: npm run ota:verify-device [-- --apk <path to .apk>]');
  return { apkPath: null };
}

function report(deviceRuntime) {
  const publishedRuntime = readRuntimeVersion(git(['show', 'HEAD:app.config.ts']));
  const verdict = describeRuntimeMatch({ deviceRuntime, publishedRuntime });

  if (!verdict.ok) {
    fail(verdict.message);
  }

  console.log(`[device-runtime] ${verdict.message}`);
}

function main(argv) {
  const { apkPath } = parseArguments(argv);

  // Checking a local artifact catches the mismatch before it is ever installed.
  if (apkPath) {
    if (!existsSync(apkPath)) {
      fail(`No such file: ${apkPath}`);
    }

    const local = readApkRuntimeVersion(readFileSync(apkPath));
    report(local.ok ? local.runtimeVersion : null);
    return;
  }

  const adbPath = resolveAdb();
  const devices = adb(adbPath, ['devices'])
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.endsWith('\tdevice'));

  if (devices.length === 0) {
    fail('No Android device is attached. Connect one with USB debugging enabled.');
  }

  const basePath = adb(adbPath, ['shell', 'pm', 'path', ANDROID_PACKAGE])
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('package:') && line.endsWith('base.apk'));

  if (!basePath) {
    fail(`${ANDROID_PACKAGE} is not installed on the attached device.`);
  }

  const scratch = mkdtempSync(join(tmpdir(), 'sorita-device-runtime-'));
  const localApk = join(scratch, 'base.apk');

  try {
    adb(adbPath, ['pull', basePath.replace(/^package:/u, ''), localApk]);

    const extracted = readApkRuntimeVersion(readFileSync(localApk));
    report(extracted.ok ? extracted.runtimeVersion : null);
  } finally {
    rmSync(scratch, { force: true, recursive: true });
  }
}

if (process.argv[1] && process.argv[1].includes('check-device-runtime')) {
  process.chdir(workspaceRoot);
  main(process.argv.slice(2));
}
