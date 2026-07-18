type ErrorLike = {
  code?: string;
  message: string;
};

type NonceStoreLike = {
  delete: () => {
    lt: (column: string, value: string) => Promise<{ error?: ErrorLike | null }>;
  };
  insert: (payload: Record<string, unknown>) => Promise<{ error?: ErrorLike | null }>;
};

type AdminClientLike = {
  from: (table: string) => NonceStoreLike;
};

const REQUEST_TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;
const REQUEST_NONCES_TABLE = 'request_nonces';

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function isValidDeviceId(value: string | null) {
  return Boolean(value && /^[a-zA-Z0-9_-]{8,128}$/.test(value));
}

function isValidNonce(value: string | null) {
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
  nonce: string;
  payloadHash: string;
  timestamp: string;
}) {
  return [
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

export async function verifySignedRequest(params: {
  adminClient: AdminClientLike;
  functionName: string;
  request: Request;
  token: string;
  userId: string;
}) {
  const deviceId = params.request.headers.get('x-device-id');
  const nonce = params.request.headers.get('x-nonce');
  const timestamp = params.request.headers.get('x-timestamp');
  const signature = params.request.headers.get('x-signature');

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

  const rawBody = await params.request.text();
  const payloadHash = await sha256Hex(rawBody);
  const expectedSignature = await createRequestSignature(params.token, {
    deviceId,
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

  await params.adminClient
    .from(REQUEST_NONCES_TABLE)
    .delete()
    .lt('expires_at', new Date().toISOString());

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
