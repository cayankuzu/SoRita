import { createClient } from 'npm:@supabase/supabase-js@2';

import { createAdminBroadcastNotificationHandler } from './handler.ts';
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
    recipientUserIds: string[];
  }) {
    let insertedCount = 0;

    for (const recipientChunk of chunkArray(params.recipientUserIds, 500)) {
      const { data, error } = await adminClient.rpc('insert_system_broadcast_notifications', {
        p_idempotency_key: params.idempotencyKey,
        p_message: params.message,
        p_push_title: params.pushTitle,
        p_recipient_user_ids: recipientChunk,
      });

      if (error) {
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
