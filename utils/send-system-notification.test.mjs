import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseBroadcastArguments,
  runBroadcastNotification,
} from './send-system-notification.mjs';

const fixedKey = '00000000-0000-4000-8000-000000000001';

test('broadcast retry requires the previously printed idempotency key', () => {
  assert.throws(
    () => parseBroadcastArguments(['--title', 'Title', '--message', 'Body', '--retry']),
    /--retry mevcut bir --idempotency-key gerektirir/u,
  );

  assert.deepEqual(
    parseBroadcastArguments([
      '--title', ' Title ', '--message', ' Body ', '--retry', '--idempotency-key', fixedKey,
      '--user-id', 'user-a', '--user-id', 'user-a',
    ]),
    {
      dryRun: false,
      idempotencyKey: fixedKey,
      message: 'Body',
      retry: true,
      title: 'Title',
      userIds: ['user-a'],
    },
  );
});

test('broadcast CLI prints the key before an ambiguous request and never echoes a response payload', async () => {
  const output = [];
  const errors = [];
  const options = parseBroadcastArguments(['--title', 'Title', '--message', 'Body'], () => fixedKey);
  const result = await runBroadcastNotification(options, {
    fetchImpl: async () => { throw new Error('network'); },
    runtime: {
      adminToken: 'private-token',
      publishableKey: undefined,
      supabaseUrl: 'https://example.supabase.co',
    },
    writeError: (line) => errors.push(line),
    writeOutput: (line) => output.push(line),
  });

  assert.equal(result.success, false);
  assert.match(output[0], new RegExp(fixedKey, 'u'));
  assert.match(errors[0], /Ayni anahtar ile --retry/u);
});
