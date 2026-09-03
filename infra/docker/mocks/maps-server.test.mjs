import assert from 'node:assert/strict';
import test from 'node:test';

const baseUrl = process.env.MAPS_MOCK_BASE_URL;

if (!baseUrl) {
  throw new Error('MAPS_MOCK_BASE_URL is required for the Docker verification contract test.');
}

const getMaps = (mode, address = 'Istanbul') =>
  fetch(`${baseUrl}/maps/api/geocode/json?mode=${encodeURIComponent(mode)}&address=${encodeURIComponent(address)}`, {
    redirect: 'error',
    signal: AbortSignal.timeout(3_000),
  });

const getJson = (pathName) =>
  fetch(`${baseUrl}${pathName}`, {
    redirect: 'error',
    signal: AbortSignal.timeout(3_000),
  });

const postJson = (pathName, body) =>
  fetch(`${baseUrl}${pathName}`, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(3_000),
  });

test('verification mock exposes a deterministic no-store health contract', async () => {
  const response = await getJson('/health');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') || '', /no-store/u);
  assert.equal(response.headers.get('x-sorita-deterministic-mock'), 'verification-v2');
  assert.deepEqual(await response.json(), { ok: true, service: 'verification-mock', version: 2 });
});

test('maps origin covers success, zero results, invalid, quota and provider failure', async () => {
  const success = await getMaps('success');
  assert.equal(success.status, 200);
  assert.equal((await success.json()).status, 'OK');

  const zero = await getMaps('zero-results');
  assert.equal(zero.status, 200);
  assert.deepEqual(await zero.json(), { results: [], status: 'ZERO_RESULTS' });

  assert.equal((await getMaps('invalid')).status, 400);

  const quota = await getMaps('rate-limit');
  assert.equal(quota.status, 429);
  assert.equal(quota.headers.get('retry-after'), '2');

  assert.equal((await getMaps('server-error')).status, 503);
});

test('maps origin exposes a deterministic timeout fixture', async () => {
  await assert.rejects(
    fetch(`${baseUrl}/maps/api/geocode/json?mode=timeout&address=Istanbul`, {
      signal: AbortSignal.timeout(100),
    }),
    (error) => error?.name === 'TimeoutError' || error?.name === 'AbortError',
  );
});

test('representative Supabase read contract is deterministic and bounded', async () => {
  const response = await getJson('/supabase/rest/v1/profiles?select=id,username&limit=20');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    count: 1,
    rows: [{ id: '00000000-0000-4000-8000-000000000001', username: 'synthetic-user' }],
  });

  assert.equal((await getJson('/supabase/rest/v1/profiles?mode=rate-limit')).status, 429);
  assert.equal((await getJson('/supabase/rest/v1/profiles?mode=server-error')).status, 503);
});

test('media finalize, offline outbox and push origins enforce representative inputs', async () => {
  const media = await postJson('/functions/v1/media-upload-finalize', {
    uploadId: 'synthetic-upload-id',
  });
  assert.equal(media.status, 200);
  assert.deepEqual(await media.json(), {
    bucket: 'user-media',
    objectPath: 'synthetic/user-media-fixture.jpg',
    status: 'finalized',
  });

  const outbox = await postJson('/functions/v1/offline-outbox', {
    eventId: 'synthetic-outbox-event',
    operation: 'sync',
  });
  assert.equal(outbox.status, 200);
  assert.deepEqual(await outbox.json(), {
    eventId: 'synthetic-outbox-event',
    status: 'accepted',
  });

  const push = await postJson('/functions/v1/admin-broadcast-notification', {
    audience: 'test',
    notificationId: 'synthetic-notification',
  });
  assert.equal(push.status, 200);
  assert.deepEqual(await push.json(), { accepted: 1, notificationId: 'synthetic-notification' });

  assert.equal(
    (await postJson('/functions/v1/media-upload-finalize', { uploadId: 'unknown' })).status,
    400,
  );
  assert.equal(
    (await postJson('/functions/v1/offline-outbox', { eventId: 'unknown', operation: 'sync' })).status,
    400,
  );
  assert.equal(
    (
      await postJson('/functions/v1/admin-broadcast-notification', {
        audience: 'production',
        notificationId: 'synthetic-notification',
      })
    ).status,
    400,
  );
});

test('load-flow fixtures cover discovery, lists, social, auth gateway and edge contracts', async () => {
  const discovery = await getJson('/verification/discovery?limit=20');
  assert.equal(discovery.status, 200);
  assert.equal((await discovery.json()).items[0].id, 'synthetic-discovery-item');

  const lists = await getJson('/verification/lists?limit=20');
  assert.equal(lists.status, 200);
  assert.equal((await lists.json()).items[0].id, 'synthetic-list');

  const social = await getJson('/verification/social?limit=20');
  assert.equal(social.status, 200);
  assert.equal((await social.json()).items[0].id, 'synthetic-activity');

  const auth = await postJson('/functions/v1/auth-gateway', { operation: 'refresh' });
  assert.equal(auth.status, 200);
  assert.deepEqual(await auth.json(), { ok: true, session: { expiresIn: 3_600 } });

  const edge = await getJson('/verification/edge');
  assert.equal(edge.status, 200);
  assert.deepEqual(await edge.json(), { ok: true, policy: 'no-store', region: 'synthetic' });
});

test('verification mock rejects wrong methods and oversized request bodies', async () => {
  const wrongMethod = await postJson('/verification/discovery', {});
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get('allow'), 'GET');

  const oversized = await postJson('/functions/v1/media-upload-finalize', {
    padding: 'x'.repeat(17 * 1024),
    uploadId: 'synthetic-upload-id',
  });
  assert.equal(oversized.status, 413);
  assert.deepEqual(await oversized.json(), { error: 'payload_too_large' });
});
