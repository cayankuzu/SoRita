import { createServer } from 'node:http';

const host = process.env.MAPS_MOCK_HOST || '127.0.0.1';
const port = Number.parseInt(process.env.MAPS_MOCK_PORT || '8789', 10);
const maximumBodyBytes = 16 * 1024;

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('MAPS_MOCK_PORT must be an integer between 1 and 65535.');
}

const sendJson = (response, status, payload, extraHeaders = {}) => {
  response.writeHead(status, {
    'cache-control': 'private, no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'x-sorita-deterministic-mock': 'verification-v2',
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
};

const readJsonBody = async (request) => {
  const chunks = [];
  let totalBytes = 0;
  let tooLarge = false;

  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > maximumBodyBytes) {
      tooLarge = true;
    } else {
      chunks.push(chunk);
    }
  }

  if (tooLarge) return { error: 'payload_too_large', status: 413 };
  if (chunks.length === 0) return { value: {} };

  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { error: 'invalid_json_object', status: 400 };
    }
    return { value };
  } catch {
    return { error: 'invalid_json', status: 400 };
  }
};

const applyFailureMode = async (url, response) => {
  const mode = url.searchParams.get('mode') || 'success';

  if (mode === 'timeout') {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  if (mode === 'rate-limit') {
    sendJson(
      response,
      429,
      { error: 'synthetic_rate_limit' },
      { 'retry-after': '2' },
    );
    return { handled: true, mode };
  }
  if (mode === 'server-error') {
    sendJson(response, 503, { error: 'synthetic_provider_outage' });
    return { handled: true, mode };
  }
  if (!['success', 'timeout', 'large', 'zero-results', 'invalid'].includes(mode)) {
    sendJson(response, 400, { error: 'unsupported_fixture_mode' });
    return { handled: true, mode };
  }

  return { handled: false, mode };
};

const withLargeFixture = (mode, payload) =>
  mode === 'large' ? { ...payload, padding: 'x'.repeat(64 * 1024) } : payload;

const routes = new Map([
  [
    '/supabase/rest/v1/profiles',
    {
      method: 'GET',
      respond: ({ mode }) =>
        withLargeFixture(mode, {
          count: 1,
          rows: [{ id: '00000000-0000-4000-8000-000000000001', username: 'synthetic-user' }],
        }),
    },
  ],
  [
    '/functions/v1/media-upload-finalize',
    {
      method: 'POST',
      respond: ({ body, mode }) => {
        if (body.uploadId !== 'synthetic-upload-id') return { error: 'invalid_upload_id', status: 400 };
        return withLargeFixture(mode, {
          bucket: 'user-media',
          objectPath: 'synthetic/user-media-fixture.jpg',
          status: 'finalized',
        });
      },
    },
  ],
  [
    '/functions/v1/offline-outbox',
    {
      method: 'POST',
      respond: ({ body, mode }) => {
        if (body.eventId !== 'synthetic-outbox-event' || body.operation !== 'sync') {
          return { error: 'invalid_outbox_event', status: 400 };
        }
        return withLargeFixture(mode, { eventId: body.eventId, status: 'accepted' });
      },
    },
  ],
  [
    '/functions/v1/admin-broadcast-notification',
    {
      method: 'POST',
      respond: ({ body, mode }) => {
        if (body.notificationId !== 'synthetic-notification' || body.audience !== 'test') {
          return { error: 'invalid_push_request', status: 400 };
        }
        return withLargeFixture(mode, { accepted: 1, notificationId: body.notificationId });
      },
    },
  ],
  [
    '/verification/discovery',
    {
      method: 'GET',
      respond: ({ mode }) =>
        withLargeFixture(mode, {
          items: [{ id: 'synthetic-discovery-item', score: 0.99 }],
          nextCursor: null,
        }),
    },
  ],
  [
    '/verification/lists',
    {
      method: 'GET',
      respond: ({ mode }) =>
        withLargeFixture(mode, {
          items: [{ id: 'synthetic-list', itemCount: 1, title: 'Synthetic list' }],
          nextCursor: null,
        }),
    },
  ],
  [
    '/verification/social',
    {
      method: 'GET',
      respond: ({ mode }) =>
        withLargeFixture(mode, {
          items: [{ actorId: 'synthetic-user', id: 'synthetic-activity', kind: 'follow' }],
          nextCursor: null,
        }),
    },
  ],
  [
    '/functions/v1/auth-gateway',
    {
      method: 'POST',
      respond: ({ body, mode }) => {
        if (body.operation !== 'refresh') return { error: 'invalid_auth_operation', status: 400 };
        return withLargeFixture(mode, { ok: true, session: { expiresIn: 3_600 } });
      },
    },
  ],
  [
    '/verification/edge',
    {
      method: 'GET',
      respond: ({ mode }) =>
        withLargeFixture(mode, { ok: true, policy: 'no-store', region: 'synthetic' }),
    },
  ],
]);

const handleMapsRoute = async (request, response, url) => {
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'method_not_allowed' }, { allow: 'GET' });
    return;
  }

  const failure = await applyFailureMode(url, response);
  if (failure.handled) return;

  const address = url.searchParams.get('address') || '';
  if (failure.mode === 'invalid' || address.length > 256) {
    sendJson(response, 400, { error_message: 'invalid synthetic request', status: 'INVALID_REQUEST' });
    return;
  }
  if (failure.mode === 'zero-results') {
    sendJson(response, 200, { results: [], status: 'ZERO_RESULTS' });
    return;
  }

  sendJson(
    response,
    200,
    withLargeFixture(failure.mode, {
      results: [
        {
          formatted_address: 'Synthetic fixture, Istanbul, TR',
          geometry: {
            location: { lat: 41.0082, lng: 28.9784 },
            location_type: 'APPROXIMATE',
          },
          place_id: 'synthetic-place-id',
          types: ['locality'],
        },
      ],
      status: 'OK',
    }),
  );
};

const server = createServer(
  {
    headersTimeout: 2_000,
    keepAliveTimeout: 1_000,
    maxRequestsPerSocket: 100,
    requestTimeout: 2_000,
  },
  async (request, response) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'maps-mock'}`);

      if (url.pathname === '/health') {
        if (request.method !== 'GET') {
          sendJson(response, 405, { error: 'method_not_allowed' }, { allow: 'GET' });
          return;
        }
        sendJson(response, 200, { ok: true, service: 'verification-mock', version: 2 });
        return;
      }

      if (url.pathname === '/maps/api/geocode/json') {
        await handleMapsRoute(request, response, url);
        return;
      }

      const route = routes.get(url.pathname);
      if (!route) {
        sendJson(response, 404, { error: 'not_found' });
        return;
      }
      if (request.method !== route.method) {
        sendJson(response, 405, { error: 'method_not_allowed' }, { allow: route.method });
        return;
      }

      const failure = await applyFailureMode(url, response);
      if (failure.handled) return;

      const bodyResult = route.method === 'POST' ? await readJsonBody(request) : { value: {} };
      if (bodyResult.error) {
        sendJson(response, bodyResult.status, { error: bodyResult.error });
        return;
      }

      const payload = route.respond({ body: bodyResult.value, mode: failure.mode, url });
      const status = Number.isInteger(payload.status) ? payload.status : 200;
      if (status !== 200) {
        const { status: _status, ...errorPayload } = payload;
        sendJson(response, status, errorPayload);
        return;
      }
      sendJson(response, status, payload);
    } catch {
      if (!response.headersSent) sendJson(response, 500, { error: 'synthetic_mock_failure' });
      else response.destroy();
    }
  },
);

server.listen(port, host, () => {
  process.stdout.write(`${JSON.stringify({ event: 'verification_mock_ready', host, port })}\n`);
});

const close = (signal) => {
  server.close((error) => {
    if (error) {
      process.stderr.write(`${JSON.stringify({ event: 'verification_mock_close_failed', signal })}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`${JSON.stringify({ event: 'verification_mock_stopped', signal })}\n`);
  });
};

process.once('SIGINT', () => close('SIGINT'));
process.once('SIGTERM', () => close('SIGTERM'));
