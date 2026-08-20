import { z } from 'zod';

import { createEdgeRequestContext, logEdgeEvent } from '../_shared/edgeLogger.ts';
import {
  corsPreflightResponse,
  isHttpRequestError,
  jsonResponse,
  parseJsonBody,
} from '../_shared/httpHelpers.ts';

type BroadcastRequestPayload = {
  dryRun?: boolean;
  idempotencyKey?: string;
  message: string;
  title: string;
  userIds?: string[];
};

type BroadcastNotificationRepository = {
  fetchRecipientUserIds: (userIds?: string[]) => Promise<string[]>;
  insertNotifications: (params: {
    idempotencyKey: string;
    message: string;
    pushTitle: string;
    recipientUserIds: string[];
  }) => Promise<number>;
};

type AdminBroadcastNotificationHandlerConfig = {
  adminToken: string;
  allowedOrigins: string[];
  supabaseServiceRoleKey: string;
  supabaseUrl: string;
};

type AdminBroadcastNotificationHandlerDeps = {
  config: AdminBroadcastNotificationHandlerConfig;
  createRequestId?: () => string;
  enforceAdminRateLimit: () => Promise<{
    allowed: boolean;
    remaining: number;
    retryAfterMs?: number;
  }>;
  repository: BroadcastNotificationRepository;
};

const allowedOriginsFallback = '';

const requestBodySchema = z.object({
  dryRun: z.boolean().optional(),
  idempotencyKey: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(500),
  title: z.string().trim().min(1).max(80),
  userIds: z.array(z.string().uuid()).max(5000).optional(),
});

function assertConfigured(config: AdminBroadcastNotificationHandlerConfig) {
  return Boolean(
    config.adminToken.trim() &&
      config.supabaseServiceRoleKey.trim() &&
      config.supabaseUrl.trim(),
  );
}

function normalizePayload(payload: BroadcastRequestPayload) {
  return {
    dryRun: payload.dryRun ?? false,
    idempotencyKey: payload.idempotencyKey,
    message: payload.message.trim(),
    title: payload.title.trim(),
    userIds: payload.userIds ? Array.from(new Set(payload.userIds)) : undefined,
  };
}

function timingSafeEqual(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return diff === 0;
}

export function createAdminBroadcastNotificationHandler({
  config,
  createRequestId = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `admin-broadcast-${Date.now()}`,
  enforceAdminRateLimit,
  repository,
}: AdminBroadcastNotificationHandlerDeps) {
  const normalizedAllowedOrigins = (config.allowedOrigins.length
    ? config.allowedOrigins
    : allowedOriginsFallback.split(','))
    .map((origin) => origin.trim())
    .filter(Boolean);

  return async (request: Request) => {
    const requestContext = createEdgeRequestContext(request, 'admin-broadcast-notification');
    const requestId = requestContext.requestId || createRequestId();

    if (request.method === 'OPTIONS') {
      return corsPreflightResponse(request, normalizedAllowedOrigins, requestId);
    }

    if (request.method !== 'POST') {
      return jsonResponse(
        request,
        normalizedAllowedOrigins,
        405,
        { code: 'method_not_allowed', error: 'Method not allowed' },
        { requestId },
      );
    }

    if (!assertConfigured(config)) {
      return jsonResponse(
        request,
        normalizedAllowedOrigins,
        500,
        { code: 'misconfigured', error: 'System push service is not configured.' },
        { requestId },
      );
    }

    const token = request.headers.get('x-admin-token')?.trim() ?? '';

    if (!token || !timingSafeEqual(token, config.adminToken)) {
      return jsonResponse(
        request,
        normalizedAllowedOrigins,
        401,
        { code: 'unauthorized', error: 'Unauthorized' },
        { requestId },
      );
    }

    try {
      const rateLimit = await enforceAdminRateLimit();

      if (!rateLimit.allowed) {
        return jsonResponse(
          request,
          normalizedAllowedOrigins,
          429,
          { code: 'rate_limited', error: 'Too many broadcast requests' },
          {
            requestId,
            extraHeaders: {
              'Retry-After': Math.max(
                1,
                Math.ceil((rateLimit.retryAfterMs ?? 60_000) / 1000),
              ).toString(),
              'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            },
          },
        );
      }

      const parsedPayload = requestBodySchema.safeParse(parseJsonBody(await request.text(), {}));

      if (!parsedPayload.success) {
        return jsonResponse(
          request,
          normalizedAllowedOrigins,
          400,
          {
            code: 'invalid_input',
            error: parsedPayload.error.issues[0]?.message ?? 'Invalid request payload',
          },
          { requestId },
        );
      }

      const payload = normalizePayload(parsedPayload.data);

      if (!payload.dryRun && !payload.idempotencyKey) {
        return jsonResponse(
          request,
          normalizedAllowedOrigins,
          400,
          {
            code: 'idempotency_key_required',
            error: 'A UUID idempotencyKey is required for live broadcasts',
          },
          { requestId },
        );
      }

      const recipientUserIds = await repository.fetchRecipientUserIds(payload.userIds);

      if (payload.dryRun) {
        return jsonResponse(
          request,
          normalizedAllowedOrigins,
          200,
          {
            dryRun: true,
            insertedCount: 0,
            recipientCount: recipientUserIds.length,
            success: true,
          },
          { requestId },
        );
      }

      if (recipientUserIds.length === 0) {
        return jsonResponse(
          request,
          normalizedAllowedOrigins,
          200,
          {
            dryRun: false,
            insertedCount: 0,
            recipientCount: 0,
            success: true,
          },
          { requestId },
        );
      }

      const insertedCount = await repository.insertNotifications({
        idempotencyKey: payload.idempotencyKey as string,
        message: payload.message,
        pushTitle: payload.title,
        recipientUserIds,
      });

      return jsonResponse(
        request,
        normalizedAllowedOrigins,
        200,
        {
          dryRun: false,
          duplicateCount: Math.max(0, recipientUserIds.length - insertedCount),
          insertedCount,
          recipientCount: recipientUserIds.length,
          success: true,
        },
        { requestId },
      );
    } catch (error) {
      if (isHttpRequestError(error)) {
        return jsonResponse(
          request,
          normalizedAllowedOrigins,
          error.status,
          { code: error.code, error: error.message },
          { requestId },
        );
      }

      logEdgeEvent('error', 'Unhandled admin-broadcast-notification error', requestContext, {
        error: error instanceof Error ? error.message : 'Unknown admin broadcast error',
      });

      return jsonResponse(
        request,
        normalizedAllowedOrigins,
        500,
        {
          code: 'internal_error',
          error: 'Internal server error',
        },
        { requestId },
      );
    }
  };
}
