#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { OTA_SAFE, classifyGitRange } from '../guards/classify-ota-change.mjs';
import {
  OTA_CHANNEL,
  PLATFORMS,
  binaryRecordsPath,
  git,
  isAncestor,
  readRuntimeVersion,
  resolveEasInvocation,
  selectBinaryRecords,
  workspaceRoot,
} from './ota-binaries.mjs';

const USAGE =
  'Usage: npm run ota:publish -- --message "<release note>" [--platform all|android|ios] [--rollout <1-100>] [--dry-run]';

function fail(message) {
  throw new Error(message);
}

export function parsePublishArguments(argv) {
  const options = { dryRun: false, message: '', platform: 'all', rolloutPercentage: 100 };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (!['--message', '--platform', '--rollout'].includes(argument)) fail(`Unknown argument: ${argument}\n${USAGE}`);

    const value = argv[index + 1];
    if (value === undefined) fail(`${argument} requires a value.\n${USAGE}`);
    index += 1;

    if (argument === '--message') options.message = value.trim();
    if (argument === '--platform') options.platform = value;
    if (argument === '--rollout') options.rolloutPercentage = /^\d+$/u.test(value) ? Number(value) : Number.NaN;
  }

  if (!options.message) fail(`--message is required.\n${USAGE}`);
  if (/[\r\n]/u.test(options.message) || options.message.length > 200) {
    fail('--message must be a single line of at most 200 characters.');
  }
  if (!['all', ...PLATFORMS].includes(options.platform)) fail('--platform must be all, android or ios.');
  if (!Number.isInteger(options.rolloutPercentage) || options.rolloutPercentage < 1 || options.rolloutPercentage > 100) {
    fail('--rollout must be an integer from 1 to 100.');
  }

  return {
    dryRun: options.dryRun,
    message: options.message,
    platforms: options.platform === 'all' ? [...PLATFORMS] : [options.platform],
    rolloutPercentage: options.rolloutPercentage,
  };
}

export function buildEasUpdateArguments({
  channel = OTA_CHANNEL,
  environment = OTA_CHANNEL,
  message,
  platforms,
  rolloutPercentage = 100,
  sourceSha,
}) {
  const args = [
    'update',
    '--channel',
    channel,
    '--environment',
    environment,
    '--platform',
    platforms.length === PLATFORMS.length ? 'all' : platforms[0],
    '--message',
    `${message} [sha:${sourceSha}]`,
  ];
  if (rolloutPercentage < 100) args.push('--rollout-percentage', String(rolloutPercentage));
  args.push('--json', '--non-interactive');
  return args;
}

export function summarizeUpdateOutput(stdout, { platforms, runtimeVersion }) {
  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    fail('eas update did not return JSON.');
  }

  const updates = Array.isArray(payload) ? payload : payload?.updates;
  if (!Array.isArray(updates) || updates.length === 0) fail('eas update returned no updates.');

  const groups = [...new Set(updates.map((update) => update.group ?? update.groupId).filter(Boolean))];
  if (groups.length !== 1) fail(`eas update returned ${groups.length} update groups instead of one.`);

  const publishedPlatforms = [...new Set(updates.map((update) => update.platform))].sort();
  if (publishedPlatforms.join(',') !== [...platforms].sort().join(',')) {
    fail(`eas update published ${publishedPlatforms.join(', ')} instead of ${platforms.join(', ')}.`);
  }

  const wrongRuntime = updates.filter((update) => update.runtimeVersion !== runtimeVersion);
  if (wrongRuntime.length > 0) {
    fail(`eas update targeted runtime ${wrongRuntime[0].runtimeVersion} instead of ${runtimeVersion}; no installed binary will receive it.`);
  }

  return {
    group: groups[0],
    updates: updates.map((update) => ({ id: update.id, platform: update.platform })),
  };
}

// npm exports npm_config_* into its children; expo-doctor's nested `npm explain`
// calls fail under them, so the gate runs with the lifecycle variables removed.
export function withoutNpmLifecycleEnv(env) {
  return Object.fromEntries(
    Object.entries(env).filter(([key]) => !key.toLowerCase().startsWith('npm_')),
  );
}

function runInherited(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: workspaceRoot, stdio: 'inherit', windowsHide: true, ...options });
  if (result.error) throw result.error;
  return result.status;
}

function verifyPublishableCommit() {
  if (git(['status', '--porcelain=v1', '--untracked-files=all'])) {
    fail('The working tree is not clean. Commit and push first so the update maps to exactly one commit.');
  }
  if (git(['rev-parse', '--abbrev-ref', 'HEAD']) !== 'main') fail('Publish from the main branch.');

  git(['fetch', '--quiet', 'origin', 'main']);
  const head = git(['rev-parse', 'HEAD']);
  if (head !== git(['rev-parse', 'origin/main'])) fail('HEAD is not origin/main. Push (or pull) first.');
  return head;
}

function main() {
  const options = parsePublishArguments(process.argv.slice(2));
  const runtimeVersion = readRuntimeVersion(readFileSync(join(workspaceRoot, 'app.config.ts'), 'utf8'));
  const records = selectBinaryRecords(JSON.parse(readFileSync(binaryRecordsPath, 'utf8')), {
    runtimeVersion,
    platforms: options.platforms,
  });
  const head = verifyPublishableCommit();

  for (const record of records) {
    if (!isAncestor(record.sourceSha, head)) {
      fail(`The ${record.platform} store binary commit ${record.sourceSha} is not an ancestor of HEAD.`);
    }
    const result = classifyGitRange(record.sourceSha, head, workspaceRoot);
    console.log(
      `[ota] ${record.platform}: ${result.status} since binary ${record.sourceSha.slice(0, 10)} ` +
        `(runtime ${result.runtime.length}, non-shipping ${result.support.length} files)`,
    );
    if (result.status !== OTA_SAFE) {
      const blockers = [...result.native, ...result.unknown];
      fail(
        `${record.platform} cannot receive this change over the air (${result.status}).` +
          (blockers.length ? ` Blocking files: ${blockers.join(', ')}` : ' Nothing app-facing changed.'),
      );
    }
    const backend = result.support.filter((file) => file.startsWith('supabase/') || file.startsWith('infra/'));
    if (backend.length > 0) {
      console.log(`[ota] Backend files changed too; deploy them before users get this update: ${backend.join(', ')}`);
    }
  }

  const eas = resolveEasInvocation();
  if (runInherited(eas.command, [...eas.prefix, 'whoami']) !== 0) fail('eas is not logged in.');

  console.log('[ota] Running npm run check:release before publishing.');
  const gateStatus = runInherited('npm run check:release', [], {
    env: withoutNpmLifecycleEnv(process.env),
    shell: true,
  });
  if (gateStatus !== 0) fail('npm run check:release failed.');

  const args = buildEasUpdateArguments({
    message: options.message,
    platforms: options.platforms,
    rolloutPercentage: options.rolloutPercentage,
    sourceSha: head,
  });
  if (options.dryRun) {
    console.log(`[ota] Dry run passed every gate. Would run: eas ${args.join(' ')}`);
    return;
  }

  const publish = spawnSync(eas.command, [...eas.prefix, ...args], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    env: { ...process.env, EXPO_PUBLIC_RELEASE_ENVIRONMENT: OTA_CHANNEL },
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
    windowsHide: true,
  });
  if (publish.error) throw publish.error;
  if (publish.status !== 0) fail('eas update failed; nothing was confirmed as published.');

  const summary = summarizeUpdateOutput(publish.stdout, { platforms: options.platforms, runtimeVersion: runtimeVersion });
  const lines = [
    `[ota] Published group ${summary.group} to ${OTA_CHANNEL} runtime ${runtimeVersion} for ${options.platforms.join(' + ')} at ${options.rolloutPercentage}%.`,
    ...summary.updates.map((update) => `[ota]   ${update.platform}: ${update.id}`),
    '[ota] Users receive it on their next app start and run it on the start after that.',
  ];
  if (options.rolloutPercentage < 100) {
    lines.push(
      `[ota] Widen: eas update:edit ${summary.group} --rollout-percentage <n> --non-interactive`,
      `[ota] Stop:  eas update:revert-update-rollout --group ${summary.group} --non-interactive`,
    );
  } else {
    lines.push(
      `[ota] Undo:  eas update:rollback ${summary.group} --platform ${args[args.indexOf('--platform') + 1]} --non-interactive`,
    );
  }
  console.log(lines.join('\n'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(`[ota] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
