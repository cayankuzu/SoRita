import { verifySignedRequest } from '../_shared/requestSecurity.ts';

type ErrorLike = {
  code?: string;
  message: string;
};

type ClaimsResult = {
  data?: {
    claims?: {
      sub?: string;
    } | null;
  } | null;
  error?: ErrorLike | null;
};

type AuthClientLike = {
  auth: {
    getClaims: (token: string) => Promise<ClaimsResult>;
  };
};

type StorageListItem = {
  id?: string | null;
  name?: string | null;
};

type StorageBucketLike = {
  list: (
    path: string,
    options: { limit: number; offset: number },
  ) => Promise<{ data?: StorageListItem[] | null; error?: ErrorLike | null }>;
  remove: (paths: string[]) => Promise<{ error?: ErrorLike | null }>;
};

type AdminClientLike = {
  auth: {
    admin: {
      deleteUser: (userId: string, hardDelete: boolean) => Promise<{ error?: ErrorLike | null }>;
    };
  };
  from: (table: string) => {
    delete: () => {
      eq: (column: string, value: string) => Promise<{ error?: ErrorLike | null }>;
    };
  };
  storage: {
    from: (bucket: string) => StorageBucketLike;
  };
};

export type DeleteUserHandlerConfig = {
  allowedOrigins: string[];
  supabasePublishableKey: string;
  supabaseServiceRoleKey: string;
  supabaseUrl: string;
};

export type DeleteUserHandlerDeps = {
  config: DeleteUserHandlerConfig;
  createAdminClient: () => AdminClientLike;
  createAuthClient: (token: string) => AuthClientLike;
};

function getCorsHeaders(request: Request, allowedOrigins: string[]) {
  const requestOrigin = request.headers.get('Origin');
  const allowedOrigin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0] ?? 'null';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-device-id, x-nonce, x-signature, x-timestamp',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  };
}

function jsonResponse(
  request: Request,
  allowedOrigins: string[],
  status: number,
  payload: Record<string, unknown>,
) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: getCorsHeaders(request, allowedOrigins),
  });
}

function getBearerToken(authorization: string | null) {
  if (!authorization) {
    return null;
  }

  return authorization.replace(/^Bearer\s+/i, '').trim() || null;
}

async function deleteBucketFolder(
  adminClient: AdminClientLike,
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
      throw new Error(error.message);
    }

    const filesToRemove =
      (data || [])
        .filter((item) => item.name && item.id)
        .map((item) => `${userId}/${item.name}`) || [];

    if (filesToRemove.length > 0) {
      const { error: removeError } = await adminClient.storage.from(bucket).remove(filesToRemove);

      if (removeError) {
        throw new Error(removeError.message);
      }
    }

    if (!data || data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }
}

export function createDeleteUserHandler({
  config,
  createAdminClient,
  createAuthClient,
}: DeleteUserHandlerDeps) {
  return async function handleDeleteUserRequest(request: Request) {
    const { allowedOrigins, supabasePublishableKey, supabaseServiceRoleKey, supabaseUrl } = config;

    try {
      if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: getCorsHeaders(request, allowedOrigins) });
      }

      if (request.method !== 'POST') {
        return jsonResponse(request, allowedOrigins, 405, { error: 'Method not allowed' });
      }

      if (!supabaseUrl || !supabasePublishableKey || !supabaseServiceRoleKey) {
        return jsonResponse(request, allowedOrigins, 500, { error: 'Function is not configured' });
      }

      const token = getBearerToken(request.headers.get('Authorization'));

      if (!token) {
        return jsonResponse(request, allowedOrigins, 401, { error: 'Missing authorization header' });
      }

      const authClient = createAuthClient(token);
      const {
        data,
        error: claimsError,
      } = await authClient.auth.getClaims(token);
      const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null;

      if (claimsError || !userId) {
        return jsonResponse(request, allowedOrigins, 401, { error: claimsError?.message ?? 'Invalid JWT' });
      }

      const adminClient = createAdminClient();
      const securityResult = await verifySignedRequest({
        adminClient,
        functionName: 'delete-user',
        request,
        token,
        userId,
      });

      if (!securityResult.ok) {
        return jsonResponse(request, allowedOrigins, securityResult.status, {
          error: securityResult.error,
        });
      }

      await deleteBucketFolder(adminClient, 'profile-media', userId);
      await deleteBucketFolder(adminClient, 'place-media', userId);

      const { error: deleteActorNotificationsError } = await adminClient
        .from('notifications')
        .delete()
        .eq('actor_user_id', userId);

      if (deleteActorNotificationsError) {
        return jsonResponse(request, allowedOrigins, 500, {
          error: deleteActorNotificationsError.message,
        });
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId, false);

      if (deleteError) {
        return jsonResponse(request, allowedOrigins, 500, { error: deleteError.message });
      }

      return jsonResponse(request, allowedOrigins, 200, { success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown delete-user error';
      return jsonResponse(request, allowedOrigins, 500, { error: message });
    }
  };
}
