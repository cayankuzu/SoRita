type ErrorLike = {
  code?: string;
  message: string;
};

type OriginNonceRpcClientLike = {
  rpc?: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data?: unknown; error?: ErrorLike | null }>;
};

export type TrustedEdgeOriginConfig = {
  required: boolean;
  secret?: string;
};

const ORIGIN_TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;
const ORIGIN_NONCE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BODY_HASH_PATTERN = /^[a-f0-9]{64}$/;
const SIGNATURE_PATTERN = /^v1=[A-Za-z0-9_-]{43}$/;
const TRUSTED_FUNCTION_NAMES = new Set([
  'auth-gateway',
  'delete-user',
  'maps-geocoding',
  'media-assets',
  'moderation-reports',
]);

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

async function hmacSha256Base64Url(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export function buildTrustedEdgeOriginSigningMessage(params: {
  bodyHash: string;
  canonicalPath: string;
  method: string;
  nonce: string;
  timestamp: string;
}) {
  return [
    params.timestamp,
    params.nonce,
    params.method.toUpperCase(),
    params.canonicalPath,
    params.bodyHash,
  ].join('\n');
}

export async function createTrustedEdgeOriginSignature(params: {
  bodyText: string;
  functionName: string;
  method?: string;
  nonce: string;
  secret: string;
  timestamp: string;
}) {
  const bodyHash = await sha256Hex(params.bodyText);
  const signature = await createTrustedEdgeOriginSignatureForBodyHash({
    bodyHash,
    functionName: params.functionName,
    method: params.method,
    nonce: params.nonce,
    secret: params.secret,
    timestamp: params.timestamp,
  });

  return { bodyHash, signature };
}

async function createTrustedEdgeOriginSignatureForBodyHash(params: {
  bodyHash: string;
  functionName: string;
  method?: string;
  nonce: string;
  secret: string;
  timestamp: string;
}) {
  const canonicalPath = `/functions/v1/${params.functionName}`;
  const message = buildTrustedEdgeOriginSigningMessage({
    bodyHash: params.bodyHash,
    canonicalPath,
    method: params.method ?? 'POST',
    nonce: params.nonce,
    timestamp: params.timestamp,
  });
  const signature = await hmacSha256Base64Url(params.secret, message);

  return `v1=${signature}`;
}

function readDenoEnvironment(name: string) {
  try {
    return Deno.env.get(name);
  } catch {
    return undefined;
  }
}

function readTrustedEdgeOriginConfig(): TrustedEdgeOriginConfig | null {
  const rawRequired = readDenoEnvironment('CLOUDFLARE_ORIGIN_SIGNATURE_REQUIRED')?.trim().toLowerCase();

  if (rawRequired !== 'true' && rawRequired !== 'false') {
    return null;
  }

  return {
    required: rawRequired === 'true',
    secret: readDenoEnvironment('CLOUDFLARE_ORIGIN_HMAC_SECRET'),
  };
}

function hasAnyOriginHeader(request: Request) {
  return [
    'x-sorita-edge-body-sha256',
    'x-sorita-edge-nonce',
    'x-sorita-edge-signature',
    'x-sorita-edge-timestamp',
  ].some((name) => request.headers.has(name));
}

function readClaimResult(data: unknown) {
  if (typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data) && typeof data[0] === 'boolean') {
    return data[0];
  }

  return null;
}

export async function verifyTrustedEdgeOriginHeaders(params: {
  config?: TrustedEdgeOriginConfig;
  functionName: string;
  nowMs?: number;
  request: Request;
}) {
  const config = params.config ?? readTrustedEdgeOriginConfig();

  if (!config) {
    return {
      error: 'Cloudflare origin signature configuration is invalid',
      ok: false as const,
      status: 500,
    };
  }

  const hasOriginHeaders = hasAnyOriginHeader(params.request);

  if (!config.required && !hasOriginHeaders) {
    return { mode: 'direct' as const, ok: true as const };
  }

  if (!TRUSTED_FUNCTION_NAMES.has(params.functionName) || !config.secret || config.secret.length < 32) {
    return {
      error: config.required
        ? 'Cloudflare origin signature configuration is unavailable'
        : 'Cloudflare origin signature is invalid',
      ok: false as const,
      status: config.required ? 500 : 401,
    };
  }

  const timestamp = params.request.headers.get('x-sorita-edge-timestamp');
  const nonce = params.request.headers.get('x-sorita-edge-nonce');
  const suppliedBodyHash = params.request.headers.get('x-sorita-edge-body-sha256');
  const suppliedSignature = params.request.headers.get('x-sorita-edge-signature');

  if (
    !timestamp ||
    !/^\d{10,16}$/.test(timestamp) ||
    !nonce ||
    !ORIGIN_NONCE_PATTERN.test(nonce) ||
    !suppliedBodyHash ||
    !BODY_HASH_PATTERN.test(suppliedBodyHash) ||
    !suppliedSignature ||
    !SIGNATURE_PATTERN.test(suppliedSignature)
  ) {
    return {
      error: 'Missing or invalid Cloudflare origin signature headers',
      ok: false as const,
      status: 401,
    };
  }

  const timestampMs = Number(timestamp);
  const nowMs = params.nowMs ?? Date.now();

  if (!Number.isSafeInteger(timestampMs) || Math.abs(nowMs - timestampMs) > ORIGIN_TIMESTAMP_WINDOW_MS) {
    return {
      error: 'Cloudflare origin signature timestamp expired',
      ok: false as const,
      status: 401,
    };
  }

  const expectedSignature = await createTrustedEdgeOriginSignatureForBodyHash({
    bodyHash: suppliedBodyHash,
    functionName: params.functionName,
    method: params.request.method,
    nonce,
    secret: config.secret,
    timestamp,
  });

  if (!timingSafeEqual(expectedSignature, suppliedSignature)) {
    return {
      error: 'Cloudflare origin signature verification failed',
      ok: false as const,
      status: 401,
    };
  }

  return {
    bodyHash: suppliedBodyHash,
    mode: 'cloudflare' as const,
    nonce,
    ok: true as const,
  };
}

export async function completeTrustedEdgeOriginVerification(params: {
  adminClient: OriginNonceRpcClientLike;
  bodyText: string;
  functionName: string;
  preflight: Awaited<ReturnType<typeof verifyTrustedEdgeOriginHeaders>>;
}) {
  if (!params.preflight.ok) {
    return params.preflight;
  }

  if (params.preflight.mode === 'direct') {
    return params.preflight;
  }

  const actualBodyHash = await sha256Hex(params.bodyText);
  if (!timingSafeEqual(actualBodyHash, params.preflight.bodyHash)) {
    return {
      error: 'Cloudflare origin signature verification failed',
      ok: false as const,
      status: 401,
    };
  }

  if (!params.adminClient.rpc) {
    return {
      error: 'Cloudflare origin replay protection is unavailable',
      ok: false as const,
      status: 500,
    };
  }

  const { data, error } = await params.adminClient.rpc('claim_cloudflare_origin_nonce', {
    input_function_name: params.functionName,
    input_nonce: params.preflight.nonce,
  });

  if (error) {
    return {
      error: 'Cloudflare origin replay protection is unavailable',
      ok: false as const,
      status: 500,
    };
  }

  const claimed = readClaimResult(data);

  if (claimed === false) {
    return {
      error: 'Cloudflare origin signature replay detected',
      ok: false as const,
      status: 409,
    };
  }

  if (claimed !== true) {
    return {
      error: 'Cloudflare origin replay protection returned an invalid result',
      ok: false as const,
      status: 500,
    };
  }

  return { mode: 'cloudflare' as const, ok: true as const };
}

export async function verifyTrustedEdgeOrigin(params: {
  adminClient: OriginNonceRpcClientLike;
  bodyText: string;
  config?: TrustedEdgeOriginConfig;
  functionName: string;
  nowMs?: number;
  request: Request;
}) {
  const preflight = await verifyTrustedEdgeOriginHeaders({
    config: params.config,
    functionName: params.functionName,
    nowMs: params.nowMs,
    request: params.request,
  });

  return completeTrustedEdgeOriginVerification({
    adminClient: params.adminClient,
    bodyText: params.bodyText,
    functionName: params.functionName,
    preflight,
  });
}
