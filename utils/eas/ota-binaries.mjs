#!/usr/bin/env node

// Records the store binary OTA updates target, verified from the artifact rather than the repo.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

export const OTA_CHANNEL = 'production';
export const APP_IDENTIFIER = 'com.cayan.sorita.socialmap';
export const PLATFORMS = ['android', 'ios'];
export const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));
export const binaryRecordsPath = join(workspaceRoot, 'quality/ota-binaries.json');

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

function fail(message) {
  throw new Error(message);
}

export function git(args, cwd = workspaceRoot) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) fail(`git ${args[0]} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

export function isAncestor(ancestor, descendant, cwd = workspaceRoot) {
  const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
    cwd,
    windowsHide: true,
  });
  return result.status === 0;
}

export function readAppVersion(appConfigSource) {
  const version = appConfigSource.match(/\n {2}version: '([^']+)'/u)?.[1];
  if (!version || !VERSION_PATTERN.test(version)) fail('Could not read version from app.config.ts.');
  return version;
}

export function readUpdateProjectId(androidStringsSource) {
  const projectId = androidStringsSource.match(
    /name="expo_update_url"[^>]*>https:\/\/u\.expo\.dev\/([0-9a-f-]{36})</u,
  )?.[1];
  if (!projectId || !UUID_PATTERN.test(projectId)) fail('Could not read the EAS Update URL from strings.xml.');
  return projectId;
}

export function readZipEntries(archive, names) {
  const wanted = new Set(names);
  const entries = new Map();
  const lowestEndRecordOffset = Math.max(0, archive.length - 0xffff - 22);
  let endRecordOffset = -1;

  for (let offset = archive.length - 22; offset >= lowestEndRecordOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      endRecordOffset = offset;
      break;
    }
  }
  if (endRecordOffset < 0) fail('The file is not a ZIP archive.');

  const entryCount = archive.readUInt16LE(endRecordOffset + 10);
  let cursor = archive.readUInt32LE(endRecordOffset + 16);
  if (entryCount === 0xffff || cursor === 0xffffffff) fail('ZIP64 archives are not supported.');

  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(cursor) !== 0x02014b50) fail('The ZIP central directory is corrupt.');
    const method = archive.readUInt16LE(cursor + 10);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localHeaderOffset = archive.readUInt32LE(cursor + 42);
    const name = archive.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;

    if (!wanted.has(name)) continue;
    if (archive.readUInt32LE(localHeaderOffset) !== 0x04034b50) fail(`The ZIP entry ${name} is corrupt.`);
    const dataOffset =
      localHeaderOffset +
      30 +
      archive.readUInt16LE(localHeaderOffset + 26) +
      archive.readUInt16LE(localHeaderOffset + 28);
    const data = archive.subarray(dataOffset, dataOffset + compressedSize);

    if (method === 0) entries.set(name, Buffer.from(data));
    else if (method === 8) entries.set(name, inflateRawSync(data));
    else fail(`The ZIP entry ${name} uses unsupported compression ${method}.`);
  }

  return entries;
}

function single(values, label) {
  const distinct = [...new Set(values)];
  if (distinct.length !== 1) {
    fail(`Expected exactly one ${label} in the bundle, found ${distinct.length ? distinct.join(', ') : 'none'}.`);
  }
  return distinct[0];
}

export function inspectAndroidBundle(archive) {
  const manifestName = 'base/manifest/AndroidManifest.xml';
  const resourcesName = 'base/resources.pb';
  const entries = readZipEntries(archive, [manifestName, resourcesName]);
  if (!entries.has(manifestName) || !entries.has(resourcesName)) {
    fail('The file is not an Android App Bundle (base manifest or resources are missing).');
  }

  // aapt2 protobuf keeps string values as plain UTF-8 next to their names.
  const manifest = entries.get(manifestName).toString('latin1');
  const resources = entries.get(resourcesName).toString('latin1');

  if (!manifest.includes(APP_IDENTIFIER)) fail(`The bundle is not ${APP_IDENTIFIER}.`);

  return {
    channel: single(
      [...manifest.matchAll(/"expo-channel-name":"([a-z]+)"/gu)].map((match) => match[1]),
      'expo-channel-name request header',
    ),
    projectId: single(
      [...resources.matchAll(/https:\/\/u\.expo\.dev\/([0-9a-f-]{36})/gu)].map((match) => match[1]),
      'EAS Update URL',
    ),
    runtimeVersion: single(
      [...resources.matchAll(/expo_runtime_version[\s\S]{0,96}?(\d+\.\d+\.\d+)/gu)].map((match) => match[1]),
      'expo_runtime_version',
    ),
  };
}

export function inspectIosBuild(build) {
  if (!build || typeof build !== 'object' || Array.isArray(build)) fail('The EAS build response must be an object.');
  if (build.platform !== 'IOS') fail('The EAS build is not an iOS build.');
  if (build.status !== 'FINISHED') fail(`The EAS build is ${build.status}, not FINISHED.`);
  if (build.distribution !== 'STORE' || build.buildProfile !== 'production') {
    fail('The EAS build is not a production store build.');
  }
  if (build.appIdentifier !== APP_IDENTIFIER) fail(`The EAS build is not ${APP_IDENTIFIER}.`);

  const sourceSha = build.gitCommitHash?.toLowerCase();
  if (!SHA_PATTERN.test(sourceSha ?? '')) fail('The EAS build has no source commit.');

  return {
    buildId: build.id,
    buildNumber: build.appBuildVersion ?? null,
    channel: build.updateChannel?.name ?? null,
    projectId: build.app?.id ?? null,
    runtimeVersion: build.runtime?.version ?? null,
    sourceSha,
  };
}

export function verifyInspectedBinary(inspected, { appVersion, platform, projectId }) {
  if (inspected.channel !== OTA_CHANNEL) {
    fail(`The ${platform} binary listens to channel '${inspected.channel}', not '${OTA_CHANNEL}'.`);
  }
  if (inspected.projectId !== projectId) fail(`The ${platform} binary belongs to another EAS project.`);
  if (inspected.runtimeVersion !== appVersion) {
    fail(
      `The ${platform} binary embeds runtime ${inspected.runtimeVersion}, but its source app version is ${appVersion}. ` +
        'No update published from this repository would reach it.',
    );
  }
}

export function selectBinaryRecords(document, { appVersion, platforms }) {
  if (!document || document.schemaVersion !== 1 || document.channel !== OTA_CHANNEL) {
    fail(`quality/ota-binaries.json must be schema 1 for channel '${OTA_CHANNEL}'.`);
  }

  return platforms.map((platform) => {
    const record = document.binaries?.[platform];
    if (!record) {
      fail(`No ${platform} store binary is recorded. Build it, then run npm run ota:record-binary.`);
    }
    if (!VERSION_PATTERN.test(record.runtimeVersion ?? '') || !SHA_PATTERN.test(record.sourceSha ?? '')) {
      fail(`The ${platform} binary record is malformed.`);
    }
    if (record.runtimeVersion !== appVersion) {
      fail(
        `The recorded ${platform} binary runs runtime ${record.runtimeVersion}, but app.config.ts is ${appVersion}. ` +
          `An update published now would reach no ${platform} user. Ship and record a ${platform} binary for ` +
          `${appVersion}, or publish only to the other platform with --platform.`,
      );
    }
    return { platform, ...record };
  });
}

export function mergeBinaryRecord(document, platform, record) {
  if (!PLATFORMS.includes(platform)) fail(`Unknown platform: ${platform}`);
  return {
    schemaVersion: 1,
    channel: OTA_CHANNEL,
    binaries: { ...(document?.binaries ?? {}), [platform]: record },
  };
}

function parseRecordArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!['--platform', '--aab', '--source-sha', '--eas-build-id'].includes(name) || !value) {
      fail(
        'Usage: npm run ota:record-binary -- --platform android --aab <file.aab> --source-sha <sha>\n' +
          '       npm run ota:record-binary -- --platform ios --eas-build-id <uuid>',
      );
    }
    options[name.slice(2)] = value;
  }
  if (options.platform === 'android' && (!options.aab || !options['source-sha'])) {
    fail('Android needs --aab and --source-sha.');
  }
  if (options.platform === 'ios' && !UUID_PATTERN.test(options['eas-build-id'] ?? '')) {
    fail('iOS needs --eas-build-id <uuid>.');
  }
  if (!PLATFORMS.includes(options.platform)) fail('--platform must be android or ios.');
  return options;
}

function easJson(args) {
  const invocation = resolveEasInvocation();
  const result = spawnSync(invocation.command, [...invocation.prefix, ...args], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) fail(`eas ${args[0]} failed: ${result.stderr.trim()}`);
  return JSON.parse(result.stdout);
}

export function resolveEasInvocation() {
  if (process.platform !== 'win32') return { command: 'eas', prefix: [] };

  // Run eas-cli's JS entry directly so release notes never pass through cmd.exe.
  const npmRoot = spawnSync('npm root -g', { encoding: 'utf8', shell: true, windowsHide: true });
  const runScript = join(npmRoot.stdout?.trim() ?? '', 'eas-cli', 'bin', 'run');
  if (npmRoot.status !== 0 || !existsSync(runScript)) fail('eas-cli is not installed. Run npm install -g eas-cli.');
  return { command: process.execPath, prefix: [runScript] };
}

function main() {
  const options = parseRecordArguments(process.argv.slice(2));
  const head = git(['rev-parse', 'HEAD']);
  const projectId = readUpdateProjectId(
    readFileSync(join(workspaceRoot, 'android/app/src/main/res/values/strings.xml'), 'utf8'),
  );
  const currentAppVersion = readAppVersion(readFileSync(join(workspaceRoot, 'app.config.ts'), 'utf8'));

  let record;
  if (options.platform === 'android') {
    const sourceSha = git(['rev-parse', '--verify', `${options['source-sha']}^{commit}`]);
    const archivePath = resolve(options.aab);
    const archive = readFileSync(archivePath);
    const inspected = inspectAndroidBundle(archive);
    record = {
      runtimeVersion: inspected.runtimeVersion,
      sourceSha,
      artifactSha256: createHash('sha256').update(archive).digest('hex'),
    };
    verifyInspectedBinary(inspected, {
      appVersion: readAppVersion(git(['show', `${sourceSha}:app.config.ts`])),
      platform: 'android',
      projectId,
    });
  } else {
    const inspected = inspectIosBuild(easJson(['build:view', options['eas-build-id'], '--json']));
    git(['rev-parse', '--verify', `${inspected.sourceSha}^{commit}`]);
    verifyInspectedBinary(inspected, {
      appVersion: readAppVersion(git(['show', `${inspected.sourceSha}:app.config.ts`])),
      platform: 'ios',
      projectId,
    });
    record = {
      runtimeVersion: inspected.runtimeVersion,
      sourceSha: inspected.sourceSha,
      easBuildId: inspected.buildId,
      buildNumber: inspected.buildNumber,
    };
  }

  if (!isAncestor(record.sourceSha, head)) fail('The binary source commit is not an ancestor of HEAD.');
  if (record.runtimeVersion !== currentAppVersion) {
    fail(`The binary runtime ${record.runtimeVersion} differs from the current app version ${currentAppVersion}.`);
  }

  const existing = existsSync(binaryRecordsPath) ? JSON.parse(readFileSync(binaryRecordsPath, 'utf8')) : undefined;
  writeFileSync(
    binaryRecordsPath,
    `${JSON.stringify(mergeBinaryRecord(existing, options.platform, record), null, 2)}\n`,
  );
  console.log(
    `[ota-binaries] Recorded ${options.platform} runtime ${record.runtimeVersion} from ${record.sourceSha} ` +
      'in quality/ota-binaries.json. Commit and push this file.',
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(`[ota-binaries] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
