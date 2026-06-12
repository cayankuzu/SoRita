import { verifySignedRequest } from '../_shared/requestSecurity.ts';

type ErrorLike = {
  message: string;
};

type ClaimsResult = {
  data?: {
    claims?: {
      sub?: string;
    } | null;
  } | null;
  error?: ErrorLike | null;
};

type AuthClientLike = {
  auth: {
    getClaims: (token: string) => Promise<ClaimsResult>;
  };
};

type StorageBucketLike = {
  getPublicUrl: (path: string) => {
    data: {
      publicUrl: string;
    };
  };
  remove: (paths: string[]) => Promise<{ error?: ErrorLike | null }>;
  upload: (
    path: string,
    bytes: Uint8Array,
    options: { contentType: string; upsert: boolean },
  ) => Promise<{ error?: ErrorLike | null }>;
};

type AdminClientLike = {
  storage: {
    from: (bucket: string) => StorageBucketLike;
  };
};

export type MediaAssetsHandlerConfig = {
  allowedOrigins: string[];
  supabasePublishableKey: string;
  supabaseServiceRoleKey: string;
  supabaseUrl: string;
};

export type MediaAssetsHandlerDeps = {
  config: MediaAssetsHandlerConfig;
  createAdminClient: () => AdminClientLike;
  createAuthClient: (token: string) => AuthClientLike;
      createRequestId?: () => string;
};

const allowedBuckets = new Set(['profile-media', 'place-media']);
const allowedContentTypes = new Set([
  'image/heic',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const maxUploadBytes = 5 * 1024 * 1024;
const maxDeletePathsPerRequest = 64;

function getCorsHeaders(request: Request, allowedOrigins: string[]) {
  const requestOrigin = request.headers.get('Origin');
  const allowedOrigin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0] ?? 'null';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-device-id, x-nonce, x-signature, x-timestamp',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
  };
}

function jsonResponse(
  request: Request,
  allowedOrigins: string[],
  status: number,
  payload: Record<string, unknown>,
) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: getCorsHeaders(request, allowedOrigins),
  });
}

function getBearerToken(authorization: string | null) {
  if (!authorization) {
    return null;
  }

  return authorization.replace(/^Bearer\s+/i, '').trim() || null;
}

function assertBucket(value: unknown): 'profile-media' | 'place-media' {
  if (typeof value !== 'string' || !allowedBuckets.has(value)) {
    throw new Error('Invalid media bucket');
  }

  return value as 'profile-media' | 'place-media';
}

function sanitizePrefix(value: unknown) {
  if (typeof value !== 'string') {
    throw new Error('Invalid upload prefix');
  }

  const prefix = value.trim().replace(/^\/+|\/+$/g, '');

  if (!/^[a-zA-Z0-9/_-]{1,160}$/.test(prefix) || prefix.includes('..')) {
    throw new Error('Invalid upload prefix');
  }

  return prefix;
}

function sanitizeExtension(value: unknown, contentType: string) {
  const extension = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const fallback = contentType.split('/')[1] || 'jpg';
  const normalized = extension || fallback;

  if (!/^(jpg|jpeg|png|webp|heic)$/.test(normalized)) {
    throw new Error('Invalid media extension');
  }

  return normalized === 'jpeg' ? 'jpg' : normalized;
}

function decodeBase64Payload(base64Value: unknown) {
  if (typeof base64Value !== 'string' || !base64Value.trim()) {
    throw new Error('Missing media payload');
  }

  let binary = '';

  try {
    const normalized = base64Value.replace(/^data:[^;]+;base64,/, '');
    binary = atob(normalized);
  } catch {
    throw new Error('Malformed media payload');
  }

  if (binary.length > maxUploadBytes) {
    throw new Error('Media payload exceeds size limit');
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function matchesBytes(bytes: Uint8Array, expected: number[], offset = 0) {
  if (bytes.length < offset + expected.length) {
    return false;
  }

  return expected.every((value, index) => bytes[offset + index] === value);
}

function assertMediaSignature(contentType: string, bytes: Uint8Array) {
  if (contentType === 'image/png' && matchesBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return;
  }

  if (contentType === 'image/jpeg' && matchesBytes(bytes, [0xff, 0xd8, 0xff])) {
    return;
  }

  if (
    contentType === 'image/webp' &&
    matchesBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    matchesBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return;
  }

  if (
    contentType === 'image/heic' &&
    matchesBytes(bytes, [0x66, 0x74, 0x79, 0x70], 4) &&
    ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(
      String.fromCharCode(...bytes.slice(8, 12)),
    )
  ) {
    return;
  }

  throw new Error('Media payload does not match content type');
}

function getOwnedPath(userId: string, value: unknown) {
  if (typeof value !== 'string') {
    throw new Error('Invalid storage path');
  }

  const normalized = value.trim().replace(/^\/+/, '');

  if (!normalized.startsWith(`${userId}/`) || normalized.includes('..')) {
    throw new Error('Storage path is outside the authenticated user scope');
  }

  return normalized;
}

export function createMediaAssetsHandler({
  config,
  createAdminClient,
  createAuthClient,
  createRequestId = () => crypto.randomUUID(),
}: MediaAssetsHandlerDeps) {
  return async function handleMediaAssetsRequest(request: Request) {
    const { allowedOrigins, supabasePublishableKey, supabaseServiceRoleKey, supabaseUrl } = config;

    try {
      if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: getCorsHeaders(request, allowedOrigins) });
      }

      if (request.method !== 'POST') {
        return jsonResponse(request, allowedOrigins, 405, { error: 'Method not allowed' });
      }

      if (!supabaseUrl || !supabasePublishableKey || !supabaseServiceRoleKey) {
        return jsonResponse(request, allowedOrigins, 500, { error: 'Function is not configured' });
      }

      const token = getBearerToken(request.headers.get('Authorization'));

      if (!token) {
        return jsonResponse(request, allowedOrigins, 401, { error: 'Missing authorization header' });
      }

      const authClient = createAuthClient(token);
      const {
        data,
        error: claimsError,
      } = await authClient.auth.getClaims(token);
      const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null;

      if (claimsError || !userId) {
        return jsonResponse(request, allowedOrigins, 401, { error: claimsError?.message ?? 'Invalid JWT' });
      }

      const adminClient = createAdminClient();
      const securityResult = await verifySignedRequest({
        adminClient,
        functionName: 'media-assets',
        request,
        token,
        userId,
      });

      if (!securityResult.ok) {
        return jsonResponse(request, allowedOrigins, securityResult.status, {
          error: securityResult.error,
        });
      }

      let payload: unknown = null;

      if (securityResult.bodyText) {
        try {
          payload = JSON.parse(securityResult.bodyText);
        } catch {
          return jsonResponse(request, allowedOrigins, 400, { error: 'Malformed JSON body' });
        }
      }

      if (!payload || typeof payload !== 'object') {
        return jsonResponse(request, allowedOrigins, 400, { error: 'Malformed JSON body' });
      }

      const bucket = assertBucket((payload as { bucket?: unknown }).bucket);
      const action = (payload as { action?: unknown }).action;

      if (action === 'upload') {
        const contentType = (payload as { contentType?: unknown }).contentType;

        if (typeof contentType !== 'string' || !allowedContentTypes.has(contentType)) {
          return jsonResponse(request, allowedOrigins, 415, { error: 'Unsupported media type' });
        }

        const bytes = decodeBase64Payload((payload as { fileBase64?: unknown }).fileBase64);
        assertMediaSignature(contentType, bytes);
        const prefix = sanitizePrefix((payload as { prefix?: unknown }).prefix);
        const extension = sanitizeExtension((payload as { extension?: unknown }).extension, contentType);
        const fileName = `${userId}/${prefix}-${createRequestId()}.${extension}`;
        const { error: uploadError } = await adminClient.storage
          .from(bucket)
          .upload(fileName, bytes, {
            contentType,
            upsert: false,
          });

        if (uploadError) {
          return jsonResponse(request, allowedOrigins, 500, { error: uploadError.message });
        }

        const { data: publicUrlData } = adminClient.storage.from(bucket).getPublicUrl(fileName);
        return jsonResponse(request, allowedOrigins, 200, { publicUrl: publicUrlData.publicUrl });
      }

      if (action === 'delete') {
        const rawPaths = (payload as { paths?: unknown }).paths;

        if (!Array.isArray(rawPaths)) {
          return jsonResponse(request, allowedOrigins, 400, { error: 'Invalid storage paths' });
        }

        const paths = Array.from(new Set(rawPaths.map((path) => getOwnedPath(userId, path))));

        if (paths.length > maxDeletePathsPerRequest) {
          return jsonResponse(request, allowedOrigins, 400, { error: 'Too many storage paths' });
        }

        if (paths.length === 0) {
          return jsonResponse(request, allowedOrigins, 200, { success: true });
        }

        const { error: removeError } = await adminClient.storage.from(bucket).remove(paths);

        if (removeError) {
          return jsonResponse(request, allowedOrigins, 500, { error: removeError.message });
        }

        return jsonResponse(request, allowedOrigins, 200, { success: true });
      }

      return jsonResponse(request, allowedOrigins, 400, { error: 'Invalid media action' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown media-assets error';
      return jsonResponse(request, allowedOrigins, 400, { error: message });
    }
  };
}
