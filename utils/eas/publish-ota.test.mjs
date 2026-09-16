import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEasUpdateArguments,
  parsePublishArguments,
  summarizeUpdateOutput,
} from './publish-ota.mjs';

const sha = 'a'.repeat(40);

test('publishes both platforms at 100% by default', () => {
  assert.deepEqual(parsePublishArguments(['--message', ' Profil düzeltmesi ']), {
    dryRun: false,
    message: 'Profil düzeltmesi',
    platforms: ['android', 'ios'],
    rolloutPercentage: 100,
  });
});

test('accepts a single platform, a staged rollout and a dry run', () => {
  assert.deepEqual(
    parsePublishArguments(['--platform', 'ios', '--rollout', '10', '--dry-run', '--message', 'x']),
    { dryRun: true, message: 'x', platforms: ['ios'], rolloutPercentage: 10 },
  );
});

for (const [label, argv] of [
  ['a missing message', []],
  ['an empty message', ['--message', '   ']],
  ['a multi-line message', ['--message', 'a\nb']],
  ['an overlong message', ['--message', 'x'.repeat(201)]],
  ['an unknown platform', ['--message', 'x', '--platform', 'web']],
  ['a zero rollout', ['--message', 'x', '--rollout', '0']],
  ['a fractional rollout', ['--message', 'x', '--rollout', '5.5']],
  ['an oversized rollout', ['--message', 'x', '--rollout', '101']],
  ['an unknown flag', ['--message', 'x', '--skip-gates']],
  ['a flag without a value', ['--message']],
]) {
  test(`rejects ${label}`, () => {
    assert.throws(() => parsePublishArguments(argv));
  });
}

test('targets the production channel and environment and tags the commit', () => {
  assert.deepEqual(
    buildEasUpdateArguments({ message: 'Fix', platforms: ['android', 'ios'], sourceSha: sha }),
    [
      'update',
      '--channel',
      'production',
      '--environment',
      'production',
      '--platform',
      'all',
      '--message',
      `Fix [sha:${sha}]`,
      '--json',
      '--non-interactive',
    ],
  );
});

test('adds a rollout percentage only below 100%', () => {
  const args = buildEasUpdateArguments({
    message: 'Fix',
    platforms: ['android'],
    rolloutPercentage: 5,
    sourceSha: sha,
  });

  assert.equal(args[args.indexOf('--platform') + 1], 'android');
  assert.equal(args[args.indexOf('--rollout-percentage') + 1], '5');
});

const published = (overrides = {}) =>
  JSON.stringify([
    { id: 'u-android', group: 'group-1', platform: 'android', runtimeVersion: '1.0.107', ...overrides },
    { id: 'u-ios', group: 'group-1', platform: 'ios', runtimeVersion: '1.0.107' },
  ]);

test('summarizes one update group per publish', () => {
  assert.deepEqual(
    summarizeUpdateOutput(published(), { platforms: ['android', 'ios'], runtimeVersion: '1.0.107' }),
    {
      group: 'group-1',
      updates: [
        { id: 'u-android', platform: 'android' },
        { id: 'u-ios', platform: 'ios' },
      ],
    },
  );
});

test('rejects output that would reach no installed binary or the wrong audience', () => {
  const expected = { platforms: ['android', 'ios'], runtimeVersion: '1.0.107' };

  assert.throws(() => summarizeUpdateOutput('not json', expected), /did not return JSON/u);
  assert.throws(() => summarizeUpdateOutput('[]', expected), /no updates/u);
  assert.throws(() => summarizeUpdateOutput(published({ group: 'group-2' }), expected), /2 update groups/u);
  assert.throws(() => summarizeUpdateOutput(published({ runtimeVersion: '1.0.106' }), expected), /runtime 1\.0\.106/u);
  assert.throws(
    () => summarizeUpdateOutput(published(), { ...expected, platforms: ['android'] }),
    /published android, ios/u,
  );
});
