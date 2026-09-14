import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyProductionAndroidBuild } from './verify-production-android-build.mjs';

const source = 'a'.repeat(40);
const buildId = '123e4567-e89b-42d3-a456-426614174000';
const projectId = '223e4567-e89b-42d3-a456-426614174000';
const build = {
  app: { id: projectId }, appBuildVersion: '112', appIdentifier: 'com.cayan.sorita.socialmap', appVersion: '1.0.106',
  artifacts: { applicationArchiveUrl: 'https://expo.dev/build/sorita' }, buildProfile: 'production', channel: 'production',
  distribution: 'STORE', gitCommitHash: source, id: buildId, platform: 'ANDROID', status: 'FINISHED',
};

test('Android provider build evidence is bound to the exact production source', () => {
  assert.equal(verifyProductionAndroidBuild({ build, buildId, packageId: build.appIdentifier, projectId, runtimeVersion: build.appVersion, sourceSha: source }).platform, 'ANDROID');
  assert.throws(() => verifyProductionAndroidBuild({ build: { ...build, distribution: 'INTERNAL' }, buildId, packageId: build.appIdentifier, projectId, runtimeVersion: build.appVersion, sourceSha: source }));
});
