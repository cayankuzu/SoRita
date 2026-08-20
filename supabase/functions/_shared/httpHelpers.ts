/**
 * Shared HTTP utilities for Supabase Edge Functions.
 * Eliminates duplication of CORS headers, JSON responses, and auth helpers.
 */

type JsonResponseOptions = {
  extraHeaders?: HeadersInit;
  requestId?: string;
};

export class HttpRequestError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HttpRequestError';
    this.code = code;
    this.status = status;
  }
}

function getSecurityHeaders() {
  return {
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
}

export function getCorsHeaders(request: Request, allowedOrigins: string[], requestId?: string) {
  const requestOrigin = request.headers.get('Origin');
  const allowedOrigin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0] ?? 'null';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-admin-token, x-device-id, x-nonce, x-signature, x-timestamp, x-request-id',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
    ...getSecurityHeaders(),
    'Vary': 'Origin',
    ...(requestId ? { 'X-Request-Id': requestId } : {}),
  };
}

export function jsonResponse(
  request: Request,
  allowedOrigins: string[],
  status: number,
  payload: Record<string, unknown>,
  options?: JsonResponseOptions,
) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...getCorsHeaders(request, allowedOrigins, options?.requestId),
      ...(options?.extraHeaders ?? {}),
    },
  });
}

export function corsPreflightResponse(
  request: Request,
  allowedOrigins: string[],
  requestId?: string,
) {
  return new Response('ok', { headers: getCorsHeaders(request, allowedOrigins, requestId) });
}

export function isHttpRequestError(error: unknown): error is HttpRequestError {
  return error instanceof HttpRequestError;
}

export function parseJsonBody(bodyText: string, emptyValue: unknown = {}) {
  const normalizedBody = bodyText.trim();

  if (!normalizedBody) {
    return emptyValue;
  }

  try {
    return JSON.parse(normalizedBody) as unknown;
  } catch {
    throw new HttpRequestError(400, 'invalid_json', 'Malformed JSON body');
  }
}

export function getBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  return authorization.replace(/^Bearer\s+/i, '').trim() || null;
}

export type ErrorLike = {
  code?: string;
  message: string;
};

export type ClaimsResult = {
  data?: { claims?: { sub?: string } | null } | null;
  error?: ErrorLike | null;
};

export type AuthClientLike = {
  auth: {
    getClaims: (token: string) => Promise<ClaimsResult>;
  };
};
