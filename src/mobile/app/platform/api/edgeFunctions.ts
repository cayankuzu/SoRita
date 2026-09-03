import type { ZodType } from 'zod';

import { env } from '@/mobile/app/platform/config/env';
import { createSignedEdgeHeaders } from '@/mobile/app/platform/security/requestSigning';
import { getOrCreateDeviceId } from '@/mobile/app/platform/storage/deviceId';
import { createUuid } from '@/shared/utils/id';

const DEFAULT_EDGE_REQUEST_TIMEOUT_MS = 15_000;
const MAX_EDGE_REQUEST_TIMEOUT_MS = 60_000;
const MAX_EDGE_ERROR_BODY_BYTES = 16 * 1024;
const MAX_EDGE_ERROR_MESSAGE_LENGTH = 1_024;
const MAX_EDGE_ERROR_CODE_LENGTH = 128;
const MAX_RETRY_AFTER_MS = 5 * 60_000;
const MAX_IDEMPOTENCY_KEY_LENGTH = 200;
const FUNCTION_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62})$/;
const GATEWAY_FUNCTION_NAME_CONTRACT = [
  ['auth-gateway', () => env.supabaseAuthGatewayFunctionName],
  ['delete-user', () => env.supabaseDeleteUserFunctionName],
  ['maps-geocoding', () => env.supabaseMapsFunctionName],
  ['media-assets', () => env.supabaseMediaAssetsFunctionName],
  ['moderation-reports', () => env.supabaseModerationReportsFunctionName],
] as const;

export type EdgeFunctionErrorCategory =
  | 'aborted'
  | 'configuration'
  | 'http'
  | 'invalid_response'
  | 'network'
  | 'timeout';

type EdgeFunctionErrorDetails = {
  category?: EdgeFunctionErrorCategory;
  requestId?: string;
  retryAfterMs?: number;
};

export class EdgeFunctionError extends Error {
  category: EdgeFunctionErrorCategory;
  code?: string;
  requestId?: string;
  retryAfterMs?: number;
  status: number;

  constructor(
    message: string,
    status: number,
    code?: string,
    details: EdgeFunctionErrorDetails = {},
  ) {
    super(message);
    this.category = details.category ?? 'http';
    this.code = code;
    this.name = 'EdgeFunctionError';
    this.requestId = details.requestId;
    this.retryAfterMs = details.retryAfterMs;
    this.status = status;
  }
}

export type EdgeFunctionRequestOptions<TResponse> = {
  accessToken?: string;
  idempotencyKey?: string;
  responseSchema?: ZodType<TResponse>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

function normalizeErrorText(value?: string) {
  return value?.trim().toLowerCase() ?? '';
}

export function isEdgeFunctionError(error: unknown): error is EdgeFunctionError {
  return error instanceof EdgeFunctionError;
}

export function isMissingEdgeFunctionError(error: unknown) {
  if (!isEdgeFunctionError(error)) {
    return false;
  }

  const normalizedCode = normalizeErrorText(error.code);
  const normalizedMessage = normalizeErrorText(error.message);

  return (
    normalizedCode === 'function_not_found' ||
    normalizedCode === 'functions_fetch_error' ||
    normalizedMessage.includes('requested function was not found') ||
    normalizedMessage.includes('function was not found')
  );
}

function configurationError(message: string) {
  return new EdgeFunctionError(message, 0, 'invalid_edge_configuration', {
    category: 'configuration',
  });
}

function normalizeFunctionName(functionName: string) {
  const normalized = functionName.trim().toLowerCase();

  if (!FUNCTION_NAME_PATTERN.test(normalized)) {
    throw configurationError('Edge Function name is invalid.');
  }

  return normalized;
}

function getSelectedGatewayFunctionNames() {
  for (const [expectedName, readConfiguredName] of GATEWAY_FUNCTION_NAME_CONTRACT) {
    if (normalizeFunctionName(readConfiguredName()) !== expectedName) {
      throw configurationError(
        'Gateway mode requires the canonical Edge Function route contract.',
      );
    }
  }

  return new Set<string>(GATEWAY_FUNCTION_NAME_CONTRACT.map(([expectedName]) => expectedName));
}

/**
 * Explicitly bypasses the gateway for flows that must communicate directly with
 * Supabase. Callers should use this only when an audited flow must avoid edge
 * body proxying; it is never used as an automatic failure fallback.
 */
export function getForceDirectFunctionUrl(functionName: string) {
  const normalizedFunctionName = normalizeFunctionName(functionName);
  const baseUrl = env.supabaseUrl.trim().replace(/\/+$/, '');

  if (!baseUrl) {
    throw configurationError('Supabase URL is missing.');
  }

  return `${baseUrl}/functions/v1/${normalizedFunctionName}`;
}

export function getFunctionUrl(functionName: string) {
  const normalizedFunctionName = normalizeFunctionName(functionName);

  // `undefined` preserves compatibility with older embedded config/test
  // adapters, which are equivalent to the default direct mode. An explicitly
  // invalid parsed config still fails closed.
  if (env.edgeConfigValid === false) {
    throw configurationError('Public Edge configuration is invalid.');
  }

  if (
    env.edgeCutoverMode === 'gateway' &&
    getSelectedGatewayFunctionNames().has(normalizedFunctionName)
  ) {
    if (!env.edgeApiUrl) {
      throw configurationError('Edge API URL is required in gateway mode.');
    }

    return `${env.edgeApiUrl}/v1/${normalizedFunctionName}`;
  }

  return getForceDirectFunctionUrl(normalizedFunctionName);
}

function createRequestId() {
  return createUuid();
}

function hasControlCharacters(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code <= 31 || code === 127) {
      return true;
    }
  }

  return false;
}

function replaceControlCharacters(value: string) {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : character;
  }).join('');
}

function normalizeBoundedString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = replaceControlCharacters(value)
    .replace(/\s+/g, ' ')
    .trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

async function readBoundedErrorText(response: Response) {
  const contentLengthHeader = response.headers.get('content-length');
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null;

  if (contentLength != null && Number.isFinite(contentLength) && contentLength > MAX_EDGE_ERROR_BODY_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    return { text: '', truncated: true };
  }

  const reader = response.body?.getReader();

  if (reader) {
    const decoder = new TextDecoder();
    let byteCount = 0;
    let text = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        text += decoder.decode();
        return { text, truncated: false };
      }

      if (!value) {
        continue;
      }

      const remainingBytes = MAX_EDGE_ERROR_BODY_BYTES - byteCount;

      if (value.byteLength > remainingBytes) {
        text += decoder.decode(value.slice(0, Math.max(0, remainingBytes)), { stream: true });
        text += decoder.decode();
        await reader.cancel().catch(() => undefined);
        return { text, truncated: true };
      }

      byteCount += value.byteLength;
      text += decoder.decode(value, { stream: true });
    }
  }

  const text = await response.text();
  const encodedText = new TextEncoder().encode(text);

  if (encodedText.byteLength <= MAX_EDGE_ERROR_BODY_BYTES) {
    return { text, truncated: false };
  }

  return {
    text: new TextDecoder().decode(encodedText.slice(0, MAX_EDGE_ERROR_BODY_BYTES)),
    truncated: true,
  };
}

async function readEdgeFunctionError(response: Response) {
  const fallbackMessage = response.statusText || `Request failed (${response.status})`;
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const body = await readBoundedErrorText(response);
  const trimmedBody = body.text.trim();

  if (body.truncated || !trimmedBody || contentType.includes('text/html')) {
    return {
      code: undefined,
      message: fallbackMessage,
    };
  }

  try {
    const parsedBody = JSON.parse(trimmedBody) as unknown;

    if (parsedBody && typeof parsedBody === 'object') {
      const record = parsedBody as Record<string, unknown>;
      const code = normalizeBoundedString(record.code, MAX_EDGE_ERROR_CODE_LENGTH);
      const message =
        normalizeBoundedString(record.error, MAX_EDGE_ERROR_MESSAGE_LENGTH) ??
        normalizeBoundedString(record.message, MAX_EDGE_ERROR_MESSAGE_LENGTH);

      if (message) {
        return { code, message };
      }
    }
  } catch {
    const message = normalizeBoundedString(trimmedBody, MAX_EDGE_ERROR_MESSAGE_LENGTH);

    if (message) {
      return {
        code: undefined,
        message,
      };
    }
  }

  return {
    code: undefined,
    message: fallbackMessage,
  };
}

function normalizeIdempotencyKey(value?: string) {
  if (value == null) {
    return undefined;
  }

  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length > MAX_IDEMPOTENCY_KEY_LENGTH ||
    hasControlCharacters(normalized)
  ) {
    throw configurationError('Idempotency key is invalid.');
  }

  return normalized;
}

function serializePayload(payload: Record<string, unknown>) {
  try {
    return JSON.stringify(payload);
  } catch {
    throw new EdgeFunctionError(
      'Edge Function request payload could not be serialized.',
      0,
      'invalid_request_payload',
      { category: 'configuration' },
    );
  }
}

async function createUnsignedHeaders(requestId: string, idempotencyKey?: string) {
  return {
    'Content-Type': 'application/json',
    apikey: env.supabasePublishableKey,
    'x-device-id': await getOrCreateDeviceId(),
    'x-request-id': requestId,
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  };
}

async function createSignedHeaders(
  accessToken: string,
  bodyText: string,
  functionName: string,
  requestId: string,
  idempotencyKey?: string,
) {
  const signedHeaders = await createSignedEdgeHeaders({
    accessToken,
    bodyText,
    functionName,
    method: 'POST',
  });

  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    apikey: env.supabasePublishableKey,
    ...signedHeaders,
    'x-request-id': requestId,
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  };
}

function normalizeTimeoutMs(timeoutMs?: number) {
  if (timeoutMs == null) {
    return DEFAULT_EDGE_REQUEST_TIMEOUT_MS;
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_EDGE_REQUEST_TIMEOUT_MS) {
    throw configurationError(
      `Edge request timeout must be between 1 and ${MAX_EDGE_REQUEST_TIMEOUT_MS} milliseconds.`,
    );
  }

  return Math.floor(timeoutMs);
}

function createMergedRequestSignal(externalSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let externallyAborted = externalSignal?.aborted ?? false;
  let timedOut = false;

  const onExternalAbort = () => {
    externallyAborted = true;
    controller.abort();
  };

  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
  }

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    cleanup() {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    },
    externallyAborted: () => externallyAborted,
    signal: controller.signal,
    timedOut: () => timedOut,
  };
}

function isAbortError(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'AbortError',
  );
}

function readRetryAfterMs(response: Response, now = Date.now()) {
  const rawValue = response.headers.get('retry-after')?.trim();

  if (!rawValue) {
    return undefined;
  }

  const seconds = Number(rawValue);
  const retryAfterMs = Number.isFinite(seconds)
    ? seconds * 1_000
    : Date.parse(rawValue) - now;

  return Number.isFinite(retryAfterMs)
    ? Math.max(0, Math.min(Math.round(retryAfterMs), MAX_RETRY_AFTER_MS))
    : undefined;
}

function readResponseRequestId(response: Response, fallbackRequestId: string) {
  return (
    response.headers.get('x-request-id')?.trim() ||
    response.headers.get('x-correlation-id')?.trim() ||
    fallbackRequestId
  );
}

async function parseSuccessResponse<TResponse>(
  response: Response,
  requestId: string,
  responseSchema?: ZodType<TResponse>,
) {
  const responseText = await response.text();
  let payload: unknown;

  try {
    payload = JSON.parse(responseText) as unknown;
  } catch {
    throw new EdgeFunctionError(
      'Edge Function returned an invalid JSON response.',
      response.status,
      'invalid_response',
      { category: 'invalid_response', requestId },
    );
  }

  if (responseSchema) {
    const parsedPayload = await responseSchema.safeParseAsync(payload);

    if (!parsedPayload.success) {
      throw new EdgeFunctionError(
        'Edge Function response did not match the expected schema.',
        response.status,
        'invalid_response',
        { category: 'invalid_response', requestId },
      );
    }

    return parsedPayload.data;
  }

  // Backward-compatible path for existing typed callers. New security-sensitive
  // boundaries should pass responseSchema so runtime data is never trusted by cast.
  return payload as TResponse;
}

export async function callJsonEdgeFunction<TResponse>(
  functionName: string,
  payload: Record<string, unknown>,
  options: EdgeFunctionRequestOptions<TResponse> = {},
): Promise<TResponse> {
  const normalizedFunctionName = normalizeFunctionName(functionName);
  const requestId = createRequestId();

  if (options.signal?.aborted) {
    throw new EdgeFunctionError('Edge Function request was cancelled.', 0, 'request_aborted', {
      category: 'aborted',
      requestId,
    });
  }

  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
  const idempotencyKey = normalizeIdempotencyKey(options.idempotencyKey);
  const bodyText = serializePayload(payload);
  const functionUrl = getFunctionUrl(normalizedFunctionName);
  const abortState = createMergedRequestSignal(options.signal, timeoutMs);

  try {
    const headers = options.accessToken
      ? await createSignedHeaders(
          options.accessToken,
          bodyText,
          normalizedFunctionName,
          requestId,
          idempotencyKey,
        )
      : await createUnsignedHeaders(requestId, idempotencyKey);
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers,
      body: bodyText,
      signal: abortState.signal,
    });
    const responseRequestId = readResponseRequestId(response, requestId);

    if (!response.ok) {
      const edgeError = await readEdgeFunctionError(response);
      throw new EdgeFunctionError(edgeError.message, response.status, edgeError.code, {
        category: 'http',
        requestId: responseRequestId,
        retryAfterMs: readRetryAfterMs(response),
      });
    }

    return await parseSuccessResponse(response, responseRequestId, options.responseSchema);
  } catch (error) {
    if (isEdgeFunctionError(error)) {
      throw error;
    }

    if (abortState.timedOut()) {
      throw new EdgeFunctionError('Edge Function request timed out.', 0, 'request_timeout', {
        category: 'timeout',
        requestId,
      });
    }

    if (abortState.externallyAborted() || isAbortError(error)) {
      throw new EdgeFunctionError('Edge Function request was cancelled.', 0, 'request_aborted', {
        category: 'aborted',
        requestId,
      });
    }

    throw new EdgeFunctionError('Edge Function request failed.', 0, 'network_error', {
      category: 'network',
      requestId,
    });
  } finally {
    abortState.cleanup();
  }
}
