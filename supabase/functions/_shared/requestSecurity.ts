import {
  completeTrustedEdgeOriginVerification,
  verifyTrustedEdgeOriginHeaders,
} from './originSecurity.ts';

type ErrorLike = {
  code?: string;
  message: string;
};

type NonceStoreLike = {
  insert: (payload: Record<string, unknown>) => Promise<{ error?: ErrorLike | null }>;
};

type AdminClientLike = {
  from: (table: string) => NonceStoreLike;
  rpc?: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data?: unknown; error?: ErrorLike | null }>;
};

const REQUEST_TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;
const REQUEST_NONCES_TABLE = 'request_nonces';
const DEFAULT_MAX_REQUEST_BODY_BYTES = 64 * 1024;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function isValidDeviceId(value: string | null): value is string {
  return Boolean(value && /^[a-zA-Z0-9_-]{8,128}$/.test(value));
}

function isValidNonce(value: string | null): value is string {
  return Boolean(value && /^[a-zA-Z0-9-]{16,128}$/.test(value));
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

export function buildRequestSigningMessage(params: {
  deviceId: string;
  functionName: string;
  method: string;
  nonce: string;
  payloadHash: string;
  timestamp: string;
}) {
  return [
    params.method.toUpperCase(),
    params.functionName,
    params.deviceId,
    params.timestamp,
    params.nonce,
    params.payloadHash,
  ].join(':');
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function createRequestSignature(
  secret: string,
  params: {
    deviceId: string;
    functionName: string;
    method: string;
    nonce: string;
    payloadHash: string;
    timestamp: string;
  },
) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    {
      hash: 'SHA-256',
      name: 'HMAC',
    },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(buildRequestSigningMessage(params)),
  );

  return bytesToHex(new Uint8Array(signature));
}

function validateRequestSignatureHeaders(request: Request) {
  const deviceId = request.headers.get('x-device-id');
  const nonce = request.headers.get('x-nonce');
  const timestamp = request.headers.get('x-timestamp');
  const signature = request.headers.get('x-signature');

  if (!isValidDeviceId(deviceId) || !isValidNonce(nonce) || !timestamp || !signature) {
    return {
      error: 'Missing or invalid request signature headers',
      ok: false as const,
      status: 401,
    };
  }

  const timestampValue = Number(timestamp);
  if (!Number.isFinite(timestampValue)) {
    return {
      error: 'Invalid request timestamp',
      ok: false as const,
      status: 401,
    };
  }

  if (Math.abs(Date.now() - timestampValue) > REQUEST_TIMESTAMP_WINDOW_MS) {
    return {
      error: 'Request timestamp expired',
      ok: false as const,
      status: 401,
    };
  }

  return { deviceId, nonce, ok: true as const, signature, timestamp };
}

export async function readBoundedRequestBody(
  request: Request,
  maxBytes = DEFAULT_MAX_REQUEST_BODY_BYTES,
) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 16 * 1024 * 1024) {
    throw new Error('Invalid request body limit');
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0) {
      return { error: 'Invalid Content-Length header', ok: false as const, status: 400 };
    }
    if (declaredBytes > maxBytes) {
      return { error: 'Request body exceeds size limit', ok: false as const, status: 413 };
    }
  }

  if (!request.body) {
    return { bodyText: '', ok: true as const };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bodyText = '';
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel('request body exceeds size limit').catch(() => undefined);
        return { error: 'Request body exceeds size limit', ok: false as const, status: 413 };
      }
      bodyText += decoder.decode(value, { stream: true });
    }
    bodyText += decoder.decode();
  } catch {
    return { error: 'Request body is not valid UTF-8', ok: false as const, status: 400 };
  } finally {
    reader.releaseLock();
  }

  return { bodyText, ok: true as const };
}

export async function verifyRequestEnvelope(params: {
  adminClient: AdminClientLike;
  functionName: string;
  maxBodyBytes?: number;
  request: Request;
}) {
  const signatureHeaders = validateRequestSignatureHeaders(params.request);
  if (!signatureHeaders.ok) return signatureHeaders;

  // Authenticate the Worker headers before consuming a potentially streamed
  // body. The signed body hash is checked after bounded reading.
  const originPreflight = await verifyTrustedEdgeOriginHeaders({
    functionName: params.functionName,
    request: params.request,
  });
  if (!originPreflight.ok) return originPreflight;

  const bodyResult = await readBoundedRequestBody(
    params.request,
    params.maxBodyBytes ?? DEFAULT_MAX_REQUEST_BODY_BYTES,
  );
  if (!bodyResult.ok) return bodyResult;

  const originResult = await completeTrustedEdgeOriginVerification({
    adminClient: params.adminClient,
    bodyText: bodyResult.bodyText,
    functionName: params.functionName,
    preflight: originPreflight,
  });
  if (!originResult.ok) return originResult;

  return { bodyText: bodyResult.bodyText, ok: true as const };
}

export async function verifySignedRequest(params: {
  adminClient: AdminClientLike;
  bodyText?: string;
  functionName: string;
  request: Request;
  token: string;
  userId: string;
}) {
  const signatureHeaders = validateRequestSignatureHeaders(params.request);
  if (!signatureHeaders.ok) return signatureHeaders;
  const { deviceId, nonce, signature, timestamp } = signatureHeaders;
  const envelope = params.bodyText === undefined
    ? await verifyRequestEnvelope({
        adminClient: params.adminClient,
        functionName: params.functionName,
        request: params.request,
      })
    : { bodyText: params.bodyText, ok: true as const };
  if (!envelope.ok) return envelope;
  const rawBody = envelope.bodyText;

  const payloadHash = await sha256Hex(rawBody);
  const expectedSignature = await createRequestSignature(params.token, {
    deviceId,
    functionName: params.functionName,
    method: params.request.method,
    nonce,
    payloadHash,
    timestamp,
  });

  if (!timingSafeEqual(expectedSignature, signature)) {
    return {
      error: 'Request signature verification failed',
      ok: false as const,
      status: 401,
    };
  }

  const { error: nonceError } = await params.adminClient.from(REQUEST_NONCES_TABLE).insert({
    device_id: deviceId,
    expires_at: new Date(Date.now() + REQUEST_TIMESTAMP_WINDOW_MS).toISOString(),
    function_name: params.functionName,
    nonce,
    user_id: params.userId,
  });

  if (nonceError?.code === '23505') {
    return {
      error: 'Replay detected',
      ok: false as const,
      status: 409,
    };
  }

  if (nonceError) {
    return {
      error: nonceError.message,
      ok: false as const,
      status: 500,
    };
  }

  return {
    bodyText: rawBody,
    ok: true as const,
  };
}
