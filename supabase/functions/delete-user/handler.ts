import { z } from 'zod';

import { createEdgeRequestContext, logEdgeEvent } from '../_shared/edgeLogger.ts';
import { verifyRequestEnvelope, verifySignedRequest } from '../_shared/requestSecurity.ts';
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

type AccountDeletionClaim = {
  claim_status: 'claimed' | 'completed' | 'in_progress';
  last_completed_step: Exclude<AccountDeletionStep, 'failed'>;
  retry_after_seconds: number;
};

const ACCOUNT_DELETION_STEP_ORDER: Record<Exclude<AccountDeletionStep, 'failed'>, number> = {
  requested: 0,
  storage_deleted: 1,
  notifications_deleted: 2,
  auth_delete_started: 3,
  completed: 4,
};

function readRpcRow<T>(data: unknown) {
  return (Array.isArray(data) ? data[0] : data) as T | null;
}

async function claimAccountDeletionJob(
  adminClient: AdminClientLike,
  userId: string,
  leaseId: string,
) {
  const { data, error } = await adminClient.rpc('claim_account_deletion_job', {
    p_lease_id: leaseId,
    p_lease_seconds: 300,
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const claim = readRpcRow<AccountDeletionClaim>(data);

  if (!claim || !(claim.claim_status in { claimed: true, completed: true, in_progress: true })) {
    throw new Error('Account deletion claim response was invalid.');
  }

  return claim;
}

function completedBefore(
  lastCompletedStep: Exclude<AccountDeletionStep, 'failed'>,
  nextStep: Exclude<AccountDeletionStep, 'failed'>,
) {
  return ACCOUNT_DELETION_STEP_ORDER[lastCompletedStep] < ACCOUNT_DELETION_STEP_ORDER[nextStep];
}

function isMissingAuthUserError(error: ErrorLike) {
  const message = error.message.toLowerCase();
  return error.status === 404 || message.includes('user not found') || message.includes('does not exist');
}

async function recordAccountDeletionStep(
  adminClient: AdminClientLike,
  userId: string,
  step: AccountDeletionStep,
  leaseId: string,
  error?: string,
) {
  const { error: ledgerError } = await adminClient.rpc('record_account_deletion_step', {
    p_error: error ?? null,
    p_lease_id: leaseId,
    p_step: step,
    p_user_id: userId,
  });

  if (ledgerError) {
    throw new Error(ledgerError.message);
  }
}

async function renewAccountDeletionLease(
  adminClient: AdminClientLike,
  userId: string,
  leaseId: string,
) {
  const { data, error } = await adminClient.rpc('renew_account_deletion_job_lease', {
    p_lease_id: leaseId,
    p_lease_seconds: 300,
    p_user_id: userId,
  });

  if (error || readRpcBoolean(data) !== true) {
    throw new Error(error?.message ?? 'Account deletion lease could not be renewed.');
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
  createAuthClient: (token: string) => AuthClientLike & {
    auth: AuthClientLike['auth'] & {
      getClaims: (token: string) => Promise<{
        data?: { claims?: { sub?: string } | null } | null;
        error?: ErrorLike | null;
      }>;
    };
  };
};

const deleteUserPayloadSchema = z.object({});

function readRpcBoolean(data: unknown) {
  if (typeof data === 'boolean') return data;
  if (Array.isArray(data) && typeof data[0] === 'boolean') return data[0];
  return null;
}

async function deleteBucketFolder(
  adminClient: AdminClientLike,
  bucket: 'profile-media' | 'place-media' | 'place-media-private',
  userId: string,
  heartbeat: () => Promise<void>,
) {
  async function collectFilePaths(path: string): Promise<string[]> {
    const pageSize = 1000;
    let offset = 0;
    const filePaths: string[] = [];
    const childFolders: string[] = [];

    while (true) {
      await heartbeat();
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
    await heartbeat();
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

      const adminClient = createAdminClient();
      const envelope = await verifyRequestEnvelope({
        adminClient,
        functionName: 'delete-user',
        maxBodyBytes: 1024,
        request,
      });
      if (!envelope.ok) {
        return jsonResponse(
          request,
          allowedOrigins,
          envelope.status,
          { code: 'invalid_signature', error: envelope.error },
          { requestId: requestContext.requestId },
        );
      }

      const authClient = createAuthClient(token);
      const claimsResult = await authClient.auth.getClaims(token);
      const claimedUserId = claimsResult.data?.claims?.sub?.trim();

      if (claimsResult.error || !claimedUserId) {
        return jsonResponse(
          request,
          allowedOrigins,
          401,
          { code: 'invalid_jwt', error: 'Invalid JWT' },
          { requestId: requestContext.requestId },
        );
      }

      const securityResult = await verifySignedRequest({
        adminClient,
        bodyText: envelope.bodyText,
        functionName: 'delete-user',
        request,
        token,
        userId: claimedUserId,
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

      const {
        data,
        error: userError,
      } = await authClient.auth.getUser(token);
      const userId = typeof data?.user?.id === 'string' ? data.user.id : null;

      if (userError || !userId) {
        const completedResult = await adminClient.rpc('is_account_deletion_job_completed', {
          p_user_id: claimedUserId,
        });
        const completed = completedResult.error ? null : readRpcBoolean(completedResult.data);

        if (completed === true) {
          return jsonResponse(
            request,
            allowedOrigins,
            200,
            { success: true },
            { requestId: requestContext.requestId },
          );
        }

        return jsonResponse(
          request,
          allowedOrigins,
          401,
          { code: 'invalid_jwt', error: userError?.message ?? 'Invalid JWT' },
          { requestId: requestContext.requestId },
        );
      }

      if (userId !== claimedUserId) {
        return jsonResponse(
          request,
          allowedOrigins,
          401,
          { code: 'invalid_jwt', error: 'Invalid JWT' },
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
        identifier: userId,
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

      const leaseId = crypto.randomUUID();
      const claim = await claimAccountDeletionJob(adminClient, userId, leaseId);

      if (claim.claim_status === 'completed') {
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
      }

      if (claim.claim_status === 'in_progress') {
        return jsonResponse(
          request,
          allowedOrigins,
          409,
          { code: 'deletion_in_progress', error: 'Hesap silme islemi zaten devam ediyor.' },
          {
            extraHeaders: {
              ...rateLimitHeaders(rateLimitResult, 2),
              'Retry-After': String(Math.max(1, claim.retry_after_seconds)),
            },
            requestId: requestContext.requestId,
          },
        );
      }

      try {
        const heartbeat = () => renewAccountDeletionLease(adminClient, userId, leaseId);
        if (completedBefore(claim.last_completed_step, 'storage_deleted')) {
          await deleteBucketFolder(adminClient, 'profile-media', userId, heartbeat);
          await deleteBucketFolder(adminClient, 'place-media', userId, heartbeat);
          await deleteBucketFolder(adminClient, 'place-media-private', userId, heartbeat);
          await heartbeat();
          await recordAccountDeletionStep(adminClient, userId, 'storage_deleted', leaseId);
        }

        if (completedBefore(claim.last_completed_step, 'notifications_deleted')) {
          await heartbeat();
          const { error: deleteActorNotificationsError } = await adminClient
            .from('notifications')
            .delete()
            .eq('actor_user_id', userId);

          if (deleteActorNotificationsError) {
            throw new Error(deleteActorNotificationsError.message);
          }
          await recordAccountDeletionStep(adminClient, userId, 'notifications_deleted', leaseId);
        }

        if (completedBefore(claim.last_completed_step, 'auth_delete_started')) {
          await heartbeat();
          await recordAccountDeletionStep(adminClient, userId, 'auth_delete_started', leaseId);
        }

        await heartbeat();
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId, false);

        if (deleteError && !isMissingAuthUserError(deleteError)) {
          throw new Error(deleteError.message);
        }
        await heartbeat();
        await recordAccountDeletionStep(adminClient, userId, 'completed', leaseId);
      } catch (error) {
        try {
          await recordAccountDeletionStep(
            adminClient,
            userId,
            'failed',
            leaseId,
            error instanceof Error ? error.message : 'unknown',
          );
        } catch (ledgerError) {
          logEdgeEvent('error', 'Failed to record account deletion failure', requestContext, {
            error: ledgerError instanceof Error ? ledgerError.message : 'Unknown ledger error',
          });
        }
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
