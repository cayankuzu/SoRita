import { z } from 'zod';

import { createEdgeRequestContext, logEdgeEvent } from '../_shared/edgeLogger.ts';
import {
  type ErrorLike,
  corsPreflightResponse,
  getBearerToken,
  isHttpRequestError,
  jsonResponse,
  parseJsonBody,
} from '../_shared/httpHelpers.ts';
import {
  enforceRateLimit,
  rateLimitHeaders,
  type RateLimitAdminClientLike,
} from '../_shared/rateLimit.ts';
import { verifyRequestEnvelope, verifySignedRequest } from '../_shared/requestSecurity.ts';

type NonceStore = {
  insert: (payload: Record<string, unknown>) => Promise<{ error?: ErrorLike | null }>;
};

type AdminClient = RateLimitAdminClientLike & {
  from: (table: string) => NonceStore;
};

type AuthClient = {
  auth: {
    getClaims: (token: string) => Promise<{
      data?: { claims?: { sub?: string } | null } | null;
      error?: ErrorLike | null;
    }>;
    getUser: (token: string) => Promise<{
      data?: { user?: { id?: string } | null } | null;
      error?: ErrorLike | null;
    }>;
  };
};

export type PersonalDataHandlerDeps = {
  config: {
    allowedOrigins: string[];
    supabasePublishableKey: string;
    supabaseServiceRoleKey: string;
    supabaseUrl: string;
  };
  createAdminClient: () => AdminClient;
  createAuthClient: (token: string) => AuthClient;
};

export const PERSONAL_DATA_EXPORT_RESPONSE_MAX_BYTES = 5 * 1024 * 1024;

const payloadSchema = z.object({ action: z.literal('export') }).strict();
const privateNoStoreHeaders: Record<string, string> = {
  'cache-control': 'private, no-store, max-age=0',
  expires: '0',
  pragma: 'no-cache',
};

function addPrivateNoStoreHeaders(response: Response) {
  for (const [name, value] of Object.entries(privateNoStoreHeaders)) {
    response.headers.set(name, value);
  }

  return response;
}

function personalDataJsonResponse(
  request: Request,
  allowedOrigins: string[],
  status: number,
  payload: Record<string, unknown>,
  requestId: string,
  extraHeaders?: HeadersInit,
) {
  const headers: Record<string, string> = {};

  new Headers(extraHeaders).forEach((value, name) => {
    headers[name] = value;
  });
  Object.assign(headers, privateNoStoreHeaders);

  return jsonResponse(request, allowedOrigins, status, payload, {
    extraHeaders: headers,
    requestId,
  });
}

function isConfigured(config: PersonalDataHandlerDeps['config']) {
  return [
    config.supabasePublishableKey,
    config.supabaseServiceRoleKey,
    config.supabaseUrl,
  ].every((value) => value.trim().length > 0);
}

function isExportObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonByteLength(payload: Record<string, unknown>) {
  return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
}

function requestSecurityError(status: number) {
  if (status === 400) {
    return { code: 'invalid_request', error: 'Gecersiz istek.' };
  }

  if (status === 413) {
    return { code: 'request_too_large', error: 'Istek govdesi cok buyuk.' };
  }

  if (status >= 500) {
    return { code: 'security_unavailable', error: 'Istek dogrulama servisi kullanilamiyor.' };
  }

  return { code: 'invalid_signature', error: 'Istek dogrulanamadi.' };
}

export function createPersonalDataHandler({
  config,
  createAdminClient,
  createAuthClient,
}: PersonalDataHandlerDeps) {
  return async (request: Request) => {
    const context = createEdgeRequestContext(request, 'personal-data');

    if (request.method === 'OPTIONS') {
      return addPrivateNoStoreHeaders(
        corsPreflightResponse(request, config.allowedOrigins, context.requestId),
      );
    }

    if (request.method !== 'POST') {
      return personalDataJsonResponse(
        request,
        config.allowedOrigins,
        405,
        { code: 'method_not_allowed', error: 'Method not allowed' },
        context.requestId,
        { Allow: 'POST, OPTIONS' },
      );
    }

    if (!isConfigured(config)) {
      return personalDataJsonResponse(
        request,
        config.allowedOrigins,
        500,
        { code: 'misconfigured', error: 'Veri erisim servisi su anda kullanilamiyor.' },
        context.requestId,
      );
    }

    const token = getBearerToken(request.headers.get('Authorization'));

    if (!token) {
      return personalDataJsonResponse(
        request,
        config.allowedOrigins,
        401,
        { code: 'missing_authorization', error: 'Oturum bulunamadi.' },
        context.requestId,
      );
    }

    try {
      const adminClient = createAdminClient();
      const envelope = await verifyRequestEnvelope({
        adminClient,
        functionName: 'personal-data',
        maxBodyBytes: 1024,
        request,
      });

      if (!envelope.ok) {
        return personalDataJsonResponse(
          request,
          config.allowedOrigins,
          envelope.status,
          requestSecurityError(envelope.status),
          context.requestId,
        );
      }

      const authClient = createAuthClient(token);
      const claimsResult = await authClient.auth.getClaims(token);
      const userId = claimsResult.data?.claims?.sub?.trim();

      if (claimsResult.error || !userId) {
        return personalDataJsonResponse(
          request,
          config.allowedOrigins,
          401,
          { code: 'invalid_jwt', error: 'Oturum dogrulanamadi.' },
          context.requestId,
        );
      }

      const signed = await verifySignedRequest({
        adminClient,
        bodyText: envelope.bodyText,
        functionName: 'personal-data',
        request,
        token,
        userId,
      });

      if (!signed.ok) {
        return personalDataJsonResponse(
          request,
          config.allowedOrigins,
          signed.status,
          requestSecurityError(signed.status),
          context.requestId,
        );
      }

      const userResult = await authClient.auth.getUser(token);
      const liveUserId = userResult.data?.user?.id?.trim();

      if (userResult.error || !liveUserId || liveUserId !== userId) {
        return personalDataJsonResponse(
          request,
          config.allowedOrigins,
          401,
          { code: 'invalid_jwt', error: 'Oturum dogrulanamadi.' },
          context.requestId,
        );
      }

      const parsedPayload = payloadSchema.safeParse(parseJsonBody(signed.bodyText ?? ''));

      if (!parsedPayload.success) {
        return personalDataJsonResponse(
          request,
          config.allowedOrigins,
          400,
          { code: 'invalid_input', error: 'Gecersiz veri erisim istegi.' },
          context.requestId,
        );
      }

      const limit = await enforceRateLimit({
        adminClient,
        identifier: userId,
        maxRequests: 2,
        scope: 'personal-data:export',
        windowMs: 24 * 60 * 60_000,
      });

      if (!limit.allowed) {
        return personalDataJsonResponse(
          request,
          config.allowedOrigins,
          429,
          { code: 'rate_limited', error: 'Veri erisim istegi limiti asildi.' },
          context.requestId,
          rateLimitHeaders(limit, 2),
        );
      }

      const result = await adminClient.rpc('build_personal_data_export', {
        p_user_id: userId,
      });

      if (result.error || !isExportObject(result.data)) {
        throw new Error(result.error?.message ?? 'invalid_export');
      }

      const responsePayload = { data: result.data };

      if (jsonByteLength(responsePayload) > PERSONAL_DATA_EXPORT_RESPONSE_MAX_BYTES) {
        return personalDataJsonResponse(
          request,
          config.allowedOrigins,
          413,
          {
            code: 'export_too_large',
            error: 'Veri arsivi guvenli yanit boyutu sinirini asti.',
          },
          context.requestId,
          rateLimitHeaders(limit, 2),
        );
      }

      return personalDataJsonResponse(
        request,
        config.allowedOrigins,
        200,
        responsePayload,
        context.requestId,
        rateLimitHeaders(limit, 2),
      );
    } catch (error) {
      if (isHttpRequestError(error)) {
        return personalDataJsonResponse(
          request,
          config.allowedOrigins,
          error.status,
          { code: error.code, error: error.message },
          context.requestId,
        );
      }

      logEdgeEvent('error', 'Personal data export failed', context, {
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
      return personalDataJsonResponse(
        request,
        config.allowedOrigins,
        500,
        {
          code: 'export_unavailable',
          error: 'Veri erisim istegi su anda tamamlanamadi.',
        },
        context.requestId,
      );
    }
  };
}
