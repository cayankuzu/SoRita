import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseArguments,
  requireRuntimeEnvironment,
  runMediaUploadSweep,
} from './sweep-media-upload-sessions.mjs';

test('parses bounded dry-run and apply arguments', () => {
  assert.deepEqual(parseArguments([]), {
    apply: false,
    limit: 100,
    maxBatches: 10,
    pruneBefore: null,
  });
  assert.deepEqual(
    parseArguments(['--apply', '--limit', '25', '--max-batches', '2']),
    { apply: true, limit: 25, maxBatches: 2, pruneBefore: null },
  );
  assert.throws(() => parseArguments(['--limit', '0']), /between 1 and 500/u);
  assert.throws(() => parseArguments(['--max-batches', '101']), /between 1 and 100/u);
});

test('requires HTTPS service-role runtime and explicit apply confirmation', () => {
  assert.throws(
    () => requireRuntimeEnvironment({ apply: false }, {}),
    /SUPABASE_URL/u,
  );
  assert.throws(
    () => requireRuntimeEnvironment(
      { apply: true },
      { SUPABASE_SERVICE_ROLE_KEY: 'secret', SUPABASE_URL: 'https://example.supabase.co' },
    ),
    /SORITA_MEDIA_SWEEP_CONFIRM/u,
  );
  assert.deepEqual(
    requireRuntimeEnvironment(
      { apply: true },
      {
        SORITA_MEDIA_SWEEP_CONFIRM: 'SWEEP_STALE_MEDIA_UPLOADS',
        SUPABASE_SERVICE_ROLE_KEY: 'secret',
        SUPABASE_URL: 'https://example.supabase.co',
      },
    ),
    { serviceRoleKey: 'secret', supabaseUrl: 'https://example.supabase.co' },
  );
});

test('dry-run inventories without claiming or deleting', async () => {
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push({ args, name });
      return {
        data: [
          { delete_destination: true, destination_referenced: false },
          { delete_destination: false, destination_referenced: true },
        ],
        error: null,
      };
    },
    storage: { from: () => assert.fail('dry-run must not access Storage') },
  };
  const result = await runMediaUploadSweep({
    client,
    options: { apply: false, limit: 20, maxBatches: 1, pruneBefore: null },
  });
  assert.deepEqual(result, {
    destinationDeletes: 1,
    dryRun: true,
    eligible: 2,
    referencedDestinations: 1,
  });
  assert.deepEqual(calls.map(({ name }) => name), ['list_stale_media_upload_sessions']);
});

test('apply removes only ledger-authorized paths and records every result', async () => {
  const rpcCalls = [];
  const removals = [];
  let claimCount = 0;
  const rows = [
    {
      delete_destination: false,
      destination_bucket: 'place-media',
      destination_path: 'user/final.jpg',
      destination_referenced: true,
      previous_status: 'finalized',
      session_id: '11111111-1111-4111-8111-111111111111',
      upload_bucket: 'place-media-private',
      upload_path: 'user/pending-public/place-media/final.jpg',
    },
    {
      delete_destination: true,
      destination_bucket: 'profile-media',
      destination_path: 'user/avatar.jpg',
      destination_referenced: false,
      previous_status: 'cleanup_pending',
      session_id: '22222222-2222-4222-8222-222222222222',
      upload_bucket: 'place-media-private',
      upload_path: 'user/pending-public/profile-media/avatar.jpg',
    },
  ];
  const client = {
    rpc: async (name, args) => {
      rpcCalls.push({ args, name });
      if (name === 'claim_stale_media_upload_sessions') {
        claimCount += 1;
        return { data: claimCount === 1 ? rows : [], error: null };
      }
      if (name === 'renew_media_upload_session_cleanup') {
        return { data: true, error: null };
      }
      if (name === 'check_media_upload_session_cleanup_reference') {
        const row = rows.find((candidate) => candidate.session_id === args.p_session_id);
        return {
          data: [{
            delete_destination: row.delete_destination,
            destination_referenced: row.destination_referenced,
            previous_status: row.previous_status,
          }],
          error: null,
        };
      }
      if (name === 'complete_media_upload_session_cleanup') {
        return { data: true, error: null };
      }
      throw new Error(`unexpected RPC ${name}`);
    },
    storage: {
      from: (bucket) => ({
        remove: async (paths) => {
          removals.push({ bucket, paths });
          return { error: null };
        },
      }),
    },
  };
  const result = await runMediaUploadSweep({
    client,
    options: { apply: true, limit: 100, maxBatches: 2, pruneBefore: null },
  });

  assert.equal(result.failed, 0);
  assert.equal(result.cleaned, 2);
  assert.deepEqual(removals, [
    { bucket: 'place-media-private', paths: ['user/pending-public/place-media/final.jpg'] },
    { bucket: 'place-media-private', paths: ['user/pending-public/profile-media/avatar.jpg'] },
    { bucket: 'profile-media', paths: ['user/avatar.jpg'] },
  ]);
  const completions = rpcCalls.filter(({ name }) => name === 'complete_media_upload_session_cleanup');
  assert.equal(completions.length, 2);
  assert.equal(completions[0].args.p_destination_retained, true);
  assert.equal(completions[1].args.p_destination_retained, false);
});

test('cleanup failures are recorded and reported for alerting', async () => {
  let claimCount = 0;
  const completionCalls = [];
  const client = {
    rpc: async (name, args) => {
      if (name === 'claim_stale_media_upload_sessions') {
        claimCount += 1;
        return {
          data: claimCount === 1
            ? [{
                delete_destination: true,
                destination_bucket: 'place-media-private',
                destination_path: 'user/file.jpg',
                destination_referenced: false,
                previous_status: 'pending',
                session_id: '33333333-3333-4333-8333-333333333333',
                upload_bucket: 'place-media-private',
                upload_path: 'user/file.jpg',
              }]
            : [],
          error: null,
        };
      }
      if (name === 'renew_media_upload_session_cleanup') {
        return { data: true, error: null };
      }
      if (name === 'check_media_upload_session_cleanup_reference') {
        return {
          data: [{
            delete_destination: true,
            destination_referenced: false,
            previous_status: 'pending',
          }],
          error: null,
        };
      }
      completionCalls.push(args);
      return { data: true, error: null };
    },
    storage: {
      from: () => ({ remove: async () => ({ error: new Error('storage unavailable') }) }),
    },
  };
  const result = await runMediaUploadSweep({
    client,
    options: { apply: true, limit: 100, maxBatches: 2, pruneBefore: null },
  });
  assert.equal(result.failed, 1);
  assert.equal(completionCalls[0].p_success, false);
  assert.match(completionCalls[0].p_error, /storage unavailable/u);
});

test('referenced finalized private media is retained without any Storage delete', async () => {
  let claimCount = 0;
  const removals = [];
  const completions = [];
  const client = {
    rpc: async (name, args) => {
      if (name === 'claim_stale_media_upload_sessions') {
        claimCount += 1;
        return {
          data: claimCount === 1
            ? [{
                delete_destination: false,
                destination_bucket: 'place-media-private',
                destination_path: 'user/live.jpg',
                destination_referenced: true,
                previous_status: 'finalized',
                session_id: '44444444-4444-4444-8444-444444444444',
                upload_bucket: 'place-media-private',
                upload_path: 'user/live.jpg',
              }]
            : [],
          error: null,
        };
      }
      if (name === 'renew_media_upload_session_cleanup') {
        return { data: true, error: null };
      }
      if (name === 'check_media_upload_session_cleanup_reference') {
        return {
          data: [{
            delete_destination: false,
            destination_referenced: true,
            previous_status: 'finalized',
          }],
          error: null,
        };
      }
      completions.push(args);
      return { data: true, error: null };
    },
    storage: {
      from: (bucket) => ({
        remove: async (paths) => {
          removals.push({ bucket, paths });
          return { error: null };
        },
      }),
    },
  };
  const result = await runMediaUploadSweep({
    client,
    options: { apply: true, limit: 100, maxBatches: 2, pruneBefore: null },
  });
  assert.equal(result.cleaned, 1);
  assert.deepEqual(removals, []);
  assert.equal(completions[0].p_destination_retained, true);
});
