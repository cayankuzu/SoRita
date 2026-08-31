import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRequestSignature, sha256Hex } from '../_shared/requestSecurity';
import { createModerationReportsHandler } from './handler';

function createDeps(options?: {
  insertError?: { code?: string; message: string } | null;
  insertData?: Record<string, unknown> | null;
  updateError?: { message: string } | null;
  emailError?: string | null;
  reportEmailFrom?: string;
  userResult?: {
    data?: { user?: { id?: string } | null } | null;
    error?: { message: string } | null;
  };
  rateLimited?: boolean;
  rateLimitError?: boolean;
  rowErrors?: Partial<Record<'list_place_comments' | 'list_places' | 'lists' | 'profiles', { message: string }>>;
  rows?: Partial<Record<'list_place_comments' | 'list_places' | 'lists' | 'profiles', Record<string, unknown>>>;
  visibilityErrors?: Partial<Record<'list_place_comments' | 'list_places' | 'lists' | 'profiles', { message: string }>>;
  visibleRows?: Partial<Record<'list_place_comments' | 'list_places' | 'lists' | 'profiles', Record<string, unknown> | null>>;
  useDefaultEmail?: boolean;
  configOverrides?: Partial<{
    allowedOrigins: string[];
    brevoApiKey?: string;
    reportEmailFrom?: string;
    reportEmailTo: string;
    resendApiKey?: string;
    supabasePublishableKey: string;
    supabaseServiceRoleKey: string;
    supabaseUrl: string;
  }>;
}) {
  const nonceDeleteLtMock = vi.fn().mockResolvedValue({ error: null });
  const seenNonces = new Set<string>();
  const moderationReportInsertMock = vi.fn().mockResolvedValue({
    data: options?.insertError ? null : options?.insertData === undefined ? { id: 'report-1' } : options.insertData,
    error: options?.insertError ?? null,
  });
  const moderationReportUpdateEqMock = vi.fn().mockResolvedValue({ error: options?.updateError ?? null });
  const sendEmailMock = vi.fn().mockResolvedValue({ error: options?.emailError ?? null });

  const handler = createModerationReportsHandler({
    config: {
      allowedOrigins: ['http://localhost:5173'],
      reportEmailFrom: options?.reportEmailFrom ?? 'reports@sorita.app',
      reportEmailTo: 'memodee333@gmail.com',
      resendApiKey: 'resend-key',
      supabasePublishableKey: 'anon-key',
      supabaseServiceRoleKey: 'service-role',
      supabaseUrl: 'https://example.supabase.co',
      ...options?.configOverrides,
    },
    createAdminClient: () => ({
      from: (table: string) => {
        if (table === 'request_nonces') {
          return {
            delete: () => ({
              lt: nonceDeleteLtMock,
            }),
            insert: vi.fn().mockImplementation(async (payload: { nonce?: string }) => {
              if (payload?.nonce && seenNonces.has(payload.nonce)) {
                return {
                  error: {
                    code: '23505',
                    message: 'duplicate nonce',
                  },
                };
              }

              if (payload?.nonce) {
                seenNonces.add(payload.nonce);
              }

              return { error: null };
            }),
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            update: () => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }

        if (table === 'moderation_reports') {
          return {
            delete: () => ({
              lt: vi.fn().mockResolvedValue({ error: null }),
            }),
            insert: () => ({
              select: () => ({
                maybeSingle: moderationReportInsertMock,
              }),
            }),
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            update: vi.fn(() => ({
              eq: moderationReportUpdateEqMock,
            })),
          };
        }

        const tableName = table as 'list_place_comments' | 'list_places' | 'lists' | 'profiles';
        const row = options?.rows?.[tableName] ?? null;
        const rowError = options?.rowErrors?.[tableName] ?? null;
        return {
          delete: () => ({
            lt: vi.fn().mockResolvedValue({ error: null }),
          }),
          insert: () => ({
            select: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: row, error: rowError }),
            }),
          }),
          update: () => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      },
      rpc: vi.fn().mockResolvedValue({
        data: {
          allowed: !options?.rateLimited,
          remaining: options?.rateLimited ? 0 : 11,
          retry_after_seconds: options?.rateLimited ? 30 : 1,
        },
        error: options?.rateLimitError ? { message: 'rate limit unavailable' } : null,
      }),
    }),
    createAuthClient: () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue(options?.userResult ?? {
          data: {
            user: {
              id: 'user-1',
            },
          },
          error: null,
        }),
      },
      from: (table: string) => {
        const tableName = table as 'list_place_comments' | 'list_places' | 'lists' | 'profiles';
        const hasVisibilityOverride = Object.prototype.hasOwnProperty.call(
          options?.visibleRows ?? {},
          tableName,
        );
        const row = hasVisibilityOverride
          ? options?.visibleRows?.[tableName] ?? null
          : options?.rows?.[tableName] ?? null;
        const error = options?.visibilityErrors?.[tableName] ?? options?.rowErrors?.[tableName] ?? null;
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: row, error }),
            }),
          }),
        };
      },
    }),
    createRequestId: () => 'request-1',
    sendEmail: options?.useDefaultEmail ? undefined : sendEmailMock,
  });

  return {
    handler,
    moderationReportInsertMock,
    moderationReportUpdateEqMock,
    nonceDeleteLtMock,
    sendEmailMock,
  };
}

describe('moderation-reports handler', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  let signedHeaderCounter = 0;

  async function createSignedHeaders(body: string) {
    signedHeaderCounter += 1;
    const deviceId = `device-1234-${signedHeaderCounter}`;
    const nonce = `nonce-1234-5678-90ab-${signedHeaderCounter}`;
    const timestamp = Date.now().toString();
    const payloadHash = await sha256Hex(body);
    const signature = await createRequestSignature('token-1', {
      deviceId,
      functionName: 'moderation-reports',
      method: 'POST',
      nonce,
      payloadHash,
      timestamp,
    });

    return {
      Authorization: 'Bearer token-1',
      'x-device-id': deviceId,
      'x-nonce': nonce,
      'x-signature': signature,
      'x-timestamp': timestamp,
    };
  }

  async function signedRequest(payload: unknown, options: { method?: string; origin?: string } = {}) {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const headers = new Headers(await createSignedHeaders(body));
    headers.set('content-type', 'application/json');
    if (options.origin) headers.set('Origin', options.origin);
    return new Request('https://example.supabase.co/functions/v1/moderation-reports', {
      body: options.method === 'GET' || options.method === 'OPTIONS' ? undefined : body,
      headers,
      method: options.method ?? 'POST',
    });
  }

  it('stores a list report and sends a moderation email', async () => {
    const { handler, moderationReportUpdateEqMock, sendEmailMock } = createDeps({
      rows: {
        lists: {
          id: 'list-1',
          owner_id: 'owner-1',
          name: 'Hidden gems',
          is_public: true,
        },
        profiles: {
          id: 'owner-1',
          name: 'Owner',
          username: 'owner',
          email: 'owner@example.com',
        },
      },
    });
    const body = JSON.stringify({
      listId: 'list-1',
      reason: 'Spam',
      reporterUserId: 'user-1',
      targetType: 'list',
    });

    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/moderation-reports', {
        method: 'POST',
        headers: await createSignedHeaders(body),
        body,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      deliveryStatus: 'sent',
      reportId: 'report-1',
      success: true,
    });
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '[SoRita] Yeni liste sikayeti',
        to: 'memodee333@gmail.com',
      }),
    );
    const email = sendEmailMock.mock.calls[0]?.[0];
    expect(email?.text).toContain('Report ID: report-1');
    expect(email?.text).not.toContain('Hidden gems');
    expect(email?.text).not.toContain('owner@example.com');
    expect(email?.text).not.toContain('Spam');
    expect(moderationReportUpdateEqMock).toHaveBeenCalledWith('id', 'report-1');
  });

  it('returns duplicate_report when the same moderation report already exists', async () => {
    const { handler, sendEmailMock } = createDeps({
      insertError: {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      },
      rows: {
        list_places: {
          id: 'place-1',
          list_id: 'list-1',
          name: 'Cafe',
        },
        lists: {
          id: 'list-1',
          owner_id: 'owner-1',
          name: 'Favorites',
        },
        profiles: {
          id: 'owner-1',
          name: 'Owner',
          username: 'owner',
          email: 'owner@example.com',
        },
      },
    });
    const body = JSON.stringify({
      placeId: 'place-1',
      reason: 'Spam',
      reporterUserId: 'user-1',
      targetType: 'place',
    });

    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/moderation-reports', {
        method: 'POST',
        headers: await createSignedHeaders(body),
        body,
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'duplicate_report',
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('handles CORS, unsupported methods, fallback origins, and incomplete configuration', async () => {
    const fallback = createDeps({ configOverrides: { allowedOrigins: [] } }).handler;
    const preflight = await fallback(await signedRequest({}, {
      method: 'OPTIONS', origin: 'http://127.0.0.1:3000',
    }));
    expect(preflight.status).toBe(200);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('null');

    expect((await fallback(await signedRequest({}, { method: 'GET' }))).status).toBe(405);

    for (const configOverrides of [
      { supabaseUrl: '' },
      { supabasePublishableKey: ' ' },
      { supabaseServiceRoleKey: '' },
    ]) {
      const response = await createDeps({ configOverrides }).handler(await signedRequest({}));
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({ code: 'misconfigured' });
    }
  });

  it('rejects missing/invalid auth, unsigned requests, malformed input, and reporter spoofing', async () => {
    const { handler } = createDeps();
    const missing = await handler(new Request('https://example.supabase.co/functions/v1/moderation-reports', {
      body: '{}', method: 'POST',
    }));
    expect(missing.status).toBe(401);
    await expect(missing.json()).resolves.toMatchObject({ code: 'missing_authorization' });

    for (const userResult of [
      { data: { user: null }, error: null },
      { data: { user: { id: ' ' } }, error: null },
      { data: null, error: { message: 'expired' } },
    ]) {
      const invalid = createDeps({ userResult });
      const response = await invalid.handler(await signedRequest({}));
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ code: 'invalid_token' });
    }

    const unsigned = await handler(new Request('https://example.supabase.co/functions/v1/moderation-reports', {
      body: '{}', headers: { Authorization: 'Bearer token-1' }, method: 'POST',
    }));
    expect(unsigned.status).toBe(401);
    await expect(unsigned.json()).resolves.toMatchObject({ code: 'invalid_signature' });

    for (const payload of [
      {},
      { targetType: 'unknown' },
      { targetType: 'user', reporterUserId: 'user-1', targetUserId: '', reason: 'Spam' },
      { targetType: 'list', reporterUserId: 'user-1', listId: 'list-1', reason: '' },
      { targetType: 'place', reporterUserId: 'user-1', placeId: 'place-1', reason: 'x'.repeat(161) },
      { targetType: 'comment', reporterUserId: 'user-1', commentId: 'comment-1', reason: 'Spam', details: 'x'.repeat(2001) },
    ]) {
      const response = await handler(await signedRequest(payload));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ code: 'invalid_input' });
    }

    const spoofed = await handler(await signedRequest({
      targetType: 'user', reporterUserId: 'another-user', targetUserId: 'target-1', reason: 'Spam',
    }));
    expect(spoofed.status).toBe(403);
    await expect(spoofed.json()).resolves.toMatchObject({ code: 'reporter_mismatch' });
  });

  it('rate limits reports and fails closed when rate-limit storage fails', async () => {
    const payload = { targetType: 'user', reporterUserId: 'user-1', targetUserId: 'target-1', reason: 'Spam' };
    const limited = createDeps({ rateLimited: true });
    const limitedResponse = await limited.handler(await signedRequest(payload));
    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.headers.get('Retry-After')).toBe('30');

    const unavailable = createDeps({ rateLimitError: true });
    const unavailableResponse = await unavailable.handler(await signedRequest(payload));
    expect(unavailableResponse.status).toBe(500);
    await expect(unavailableResponse.json()).resolves.toMatchObject({ code: 'internal_error' });
  });

  it('captures user, place, and comment snapshots with type-specific email subjects', async () => {
    const cases = [
      {
        payload: { targetType: 'user', reporterUserId: 'user-1', targetUserId: 'target-1', reason: 'Taciz', details: ' ayrinti ' },
        rows: { profiles: { id: 'target-1', username: 'target' } },
        subject: '[SoRita] Yeni kullanici sikayeti',
      },
      {
        payload: { targetType: 'place', reporterUserId: 'user-1', placeId: 'place-1', reason: 'Yanlis bilgi' },
        rows: {
          list_places: { id: 'place-1', list_id: 'list-1', created_by: 'creator-1', name: 'Cafe' },
          lists: { id: 'list-1', owner_id: 'owner-1', name: 'Liste' },
          profiles: { id: 'owner-1', username: 'owner' },
        },
        subject: '[SoRita] Yeni mekan karti sikayeti',
      },
      {
        payload: { targetType: 'comment', reporterUserId: 'user-1', commentId: 'comment-1', reason: 'Spam' },
        rows: {
          list_place_comments: { id: 'comment-1', list_place_id: 'place-1', user_id: 'author-1', content: 'spam' },
          list_places: { id: 'place-1', list_id: 'list-1', name: 'Cafe' },
          lists: { id: 'list-1', owner_id: 'owner-1', name: 'Liste' },
          profiles: { id: 'author-1', username: 'author' },
        },
        subject: '[SoRita] Yeni yorum sikayeti',
      },
    ] as const;

    for (const testCase of cases) {
      const deps = createDeps({ rows: testCase.rows });
      const response = await deps.handler(await signedRequest(testCase.payload));
      expect(response.status).toBe(200);
      expect(deps.sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({
        subject: testCase.subject,
        text: expect.stringContaining(`Target Type: ${testCase.payload.targetType}`),
      }));
    }
  });

  it('supports orphaned place/list relations without inventing owners', async () => {
    const place = createDeps({
      rows: { list_places: { id: 'place-1', list_id: null, created_by: null, name: 'Orphan' } },
    });
    expect((await place.handler(await signedRequest({
      targetType: 'place', reporterUserId: 'user-1', placeId: 'place-1', reason: 'Spam',
    }))).status).toBe(200);

    const list = createDeps({ rows: { lists: { id: 'list-1', owner_id: null, name: 'Orphan' } } });
    expect((await list.handler(await signedRequest({
      targetType: 'list', reporterUserId: 'user-1', listId: 'list-1', reason: 'Spam',
    }))).status).toBe(200);

    const comment = createDeps({
      rows: { list_place_comments: { id: 'comment-1', list_place_id: null, user_id: null, content: 'x' } },
    });
    expect((await comment.handler(await signedRequest({
      targetType: 'comment', reporterUserId: 'user-1', commentId: 'comment-1', reason: 'Spam',
    }))).status).toBe(200);
  });

  it('returns 404 for missing targets and 500 for snapshot query failures', async () => {
    for (const payload of [
      { targetType: 'user', reporterUserId: 'user-1', targetUserId: 'missing', reason: 'Spam' },
      { targetType: 'list', reporterUserId: 'user-1', listId: 'missing', reason: 'Spam' },
      { targetType: 'place', reporterUserId: 'user-1', placeId: 'missing', reason: 'Spam' },
      { targetType: 'comment', reporterUserId: 'user-1', commentId: 'missing', reason: 'Spam' },
    ]) {
      const { handler } = createDeps();
      const response = await handler(await signedRequest(payload));
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({ code: 'report_target_not_found' });
    }

    const { handler } = createDeps({ rowErrors: { profiles: { message: 'database unavailable' } } });
    const response = await handler(await signedRequest({
      targetType: 'user', reporterUserId: 'user-1', targetUserId: 'target-1', reason: 'Spam',
    }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ code: 'internal_error' });
  });

  it('uses reporter-scoped RLS visibility before service-role snapshot reads', async () => {
    const deps = createDeps({
      rows: {
        lists: { id: 'list-1', owner_id: 'owner-1', name: 'Private list', is_public: false },
        profiles: { id: 'owner-1', username: 'owner' },
      },
      visibleRows: { lists: null },
    });
    const response = await deps.handler(await signedRequest({
      targetType: 'list', reporterUserId: 'user-1', listId: 'list-1', reason: 'Spam',
    }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'report_target_not_found' });
    expect(deps.moderationReportInsertMock).not.toHaveBeenCalled();
  });

  it('rejects self reports for users and owned content', async () => {
    for (const testCase of [
      {
        payload: { targetType: 'user', reporterUserId: 'user-1', targetUserId: 'user-1', reason: 'Spam' },
        rows: { profiles: { id: 'user-1', username: 'self' } },
      },
      {
        payload: { targetType: 'list', reporterUserId: 'user-1', listId: 'list-1', reason: 'Spam' },
        rows: { lists: { id: 'list-1', owner_id: 'user-1', name: 'Own list' } },
      },
    ] as const) {
      const deps = createDeps({ rows: testCase.rows });
      const response = await deps.handler(await signedRequest(testCase.payload));
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({ code: 'self_report_not_allowed' });
      expect(deps.moderationReportInsertMock).not.toHaveBeenCalled();
    }
  });

  it('fails on generic inserts or invalid returned ids without attempting email', async () => {
    for (const options of [
      { insertError: { code: 'XX000', message: 'insert failed' } },
      { insertData: null },
      { insertData: { id: 123 } },
    ]) {
      const deps = createDeps({
        ...options,
        rows: { profiles: { id: 'target-1', username: 'target' } },
      });
      const response = await deps.handler(await signedRequest({
        targetType: 'user', reporterUserId: 'user-1', targetUserId: 'target-1', reason: 'Spam',
      }));
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual(expect.objectContaining({
        code: 'internal_error',
        error: 'Sikayet servisi su anda kullanilamiyor.',
      }));
      expect(deps.sendEmailMock).not.toHaveBeenCalled();
    }
  });

  it('persists email delivery and status update failures without losing the report', async () => {
    for (const options of [
      { emailError: 'mail unavailable' },
      { reportEmailFrom: ' ' },
      { updateError: { message: 'update unavailable' } },
    ]) {
      const deps = createDeps({
        ...options,
        rows: { profiles: { id: 'target-1', username: 'target' } },
      });
      const response = await deps.handler(await signedRequest({
        targetType: 'user', reporterUserId: 'user-1', targetUserId: 'target-1', reason: 'Spam',
      }));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        deliveryStatus: options.updateError ? 'sent' : 'failed',
        reportId: 'report-1',
      });
    }
  });

  it('uses Resend and Brevo transports with explicit delivery outcomes', async () => {
    const payload = { targetType: 'user', reporterUserId: 'user-1', targetUserId: 'target-1', reason: 'Spam' };
    const rows = { profiles: { id: 'target-1', username: 'target' } };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 202 })));
    const resend = createDeps({ rows, useDefaultEmail: true });
    await expect((await resend.handler(await signedRequest(payload))).json()).resolves.toMatchObject({ deliveryStatus: 'sent' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('brevo rejected', { status: 400 })));
    const brevo = createDeps({
      configOverrides: { brevoApiKey: 'brevo-key' }, rows, useDefaultEmail: true,
    });
    await expect((await brevo.handler(await signedRequest(payload))).json()).resolves.toMatchObject({ deliveryStatus: 'failed' });

    const missingResend = createDeps({
      configOverrides: { resendApiKey: '' }, rows, useDefaultEmail: true,
    });
    await expect((await missingResend.handler(await signedRequest(payload))).json()).resolves.toMatchObject({ deliveryStatus: 'failed' });
  });
});
