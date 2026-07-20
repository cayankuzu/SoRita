import { z } from 'zod';

import { createEdgeRequestContext, logEdgeEvent } from '../_shared/edgeLogger.ts';
import { verifySignedRequest } from '../_shared/requestSecurity.ts';
import {
  type AuthClientLike,
  type ErrorLike,
  corsPreflightResponse,
  getBearerToken,
  isHttpRequestError,
  jsonResponse,
  parseJsonBody,
} from '../_shared/httpHelpers.ts';
import { enforceRateLimit, rateLimitHeaders, type RateLimitAdminClientLike } from '../_shared/rateLimit.ts';

type StorageListItem = {
  id?: string | null;
  name?: string | null;
};

type NonceStoreLike = {
  delete: () => {
    lt: (column: string, value: string) => Promise<{ error?: ErrorLike | null }>;
  };
  insert: (payload: Record<string, unknown>) => Promise<{ error?: ErrorLike | null }>;
};

type StorageBucketLike = {
  list: (
    path: string,
    options: { limit: number; offset: number },
  ) => Promise<{ data?: StorageListItem[] | null; error?: ErrorLike | null }>;
  remove: (paths: string[]) => Promise<{ error?: ErrorLike | null }>;
};

type AdminClientLike = RateLimitAdminClientLike & {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data?: unknown; error?: ErrorLike | null }>;
  auth: {
    admin: {
      deleteUser: (userId: string, hardDelete: boolean) => Promise<{ error?: ErrorLike | null }>;
    };
  };
  from: (table: string) => {
    delete: () => {
      eq: (column: string, value: string) => Promise<{ error?: ErrorLike | null }>;
    };
  } & NonceStoreLike;
  storage: {
    from: (bucket: string) => StorageBucketLike;
  };
};

type AccountDeletionStep =
  | 'requested'
  | 'storage_deleted'
  | 'notifications_deleted'
  | 'auth_delete_started'
  | 'completed'
  | 'failed';

async function recordAccountDeletionStep(
  adminClient: AdminClientLike,
  userId: string,
  step: AccountDeletionStep,
  error?: string,
) {
  const { error: ledgerError } = await adminClient.rpc('record_account_deletion_step', {
    p_error: error ?? null,
    p_step: step,
    p_user_id: userId,
  });

  if (ledgerError) {
    throw new Error(ledgerError.message);
  }
}

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

const deleteUserPayloadSchema = z.object({});

async function deleteBucketFolder(
  adminClient: AdminClientLike,
  bucket: 'profile-media' | 'place-media' | 'place-media-private',
  userId: string,
) {
  async function collectFilePaths(path: string): Promise<string[]> {
    const pageSize = 1000;
    let offset = 0;
    const filePaths: string[] = [];
    const childFolders: string[] = [];

    while (true) {
      const { data, error } = await adminClient.storage.from(bucket).list(path, {
        limit: pageSize,
        offset,
      });

      if (error) {
        throw new Error(error.message);
      }

      for (const item of data || []) {
        if (!item.name) {
          continue;
        }

        const itemPath = `${path}/${item.name}`;

        if (item.id) {
          filePaths.push(itemPath);
          continue;
        }

        childFolders.push(itemPath);
      }

      if (!data || data.length < pageSize) {
        break;
      }

      offset += pageSize;
    }

    for (const childFolder of childFolders) {
      filePaths.push(...await collectFilePaths(childFolder));
    }

    return filePaths;
  }

  const filesToRemove = await collectFilePaths(userId);

  if (filesToRemove.length === 0) {
    return;
  }

  const pageSize = 1000;
  for (let start = 0; start < filesToRemove.length; start += pageSize) {
    const chunk = filesToRemove.slice(start, start + pageSize);
    const { error: removeError } = await adminClient.storage.from(bucket).remove(chunk);

    if (removeError) {
      throw new Error(removeError.message);
    }
  }
}

export function createDeleteUserHandler({
  config,
  createAdminClient,
  createAuthClient,
}: DeleteUserHandlerDeps) {
  return async function handleDeleteUserRequest(request: Request) {
    const requestContext = createEdgeRequestContext(request, 'delete-user');
    const { allowedOrigins, supabasePublishableKey, supabaseServiceRoleKey, supabaseUrl } = config;

    try {
      if (request.method === 'OPTIONS') {
        return corsPreflightResponse(request, allowedOrigins, requestContext.requestId);
      }

      if (request.method !== 'POST') {
        return jsonResponse(
          request,
          allowedOrigins,
          405,
          { code: 'method_not_allowed', error: 'Method not allowed' },
          { requestId: requestContext.requestId },
        );
      }

      if (!supabaseUrl || !supabasePublishableKey || !supabaseServiceRoleKey) {
        logEdgeEvent('error', 'Delete user function is missing configuration', requestContext);
        return jsonResponse(
          request,
          allowedOrigins,
          500,
          { code: 'misconfigured', error: 'Hesap silme servisi su anda kullanilamiyor.' },
          { requestId: requestContext.requestId },
        );
      }

      const token = getBearerToken(request.headers.get('Authorization'));

      if (!token) {
        return jsonResponse(
          request,
          allowedOrigins,
          401,
          { code: 'missing_authorization', error: 'Missing authorization header' },
          { requestId: requestContext.requestId },
        );
      }

      const authClient = createAuthClient(token);
      const {
        data,
        error: claimsError,
      } = await authClient.auth.getClaims(token);
      const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null;

      if (claimsError || !userId) {
        return jsonResponse(
          request,
          allowedOrigins,
          401,
          { code: 'invalid_jwt', error: claimsError?.message ?? 'Invalid JWT' },
          { requestId: requestContext.requestId },
        );
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
        return jsonResponse(
          request,
          allowedOrigins,
          securityResult.status,
          { code: 'invalid_signature', error: securityResult.error },
          { requestId: requestContext.requestId },
        );
      }

      const parsedPayload = deleteUserPayloadSchema.safeParse(parseJsonBody(securityResult.bodyText ?? ''));

      if (!parsedPayload.success) {
        return jsonResponse(
          request,
          allowedOrigins,
          400,
          { code: 'invalid_input', error: 'Gecersiz istek govdesi.' },
          { requestId: requestContext.requestId },
        );
      }

      const rateLimitResult = await enforceRateLimit({
        adminClient,
        identifier: `${userId}:${request.headers.get('x-device-id') ?? 'unknown-device'}`,
        maxRequests: 2,
        scope: 'account:delete',
        windowMs: 60 * 60_000,
      });

      if (!rateLimitResult.allowed) {
        return jsonResponse(
          request,
          allowedOrigins,
          429,
          { code: 'rate_limited', error: 'Hesap silme istegi limiti asildi. Lutfen daha sonra tekrar deneyin.' },
          {
            extraHeaders: rateLimitHeaders(rateLimitResult, 2),
            requestId: requestContext.requestId,
          },
        );
      }

      await recordAccountDeletionStep(adminClient, userId, 'requested');

      try {
        await deleteBucketFolder(adminClient, 'profile-media', userId);
        await deleteBucketFolder(adminClient, 'place-media', userId);
        await deleteBucketFolder(adminClient, 'place-media-private', userId);
        await recordAccountDeletionStep(adminClient, userId, 'storage_deleted');

        const { error: deleteActorNotificationsError } = await adminClient
          .from('notifications')
          .delete()
          .eq('actor_user_id', userId);

        if (deleteActorNotificationsError) {
          throw new Error(deleteActorNotificationsError.message);
        }
        await recordAccountDeletionStep(adminClient, userId, 'notifications_deleted');

        await recordAccountDeletionStep(adminClient, userId, 'auth_delete_started');
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId, false);

        if (deleteError) {
          throw new Error(deleteError.message);
        }
        await recordAccountDeletionStep(adminClient, userId, 'completed');
      } catch (error) {
        await recordAccountDeletionStep(
          adminClient,
          userId,
          'failed',
          error instanceof Error ? error.message : 'unknown',
        ).catch(() => undefined);
        throw error;
      }

      return jsonResponse(
        request,
        allowedOrigins,
        200,
        { success: true },
        {
          extraHeaders: rateLimitHeaders(rateLimitResult, 2),
          requestId: requestContext.requestId,
        },
      );
    } catch (error) {
      if (isHttpRequestError(error)) {
        return jsonResponse(
          request,
          allowedOrigins,
          error.status,
          { code: error.code, error: error.message },
          { requestId: requestContext.requestId },
        );
      }

      logEdgeEvent('error', 'Unhandled delete-user error', requestContext, {
        error: error instanceof Error ? error.message : 'Unknown delete-user error',
      });
      return jsonResponse(
        request,
        allowedOrigins,
        500,
        { code: 'unexpected', error: 'Hesap silme islemi tamamlanamadi.' },
        { requestId: requestContext.requestId },
      );
    }
  };
}
