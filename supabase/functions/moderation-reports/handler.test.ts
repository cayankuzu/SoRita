import { describe, expect, it, vi } from 'vitest';

import { createRequestSignature, sha256Hex } from '../_shared/requestSecurity';
import { createModerationReportsHandler } from './handler';

function createDeps(options?: {
  insertError?: { code?: string; message: string } | null;
  reportEmailFrom?: string;
  rows?: Partial<Record<'comments' | 'list_places' | 'lists' | 'profiles', Record<string, unknown>>>;
}) {
  const nonceDeleteLtMock = vi.fn().mockResolvedValue({ error: null });
  const seenNonces = new Set<string>();
  const moderationReportInsertMock = vi.fn().mockResolvedValue({
    data: options?.insertError ? null : { id: 'report-1' },
    error: options?.insertError ?? null,
  });
  const moderationReportUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
  const sendEmailMock = vi.fn().mockResolvedValue({ error: null });

  const handler = createModerationReportsHandler({
    config: {
      allowedOrigins: ['http://localhost:5173'],
      reportEmailFrom: options?.reportEmailFrom ?? 'reports@sorita.app',
      reportEmailTo: 'memodee333@gmail.com',
      resendApiKey: 'resend-key',
      supabasePublishableKey: 'anon-key',
      supabaseServiceRoleKey: 'service-role',
      supabaseUrl: 'https://example.supabase.co',
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

        const row = options?.rows?.[table as 'comments' | 'list_places' | 'lists' | 'profiles'] ?? null;
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
              maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
            }),
          }),
          update: () => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      },
      rpc: vi.fn().mockResolvedValue({
        data: {
          allowed: true,
          remaining: 11,
          retry_after_seconds: 1,
        },
        error: null,
      }),
    }),
    createAuthClient: () => ({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: {
            claims: {
              sub: 'user-1',
            },
          },
          error: null,
        }),
      },
    }),
    createRequestId: () => 'request-1',
    sendEmail: sendEmailMock,
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
  let signedHeaderCounter = 0;

  async function createSignedHeaders(body: string) {
    signedHeaderCounter += 1;
    const deviceId = `device-1234-${signedHeaderCounter}`;
    const nonce = `nonce-1234-5678-90ab-${signedHeaderCounter}`;
    const timestamp = Date.now().toString();
    const payloadHash = await sha256Hex(body);
    const signature = await createRequestSignature('token-1', {
      deviceId,
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
});
