import { createClient } from 'npm:@supabase/supabase-js@2';

import { createAdminBroadcastNotificationHandler } from './handler.ts';
import { HttpRequestError } from '../_shared/httpHelpers.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { sha256Hex } from '../_shared/requestSecurity.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const adminToken = Deno.env.get('SYSTEM_BROADCAST_ADMIN_TOKEN') ?? '';
const adminTokenFingerprint = sha256Hex(adminToken);
const allowedOrigins = (
  Deno.env.get('SYSTEM_BROADCAST_ALLOWED_ORIGINS') ?? ''
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function resolvePreAuthRateLimitSource(request: Request) {
  const candidate = (
    request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-real-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]
    ?? ''
  ).trim();

  // Do not use raw IP values outside this function or log them. Malformed
  // forwarding headers deliberately collapse into one conservative bucket.
  return /^[0-9A-Fa-f:.]{3,64}$/u.test(candidate) ? candidate : 'unknown';
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

const repository = {
  async fetchRecipientUserIds(userIds?: string[]) {
    if (userIds?.length) {
      const { data, error } = await adminClient
        .from('profiles')
        .select('id')
        .in('id', userIds);

      if (error) {
        throw new Error(error.message);
      }

      return Array.from(
        new Set(
          (data ?? [])
            .map((row) => (typeof row.id === 'string' ? row.id : null))
            .filter((id): id is string => Boolean(id)),
        ),
      );
    }

    const recipientUserIds: string[] = [];
    const pageSize = 1000;

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await adminClient
        .from('profiles')
        .select('id')
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data ?? [])
        .map((row) => (typeof row.id === 'string' ? row.id : null))
        .filter((id): id is string => Boolean(id));

      recipientUserIds.push(...rows);

      if (rows.length < pageSize) {
        break;
      }
    }

    return Array.from(new Set(recipientUserIds));
  },

  async insertNotifications(params: {
    idempotencyKey: string;
    message: string;
    pushTitle: string;
    requestHash: string;
    recipientUserIds: string[];
  }) {
    let insertedCount = 0;
    const recipientChunks = chunkArray(params.recipientUserIds, 500);

    // An empty live audience still creates the canonical idempotency claim.
    // Otherwise the same key could later be reused with a different request
    // after a profile query briefly returned no recipients.
    for (const recipientChunk of recipientChunks.length ? recipientChunks : [[]]) {
      const { data, error } = await adminClient.rpc('insert_system_broadcast_notifications', {
        p_idempotency_key: params.idempotencyKey,
        p_message: params.message,
        p_push_title: params.pushTitle,
        p_request_hash: params.requestHash,
        p_recipient_user_ids: recipientChunk,
      });

      if (error) {
        if (error.message.includes('idempotency_key_payload_mismatch')) {
          throw new HttpRequestError(
            409,
            'idempotency_key_payload_mismatch',
            'The idempotency key was already used for a different broadcast request.',
          );
        }
        throw new Error(error.message);
      }

      const chunkInsertedCount = Number(data);

      if (!Number.isSafeInteger(chunkInsertedCount) || chunkInsertedCount < 0) {
        throw new Error('Broadcast insertion returned an invalid count');
      }

      insertedCount += chunkInsertedCount;
    }

    return insertedCount;
  },
};

const handleAdminBroadcastNotificationRequest = createAdminBroadcastNotificationHandler({
  config: {
    adminToken,
    allowedOrigins,
    supabaseServiceRoleKey,
    supabaseUrl,
  },
  enforcePreAuthAbuseRateLimit: async (request) => {
    const tokenFingerprint = await adminTokenFingerprint;
    const sourceFingerprint = await sha256Hex(
      `${tokenFingerprint}:admin-broadcast-preauth:${resolvePreAuthRateLimitSource(request)}`,
    );

    return enforceRateLimit({
      adminClient,
      identifier: sourceFingerprint,
      maxRequests: 20,
      scope: 'admin-broadcast-notification-preauth',
      windowMs: 60_000,
    });
  },
  enforceAdminRateLimit: async () =>
    enforceRateLimit({
      adminClient,
      identifier: await adminTokenFingerprint,
      maxRequests: 5,
      scope: 'admin-broadcast-notification',
      windowMs: 60_000,
    }),
  repository,
});

Deno.serve(handleAdminBroadcastNotificationRequest);
