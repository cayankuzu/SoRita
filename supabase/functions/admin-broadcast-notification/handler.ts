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
  message: string;
  title: string;
  userIds?: string[];
};

type BroadcastNotificationRepository = {
  fetchRecipientUserIds: (userIds?: string[]) => Promise<string[]>;
  insertNotifications: (params: {
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
  repository: BroadcastNotificationRepository;
};

const allowedOriginsFallback =
  'http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:3000';

const requestBodySchema = z.object({
  dryRun: z.boolean().optional(),
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
    message: payload.message.trim(),
    title: payload.title.trim(),
    userIds: payload.userIds ? Array.from(new Set(payload.userIds)) : undefined,
  };
}

export function createAdminBroadcastNotificationHandler({
  config,
  createRequestId = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `admin-broadcast-${Date.now()}`,
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

    if (!token || token !== config.adminToken) {
      return jsonResponse(
        request,
        normalizedAllowedOrigins,
        401,
        { code: 'unauthorized', error: 'Unauthorized' },
        { requestId },
      );
    }

    try {
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
          error: error instanceof Error ? error.message : 'Internal server error',
        },
        { requestId },
      );
    }
  };
}
