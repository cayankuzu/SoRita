import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateRawSync } from 'node:zlib';

import {
  inspectAndroidBundle,
  inspectIosBuild,
  mergeBinaryRecord,
  readRuntimeVersion,
  readUpdateProjectId,
  readZipEntries,
  selectBinaryRecords,
  verifyInspectedBinary,
} from './ota-binaries.mjs';

const projectId = 'b4a62a22-92dd-4867-ab44-f9131d958ed2';
const sha = 'b'.repeat(40);

function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { name, text, deflate = true } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const raw = Buffer.from(text, 'latin1');
    const data = deflate ? deflateRawSync(raw) : raw;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDirectory, end]);
}

function bundle({ channel = 'production', runtime = '1.0.107', extraResources = '' } = {}) {
  return zip([
    {
      name: 'base/manifest/AndroidManifest.xml',
      text: `\n\x1acom.cayan.sorita.socialmap\x12{"expo-channel-name":"${channel}"}\n1.0.107`,
    },
    {
      name: 'base/resources.pb',
      text: `\x12\x14expo_runtime_version\x32\x09\x12\x07${runtime}\x12https://u.expo.dev/${projectId}${extraResources}`,
      deflate: false,
    },
    { name: 'base/assets/index.android.bundle', text: 'var x=1;' },
  ]);
}

test('reads the published runtime and update project', () => {
  assert.equal(
    readRuntimeVersion("const nativeRuntimeVersion = '1.0.108';\n  version: '1.0.109',"),
    '1.0.108',
  );
  // A commit from before the runtime was split out of the version still reads.
  assert.equal(readRuntimeVersion("\n  runtimeVersion: '1.0.107',"), '1.0.107');
  // The marketing version alone is not a runtime.
  assert.throws(() => readRuntimeVersion("\n  version: '1.0.109',"));
  assert.throws(() => readRuntimeVersion("const nativeRuntimeVersion = 'next';"));
  assert.equal(
    readUpdateProjectId(`<string name="expo_update_url" translatable="false">https://u.expo.dev/${projectId}</string>`),
    projectId,
  );
});

test('reads stored and deflated ZIP entries by name', () => {
  const entries = readZipEntries(bundle(), ['base/resources.pb', 'base/assets/index.android.bundle', 'missing']);

  assert.equal(entries.get('base/assets/index.android.bundle').toString(), 'var x=1;');
  assert.match(entries.get('base/resources.pb').toString('latin1'), /expo_runtime_version/u);
  assert.equal(entries.has('missing'), false);
  assert.throws(() => readZipEntries(Buffer.alloc(64), ['x']), /not a ZIP/u);
});

test('extracts the channel, project and runtime embedded in an Android bundle', () => {
  assert.deepEqual(inspectAndroidBundle(bundle()), {
    channel: 'production',
    projectId,
    runtimeVersion: '1.0.107',
  });
});

test('rejects a bundle whose runtime cannot be read unambiguously', () => {
  assert.throws(
    () => inspectAndroidBundle(bundle({ extraResources: '\x12\x14expo_runtime_version\x12\x07 1.0.106' })),
    /exactly one expo_runtime_version/u,
  );
  assert.throws(() => inspectAndroidBundle(zip([{ name: 'other.txt', text: 'x' }])), /not an Android App Bundle/u);
});

test('an Android binary whose runtime lags its version is refused', () => {
  const expected = { runtimeVersion: '1.0.107', platform: 'android', projectId };

  assert.doesNotThrow(() => verifyInspectedBinary(inspectAndroidBundle(bundle()), expected));
  assert.throws(
    () => verifyInspectedBinary(inspectAndroidBundle(bundle({ runtime: '1.0.106' })), expected),
    /embeds runtime 1\.0\.106/u,
  );
  assert.throws(
    () => verifyInspectedBinary(inspectAndroidBundle(bundle({ channel: 'preview' })), expected),
    /channel 'preview'/u,
  );
  assert.throws(
    () => verifyInspectedBinary(inspectAndroidBundle(bundle()), { ...expected, projectId: 'x' }),
    /another EAS project/u,
  );
});

const iosBuild = {
  id: '012be71b-b694-4e9b-98ca-42995aa0b575',
  platform: 'IOS',
  status: 'FINISHED',
  distribution: 'STORE',
  buildProfile: 'production',
  appIdentifier: 'com.cayan.sorita.socialmap',
  appBuildVersion: '92',
  gitCommitHash: sha.toUpperCase(),
  updateChannel: { name: 'production' },
  runtime: { version: '1.0.107' },
  app: { id: projectId },
};

test('extracts the identity of a finished production iOS store build', () => {
  assert.deepEqual(inspectIosBuild(iosBuild), {
    buildId: iosBuild.id,
    buildNumber: '92',
    channel: 'production',
    projectId,
    runtimeVersion: '1.0.107',
    sourceSha: sha,
  });
});

for (const [label, override] of [
  ['an Android build', { platform: 'ANDROID' }],
  ['an unfinished build', { status: 'IN_PROGRESS' }],
  ['an internal build', { distribution: 'INTERNAL' }],
  ['another app', { appIdentifier: 'com.example' }],
  ['a build without a commit', { gitCommitHash: null }],
]) {
  test(`refuses to record ${label}`, () => {
    assert.throws(() => inspectIosBuild({ ...iosBuild, ...override }));
  });
}

test('an iOS build that never enabled updates is refused', () => {
  const inspected = inspectIosBuild({ ...iosBuild, updateChannel: null, runtime: null });

  assert.throws(
    () => verifyInspectedBinary(inspected, { runtimeVersion: '1.0.107', platform: 'ios', projectId }),
    /channel 'null'/u,
  );
});

const records = mergeBinaryRecord(
  mergeBinaryRecord(undefined, 'android', { runtimeVersion: '1.0.107', sourceSha: sha, artifactSha256: 'c'.repeat(64) }),
  'ios',
  { runtimeVersion: '1.0.106', sourceSha: sha, easBuildId: iosBuild.id, buildNumber: '92' },
);

test('merging a record keeps the other platform', () => {
  assert.equal(records.schemaVersion, 1);
  assert.equal(records.channel, 'production');
  assert.deepEqual(Object.keys(records.binaries), ['android', 'ios']);
  assert.throws(() => mergeBinaryRecord(records, 'web', {}), /Unknown platform/u);
});

test('selects only binaries that run the current app version', () => {
  assert.deepEqual(
    selectBinaryRecords(records, { runtimeVersion: '1.0.107', platforms: ['android'] }).map((record) => record.platform),
    ['android'],
  );
  assert.throws(
    () => selectBinaryRecords(records, { runtimeVersion: '1.0.107', platforms: ['android', 'ios'] }),
    /ios binary runs runtime 1\.0\.106/u,
  );
  assert.throws(
    () => selectBinaryRecords({ ...records, channel: 'preview' }, { runtimeVersion: '1.0.107', platforms: ['android'] }),
    /schema 1/u,
  );
  assert.throws(
    () => selectBinaryRecords({ schemaVersion: 1, channel: 'production', binaries: {} }, { runtimeVersion: '1.0.107', platforms: ['ios'] }),
    /No ios store binary is recorded/u,
  );
});
