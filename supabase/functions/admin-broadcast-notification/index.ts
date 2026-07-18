import { createClient } from 'npm:@supabase/supabase-js@2';

import { createAdminBroadcastNotificationHandler } from './handler.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const adminToken = Deno.env.get('SYSTEM_BROADCAST_ADMIN_TOKEN') ?? '';
const allowedOrigins = (
  Deno.env.get('SYSTEM_BROADCAST_ALLOWED_ORIGINS') ??
  'http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:3000'
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
    message: string;
    pushTitle: string;
    recipientUserIds: string[];
  }) {
    let insertedCount = 0;

    for (const recipientChunk of chunkArray(params.recipientUserIds, 500)) {
      const payload = recipientChunk.map((recipientUserId) => ({
        actor_user_id: null,
        message: params.message,
        push_title: params.pushTitle,
        read: false,
        recipient_user_id: recipientUserId,
        type: 'system_announcement',
      }));

      const { error } = await adminClient.from('notifications').insert(payload);

      if (error) {
        throw new Error(error.message);
      }

      insertedCount += payload.length;
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
  repository,
});

Deno.serve(handleAdminBroadcastNotificationRequest);
