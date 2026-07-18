import { env } from '@/mobile/app/platform/config/env';
import { createSignedEdgeHeaders } from '@/mobile/app/platform/security/requestSigning';
import { getOrCreateDeviceId } from '@/mobile/app/platform/storage/deviceId';

export class EdgeFunctionError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.code = code;
    this.name = 'EdgeFunctionError';
    this.status = status;
  }
}

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

export function getFunctionUrl(functionName: string) {
  const baseUrl = env.supabaseUrl.replace(/\/+$/, '');
  return `${baseUrl}/functions/v1/${functionName}`;
}

function createRequestId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `req-${Date.now()}`;
}

async function readEdgeFunctionError(response: Response) {
  const bodyText = await response.text().catch(() => '');
  const trimmedBody = bodyText.trim();

  if (!trimmedBody) {
    return {
      code: undefined,
      message: response.statusText || `Request failed (${response.status})`,
    };
  }

  try {
    const parsedBody = JSON.parse(trimmedBody);
    const code =
      parsedBody &&
      typeof parsedBody === 'object' &&
      'code' in parsedBody &&
      typeof parsedBody.code === 'string' &&
      parsedBody.code.trim()
        ? parsedBody.code
        : undefined;

    if (
      parsedBody &&
      typeof parsedBody === 'object' &&
      'error' in parsedBody &&
      typeof parsedBody.error === 'string' &&
      parsedBody.error.trim()
    ) {
      return {
        code,
        message: parsedBody.error,
      };
    }

    if (
      parsedBody &&
      typeof parsedBody === 'object' &&
      'message' in parsedBody &&
      typeof parsedBody.message === 'string' &&
      parsedBody.message.trim()
    ) {
      return {
        code,
        message: parsedBody.message,
      };
    }
  } catch {
    return {
      code: undefined,
      message: trimmedBody,
    };
  }

  return {
    code: undefined,
    message: response.statusText || `Request failed (${response.status})`,
  };
}

async function createUnsignedHeaders() {
  return {
    'Content-Type': 'application/json',
    apikey: env.supabasePublishableKey,
    'x-device-id': await getOrCreateDeviceId(),
    'x-request-id': createRequestId(),
  };
}

async function createSignedHeaders(accessToken: string, bodyText: string) {
  const signedHeaders = await createSignedEdgeHeaders({
    accessToken,
    bodyText,
  });

  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    apikey: env.supabasePublishableKey,
    'x-request-id': createRequestId(),
    ...signedHeaders,
  };
}

export async function callJsonEdgeFunction<TResponse>(
  functionName: string,
  payload: Record<string, unknown>,
  options?: {
    accessToken?: string;
  },
): Promise<TResponse> {
  const bodyText = JSON.stringify(payload);
  const headers = options?.accessToken
    ? await createSignedHeaders(options.accessToken, bodyText)
    : await createUnsignedHeaders();
  const response = await fetch(getFunctionUrl(functionName), {
    method: 'POST',
    headers,
    body: bodyText,
  });

  if (!response.ok) {
    const edgeError = await readEdgeFunctionError(response);
    throw new EdgeFunctionError(edgeError.message, response.status, edgeError.code);
  }

  return (await response.json()) as TResponse;
}
