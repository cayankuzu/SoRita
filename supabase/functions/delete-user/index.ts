import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabasePublishableKey =
  Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

async function deleteBucketFolder(
  adminClient: ReturnType<typeof createClient>,
  bucket: 'profile-media' | 'place-media',
  userId: string,
) {
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await adminClient.storage.from(bucket).list(userId, {
      limit: pageSize,
      offset,
    });

    if (error) {
      throw error;
    }

    const filesToRemove =
      (data || [])
        .filter((item) => item.name && item.id)
        .map((item) => `${userId}/${item.name}`) || [];

    if (filesToRemove.length > 0) {
      const { error: removeError } = await adminClient.storage.from(bucket).remove(filesToRemove);

      if (removeError) {
        throw removeError;
      }
    }

    if (!data || data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }
}

function getBearerToken(authorization: string | null) {
  if (!authorization) {
    return null;
  }

  return authorization.replace(/^Bearer\s+/i, '').trim() || null;
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const authorization = request.headers.get('Authorization');
    const token = getBearerToken(authorization);

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const authClient = createClient(supabaseUrl, supabasePublishableKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data,
      error: claimsError,
    } = await authClient.auth.getClaims(token);

    const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null;

    if (claimsError || !userId) {
      return new Response(JSON.stringify({ error: claimsError?.message ?? 'Invalid JWT' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    await deleteBucketFolder(adminClient, 'profile-media', userId);
    await deleteBucketFolder(adminClient, 'place-media', userId);

    const { error: deleteActorNotificationsError } = await adminClient
      .from('notifications')
      .delete()
      .eq('actor_user_id', userId);

    if (deleteActorNotificationsError) {
      return new Response(JSON.stringify({ error: deleteActorNotificationsError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId, false);

    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown delete-user error';

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
