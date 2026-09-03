import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyBuildEvidence } from './verify-build-evidence.mjs';

const sourceSha = 'a'.repeat(40);
const runtimeVersion = '1.0.102';
const projectId = 'b4a62a22-92dd-4867-ab44-f9131d958ed2';
const androidId = '11111111-1111-4111-8111-111111111111';
const iosId = '22222222-2222-4222-8222-222222222222';

function build(id, platform, overrides = {}) {
  return {
    app: { id: projectId },
    appBuildVersion: platform === 'ANDROID' ? '107' : '87',
    appIdentifier: 'com.cayan.sorita.socialmap',
    appVersion: runtimeVersion,
    artifacts: { buildUrl: 'https://provider.example/artifact' },
    buildProfile: 'preview',
    distribution: 'INTERNAL',
    gitCommitHash: sourceSha,
    id,
    platform,
    status: 'FINISHED',
    ...overrides,
  };
}

function validParams() {
  return {
    androidBuild: build(androidId, 'ANDROID'),
    appIdentifier: 'com.cayan.sorita.socialmap',
    evidence: `android=${androidId};ios=${iosId};runtime=${runtimeVersion};source=${sourceSha}`,
    iosBuild: build(iosId, 'IOS'),
    profile: 'preview',
    projectId,
    runtimeVersion,
    sourceSha,
  };
}

test('verifies both provider builds and emits only sanitized identity fields', () => {
  const result = verifyBuildEvidence(validParams());
  assert.equal(result.builds.length, 2);
  assert.equal(result.builds[0].gitCommitHash, sourceSha);
  assert.equal(JSON.stringify(result).includes('provider.example'), false);
});

test('rejects a successful-looking build from a different source or profile', () => {
  const sourceMismatch = validParams();
  sourceMismatch.androidBuild = build(androidId, 'ANDROID', { gitCommitHash: 'b'.repeat(40) });
  assert.throws(() => verifyBuildEvidence(sourceMismatch), /source SHA does not match/u);

  const profileMismatch = validParams();
  profileMismatch.iosBuild = build(iosId, 'IOS', { buildProfile: 'production' });
  assert.throws(() => verifyBuildEvidence(profileMismatch), /profile does not match/u);
});

test('rejects missing provider artifacts and non-finished builds', () => {
  const missingArtifact = validParams();
  missingArtifact.androidBuild = build(androidId, 'ANDROID', { artifacts: {} });
  assert.throws(() => verifyBuildEvidence(missingArtifact), /no provider artifact/u);

  const unfinished = validParams();
  unfinished.iosBuild = build(iosId, 'IOS', { status: 'IN_QUEUE' });
  assert.throws(() => verifyBuildEvidence(unfinished), /not finished/u);
});
