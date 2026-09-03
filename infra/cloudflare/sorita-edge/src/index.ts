import { findRoute, type RouteDefinition, validatePayload } from './contracts';
import {
  getOriginSuccessResponseContract,
  ORIGIN_ERROR_RESPONSE_MAX_BYTES,
  originErrorResponseSchema,
} from './responseContracts';
import {
  createOriginSignature,
  hashIpAddress,
  InvalidJwtError,
  JwtVerifierUnavailableError,
  readBearerToken,
  type FetchFunction,
  verifySupabaseJwt,
} from './security';

const NO_STORE_VALUE = 'private, no-store, max-age=0';
const ALLOWED_CORS_HEADERS = [
  'apikey',
  'authorization',
  'content-type',
  'idempotency-key',
  'x-device-id',
  'x-nonce',
  'x-request-id',
  'x-signature',
  'x-timestamp',
] as const;
const FORWARDED_CLIENT_HEADERS = [
  ['idempotency-key', /^[\x21-\x7e]{1,200}$/],
  ['x-device-id', /^[A-Za-z0-9_-]{8,128}$/],
  ['x-nonce', /^[A-Za-z0-9-]{16,128}$/],
  ['x-signature', /^[A-Fa-f0-9]{64}$/],
  ['x-timestamp', /^\d{10,16}$/],
] as const;

type EnvironmentName = 'development' | 'preview' | 'production';
type RuntimeConfig = {
  allowedBrowserOrigins: readonly string[];
  buildSha: string;
  environment: EnvironmentName;
  hmacSecret: string;
  ipHashPepper: string;
  jwksTimeoutMs: number;
  jwtAudience: string;
  logSampleRate: number;
  originTimeoutMs: number;
  publishableKey: string;
  supabaseOrigin: string;
};

type LogValue = boolean | number | string | undefined;
type StructuredLog = Readonly<Record<string, LogValue>>;
export type WorkerDependencies = {
  fetchFunction: FetchFunction;
  log: (level: 'error' | 'info', entry: StructuredLog) => void;
  now: () => number;
  randomUuid: () => string;
};

type RequestLogContext = {
  action: string;
  actorType: 'anonymous' | 'none' | 'user';
  errorCode?: string;
};

class GatewayError extends Error {
  readonly allow?: string;
  readonly code: string;
  readonly publicMessage: string;
  readonly retryAfter?: string;
  readonly status: number;

  constructor(
    status: number,
    code: string,
    publicMessage: string,
    options: { allow?: string; retryAfter?: string } = {},
  ) {
    super(code);
    this.name = 'GatewayError';
    this.allow = options.allow;
    this.code = code;
    this.publicMessage = publicMessage;
    this.retryAfter = options.retryAfter;
    this.status = status;
  }
}

const defaultDependencies: WorkerDependencies = {
  fetchFunction: (...args) => fetch(...args),
  log(level, entry) {
    const serializedEntry = JSON.stringify(entry);

    if (level === 'error') {
      console.error(serializedEntry);
    } else {
      console.log(serializedEntry);
    }
  },
  now: () => Date.now(),
  randomUuid: () => crypto.randomUUID(),
};

function parseIntegerInRange(value: string, minimum: number, maximum: number): number | undefined {
  if (!/^\d+$/.test(value)) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : undefined;
}

function parseNumberInRange(value: string, minimum: number, maximum: number): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

function normalizeBrowserOrigin(value: string, environment: EnvironmentName): string | undefined {
  try {
    const url = new URL(value);
    const isSecure = url.protocol === 'https:';
    const isDevelopmentLocalhost =
      environment === 'development' &&
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1');

    if (
      (!isSecure && !isDevelopmentLocalhost) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      value !== url.origin
    ) {
      return undefined;
    }

    return url.origin;
  } catch {
    return undefined;
  }
}

function parseRuntimeConfig(env: Env): RuntimeConfig {
  const environment = env.ENVIRONMENT;
  const buildSha = env.BUILD_SHA.trim();

  if (environment !== 'development' && environment !== 'preview' && environment !== 'production') {
    throw new GatewayError(503, 'configuration_unavailable', 'Gateway configuration is unavailable.');
  }

  let supabaseUrl: URL;

  try {
    supabaseUrl = new URL(env.SUPABASE_URL);
  } catch {
    throw new GatewayError(503, 'configuration_unavailable', 'Gateway configuration is unavailable.');
  }

  if (
    supabaseUrl.protocol !== 'https:' ||
    supabaseUrl.username ||
    supabaseUrl.password ||
    (supabaseUrl.pathname !== '/' && supabaseUrl.pathname !== '') ||
    supabaseUrl.search ||
    supabaseUrl.hash
  ) {
    throw new GatewayError(503, 'configuration_unavailable', 'Gateway configuration is unavailable.');
  }

  const originTimeoutMs = parseIntegerInRange(env.ORIGIN_TIMEOUT_MS, 1_000, 30_000);
  const jwksTimeoutMs = parseIntegerInRange(env.JWKS_TIMEOUT_MS, 500, 10_000);
  const logSampleRate = parseNumberInRange(env.LOG_SAMPLE_RATE, 0, 1);
  const jwtAudience = env.SUPABASE_JWT_AUDIENCE.trim();
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY.trim();
  const hmacSecret = env.ORIGIN_HMAC_SECRET;
  const ipHashPepper = env.IP_HASH_PEPPER;

  if (
    !/^[0-9a-f]{40}$/.test(buildSha) ||
    originTimeoutMs === undefined ||
    jwksTimeoutMs === undefined ||
    logSampleRate === undefined ||
    !/^[A-Za-z0-9:_-]{1,128}$/.test(jwtAudience) ||
    publishableKey.length < 20 ||
    hmacSecret.length < 32 ||
    ipHashPepper.length < 32 ||
    hmacSecret === ipHashPepper
  ) {
    throw new GatewayError(503, 'configuration_unavailable', 'Gateway configuration is unavailable.');
  }

  const rawOrigins = env.CORS_ALLOWLIST.trim()
    ? env.CORS_ALLOWLIST.split(',').map((value) => value.trim())
    : [];

  if (rawOrigins.length > 20 || rawOrigins.some((value) => !value)) {
    throw new GatewayError(503, 'configuration_unavailable', 'Gateway configuration is unavailable.');
  }

  const normalizedOrigins = rawOrigins.map((value) => normalizeBrowserOrigin(value, environment));

  if (normalizedOrigins.some((value) => value === undefined)) {
    throw new GatewayError(503, 'configuration_unavailable', 'Gateway configuration is unavailable.');
  }

  return {
    allowedBrowserOrigins: normalizedOrigins.filter((value): value is string => Boolean(value)),
    buildSha,
    environment,
    hmacSecret,
    ipHashPepper,
    jwksTimeoutMs,
    jwtAudience,
    logSampleRate,
    originTimeoutMs,
    publishableKey,
    supabaseOrigin: supabaseUrl.origin,
  };
}

function validateRequestOrigin(request: Request, config: RuntimeConfig): string | undefined {
  const requestOrigin = request.headers.get('origin');

  if (!requestOrigin) {
    return undefined;
  }

  if (!config.allowedBrowserOrigins.includes(requestOrigin)) {
    throw new GatewayError(403, 'origin_not_allowed', 'Origin is not allowed.');
  }

  return requestOrigin;
}

function createSecureHeaders(params: {
  allowedOrigin?: string;
  cfRay?: string;
  contentType?: string;
  requestId: string;
}): Headers {
  const headers = new Headers({
    'Cache-Control': NO_STORE_VALUE,
    Expires: '0',
    Pragma: 'no-cache',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-Request-Id': params.requestId,
  });

  if (params.contentType) {
    headers.set('Content-Type', params.contentType);
  }

  if (params.cfRay) {
    headers.set('X-Cf-Ray', params.cfRay);
  }

  if (params.allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', params.allowedOrigin);
    headers.set('Vary', 'Origin');
  }

  return headers;
}

function jsonResponse(
  payload: unknown,
  status: number,
  params: {
    allowedOrigin?: string;
    cfRay?: string;
    requestId: string;
    retryAfter?: string;
  },
): Response {
  const headers = createSecureHeaders({
    allowedOrigin: params.allowedOrigin,
    cfRay: params.cfRay,
    contentType: 'application/json; charset=utf-8',
    requestId: params.requestId,
  });

  if (params.retryAfter) {
    headers.set('Retry-After', params.retryAfter);
  }

  return Response.json(payload, { headers, status });
}

function errorResponse(
  error: GatewayError,
  params: {
    allowedOrigin?: string;
    cfRay?: string;
    requestId: string;
  },
): Response {
  const response = jsonResponse(
    {
      code: error.code,
      error: error.publicMessage,
      requestId: params.requestId,
    },
    error.status,
    { ...params, retryAfter: error.retryAfter },
  );

  if (error.allow) {
    response.headers.set('Allow', error.allow);
  }

  return response;
}

function isKnownPath(pathname: string): boolean {
  return pathname === '/health' || Boolean(findRoute(pathname));
}

function handleCorsPreflight(params: {
  allowedOrigin?: string;
  cfRay?: string;
  pathname: string;
  request: Request;
  requestId: string;
}): Response {
  if (!params.allowedOrigin || !isKnownPath(params.pathname)) {
    throw new GatewayError(404, 'not_found', 'Route not found.');
  }

  const expectedMethod = params.pathname === '/health' ? 'GET' : 'POST';
  const requestedMethod = params.request.headers.get('access-control-request-method');

  if (requestedMethod !== expectedMethod) {
    throw new GatewayError(405, 'method_not_allowed', 'Method not allowed.', {
      allow: `${expectedMethod}, OPTIONS`,
    });
  }

  const requestedHeaders =
    params.request.headers
      .get('access-control-request-headers')
      ?.split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean) ?? [];

  if (
    requestedHeaders.some(
      (value) => !ALLOWED_CORS_HEADERS.some((allowedHeader) => allowedHeader === value),
    )
  ) {
    throw new GatewayError(403, 'cors_headers_not_allowed', 'CORS headers are not allowed.');
  }

  const headers = createSecureHeaders({
    allowedOrigin: params.allowedOrigin,
    cfRay: params.cfRay,
    requestId: params.requestId,
  });
  headers.set('Access-Control-Allow-Headers', ALLOWED_CORS_HEADERS.join(', '));
  headers.set('Access-Control-Allow-Methods', expectedMethod);
  headers.set('Access-Control-Max-Age', '600');
  return new Response(null, { headers, status: 204 });
}

async function readBoundedJsonBody(
  request: Request,
  maximumBytes: number,
): Promise<{ bodyText: string; payload: unknown }> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';

  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/.test(contentType)) {
    throw new GatewayError(415, 'unsupported_media_type', 'Content-Type must be application/json.');
  }

  const contentEncoding = request.headers.get('content-encoding')?.trim().toLowerCase();

  if (contentEncoding && contentEncoding !== 'identity') {
    throw new GatewayError(415, 'unsupported_content_encoding', 'Content encoding is not supported.');
  }

  const contentLengthValue = request.headers.get('content-length');

  if (contentLengthValue) {
    const contentLength = Number(contentLengthValue);

    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      throw new GatewayError(400, 'invalid_content_length', 'Content-Length is invalid.');
    }

    if (contentLength > maximumBytes) {
      await request.body?.cancel();
      throw new GatewayError(413, 'body_too_large', 'Request body is too large.');
    }
  }

  const reader = request.body?.getReader();

  if (!reader) {
    throw new GatewayError(400, 'invalid_json', 'A JSON request body is required.');
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const result = await reader.read();

    if (result.done) {
      break;
    }

    if (!result.value) {
      continue;
    }

    totalBytes += result.value.byteLength;

    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new GatewayError(413, 'body_too_large', 'Request body is too large.');
    }

    chunks.push(result.value);
  }

  if (totalBytes === 0) {
    throw new GatewayError(400, 'invalid_json', 'A JSON request body is required.');
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let bodyText: string;

  try {
    bodyText = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    throw new GatewayError(400, 'invalid_json', 'Request body must be valid UTF-8 JSON.');
  }

  try {
    return { bodyText, payload: JSON.parse(bodyText) as unknown };
  } catch {
    throw new GatewayError(400, 'invalid_json', 'Request body must be valid JSON.');
  }
}

function readCfRay(request: Request): string | undefined {
  const value = request.headers.get('cf-ray')?.trim();
  return value && /^[A-Za-z0-9-]{1,64}$/.test(value) ? value : undefined;
}

function readClientIp(request: Request): string {
  const value = request.headers.get('cf-connecting-ip')?.trim();

  if (!value || value.length > 64 || !/^[0-9A-Fa-f:.]+$/.test(value)) {
    throw new GatewayError(503, 'client_identity_unavailable', 'Client identity is unavailable.');
  }

  return value;
}

function forwardValidatedClientHeaders(request: Request, headers: Headers): void {
  for (const [headerName, pattern] of FORWARDED_CLIENT_HEADERS) {
    const value = request.headers.get(headerName);

    if (!value) {
      continue;
    }

    if (!pattern.test(value)) {
      throw new GatewayError(400, 'invalid_request_headers', 'Request headers are invalid.');
    }

    headers.set(headerName, value);
  }
}

async function enforceRateLimit(params: {
  action: string;
  config: RuntimeConfig;
  env: Env;
  route: RouteDefinition;
  userId?: string;
  request: Request;
}): Promise<void> {
  const actorKey = params.userId
    ? `user:${params.userId}`
    : `ip:${await hashIpAddress(readClientIp(params.request), params.config.ipHashPepper)}`;
  const key = `${actorKey}:${params.route.path}:${params.action}`;
  const limiter = params.route.limiter === 'auth' ? params.env.AUTH_RATE_LIMITER : params.env.API_RATE_LIMITER;
  let outcome: RateLimitOutcome;

  try {
    outcome = await limiter.limit({ key });
  } catch {
    throw new GatewayError(503, 'rate_limit_unavailable', 'Rate limiting is unavailable.');
  }

  if (!outcome.success) {
    throw new GatewayError(429, 'rate_limited', 'Too many requests.', { retryAfter: '60' });
  }
}

async function enforceCoarseIpRateLimit(params: {
  config: RuntimeConfig;
  env: Env;
  request: Request;
}): Promise<void> {
  const ipHash = await hashIpAddress(readClientIp(params.request), params.config.ipHashPepper);
  let outcome: RateLimitOutcome;

  try {
    outcome = await params.env.API_RATE_LIMITER.limit({ key: `coarse-ip:${ipHash}` });
  } catch {
    throw new GatewayError(503, 'rate_limit_unavailable', 'Rate limiting is unavailable.');
  }

  if (!outcome.success) {
    throw new GatewayError(429, 'rate_limited', 'Too many requests.', {
      retryAfter: '60',
    });
  }
}

async function fetchOrigin(params: {
  action: string;
  allowedOrigin?: string;
  bodyText: string;
  cfRay?: string;
  config: RuntimeConfig;
  fetchFunction: FetchFunction;
  headers: Headers;
  originUrl: URL;
  requestId: string;
  route: RouteDefinition;
}): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort('origin_timeout');
  }, params.config.originTimeoutMs);

  try {
    const response = await params.fetchFunction(params.originUrl, {
      body: params.bodyText,
      headers: params.headers,
      method: 'POST',
      redirect: 'manual',
      signal: controller.signal,
    });
    return await translateOriginResponse(response, {
      action: params.action,
      allowedOrigin: params.allowedOrigin,
      cfRay: params.cfRay,
      requestId: params.requestId,
      route: params.route,
      supabaseOrigin: params.config.supabaseOrigin,
    });
  } catch (error) {
    if (timedOut || controller.signal.aborted) {
      throw new GatewayError(504, 'origin_timeout', 'Upstream request timed out.');
    }

    if (error instanceof GatewayError) {
      throw error;
    }

    throw new GatewayError(502, 'origin_unavailable', 'Upstream service is unavailable.');
  } finally {
    clearTimeout(timeout);
  }
}

function readRetryAfter(response: Response): string | undefined {
  const value = response.headers.get('retry-after')?.trim();

  if (!value || value.length > 128 || /[\u0000-\u001f\u007f]/.test(value)) {
    return undefined;
  }

  if (/^\d{1,6}$/.test(value)) {
    return value;
  }

  return Number.isFinite(Date.parse(value)) ? value : undefined;
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The response is already being rejected. Cancellation is best-effort and
    // must not replace the stable gateway error contract.
  }
}

async function readBoundedOriginJson(response: Response, maximumBytes: number): Promise<unknown> {
  const contentLengthValue = response.headers.get('content-length');

  if (contentLengthValue) {
    const contentLength = Number(contentLengthValue);

    if (
      !/^\d+$/.test(contentLengthValue)
      || !Number.isSafeInteger(contentLength)
      || contentLength > maximumBytes
    ) {
      await cancelResponseBody(response);
      throw new GatewayError(
        502,
        'invalid_origin_response',
        'Upstream service returned an invalid response.',
      );
    }
  }

  const reader = response.body?.getReader();

  if (!reader) {
    throw new GatewayError(
      502,
      'invalid_origin_response',
      'Upstream service returned an invalid response.',
    );
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const result = await reader.read();

    if (result.done) {
      break;
    }

    if (!result.value) {
      continue;
    }

    totalBytes += result.value.byteLength;

    if (totalBytes > maximumBytes) {
      try {
        await reader.cancel();
      } catch {
        // The bounded rejection below remains authoritative.
      }
      throw new GatewayError(
        502,
        'invalid_origin_response',
        'Upstream service returned an invalid response.',
      );
    }

    chunks.push(result.value);
  }

  if (totalBytes === 0) {
    throw new GatewayError(
      502,
      'invalid_origin_response',
      'Upstream service returned an invalid response.',
    );
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let bodyText: string;

  try {
    bodyText = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    throw new GatewayError(
      502,
      'invalid_origin_response',
      'Upstream service returned an invalid response.',
    );
  }

  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    throw new GatewayError(
      502,
      'invalid_origin_response',
      'Upstream service returned an invalid response.',
    );
  }
}

async function translateOriginResponse(
  response: Response,
  params: {
    action: string;
    allowedOrigin?: string;
    cfRay?: string;
    requestId: string;
    route: RouteDefinition;
    supabaseOrigin: string;
  },
): Promise<Response> {
  if (response.status === 429) {
    await cancelResponseBody(response);
    return jsonResponse(
      {
        code: 'rate_limited',
        error: 'Too many requests.',
        requestId: params.requestId,
      },
      429,
      { ...params, retryAfter: readRetryAfter(response) ?? '60' },
    );
  }

  if (response.status >= 500 || (response.status >= 300 && response.status < 400)) {
    await cancelResponseBody(response);
    throw new GatewayError(502, 'origin_unavailable', 'Upstream service is unavailable.');
  }

  if (response.status >= 200 && response.status < 300 && response.status !== 200) {
    await cancelResponseBody(response);
    throw new GatewayError(
      502,
      'invalid_origin_response',
      'Upstream service returned an invalid response.',
    );
  }

  const contentType = response.headers.get('content-type')?.trim().toLowerCase() ?? '';

  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/.test(contentType)) {
    await cancelResponseBody(response);
    throw new GatewayError(502, 'invalid_origin_response', 'Upstream service returned an invalid response.');
  }

  if (response.status === 200) {
    const contract = getOriginSuccessResponseContract({
      action: params.action,
      route: params.route,
      supabaseOrigin: params.supabaseOrigin,
    });

    if (!contract) {
      await cancelResponseBody(response);
      throw new GatewayError(
        502,
        'invalid_origin_response',
        'Upstream service returned an invalid response.',
      );
    }

    const payload = await readBoundedOriginJson(response, contract.maximumBytes);
    const parsed = contract.schema.safeParse(payload);

    if (!parsed.success) {
      throw new GatewayError(
        502,
        'invalid_origin_response',
        'Upstream service returned an invalid response.',
      );
    }

    return jsonResponse(parsed.data, 200, params);
  }

  if (response.status >= 400 && response.status < 500) {
    const retryAfter = readRetryAfter(response);
    const payload = await readBoundedOriginJson(response, ORIGIN_ERROR_RESPONSE_MAX_BYTES);
    const parsed = originErrorResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new GatewayError(
        502,
        'invalid_origin_response',
        'Upstream service returned an invalid response.',
      );
    }

    const translated = jsonResponse(parsed.data, response.status, params);

    if ((response.status === 409 || response.status === 423) && retryAfter) {
      translated.headers.set('Retry-After', retryAfter);
    }

    return translated;
  }

  await cancelResponseBody(response);
  throw new GatewayError(502, 'invalid_origin_response', 'Upstream service returned an invalid response.');
}

async function proxyRequest(params: {
  allowedOrigin?: string;
  cfRay?: string;
  config: RuntimeConfig;
  dependencies: WorkerDependencies;
  env: Env;
  logContext: RequestLogContext;
  request: Request;
  requestId: string;
  route: RouteDefinition;
}): Promise<Response> {
  const { bodyText, payload } = await readBoundedJsonBody(
    params.request,
    params.route.maxBodyBytes,
  );
  const contract = validatePayload(params.route, payload);

  if (!contract.success) {
    const isMediaBody = contract.code === 'media_body_proxy_forbidden';
    throw new GatewayError(
      isMediaBody ? 413 : 400,
      contract.code,
      isMediaBody
        ? 'Media bytes must be uploaded directly to storage.'
        : 'Request payload is invalid.',
    );
  }

  params.logContext.action = contract.action;
  let token: string | undefined;

  try {
    token = readBearerToken(params.request.headers.get('authorization'));
  } catch (error) {
    if (error instanceof InvalidJwtError) {
      throw new GatewayError(401, 'invalid_token', 'Authorization token is invalid.');
    }

    throw error;
  }

  if (contract.authRequired && !token) {
    throw new GatewayError(401, 'missing_authorization', 'Authorization is required.');
  }

  let userId: string | undefined;

  if (token) {
    try {
      const verified = await verifySupabaseJwt({
        audience: params.config.jwtAudience,
        fetchFunction: params.dependencies.fetchFunction,
        nowMs: params.dependencies.now(),
        supabaseOrigin: params.config.supabaseOrigin,
        timeoutMs: params.config.jwksTimeoutMs,
        token,
      });
      userId = verified.userId;
      params.logContext.actorType = 'user';
    } catch (error) {
      if (error instanceof JwtVerifierUnavailableError) {
        throw new GatewayError(503, 'auth_verifier_unavailable', 'Authorization service is unavailable.');
      }

      throw new GatewayError(401, 'invalid_token', 'Authorization token is invalid.');
    }
  } else {
    params.logContext.actorType = 'anonymous';
  }

  if (contract.expectedUserId && contract.expectedUserId !== userId) {
    throw new GatewayError(403, 'actor_mismatch', 'Authenticated actor does not match request payload.');
  }

  await enforceRateLimit({
    action: contract.action,
    config: params.config,
    env: params.env,
    request: params.request,
    route: params.route,
    userId,
  });

  const canonicalOriginPath = `/functions/v1/${params.route.functionName}`;
  const originUrl = new URL(canonicalOriginPath, params.config.supabaseOrigin);
  const timestamp = String(params.dependencies.now());
  const nonce = params.dependencies.randomUuid();
  const originSignature = await createOriginSignature({
    bodyText,
    canonicalPath: canonicalOriginPath,
    method: 'POST',
    nonce,
    secret: params.config.hmacSecret,
    timestamp,
  });
  const originHeaders = new Headers({
    Accept: 'application/json',
    apikey: params.config.publishableKey,
    'Content-Type': 'application/json; charset=utf-8',
    'X-Request-Id': params.requestId,
    'X-Sorita-Edge-Body-Sha256': originSignature.bodyHash,
    'X-Sorita-Edge-Nonce': nonce,
    'X-Sorita-Edge-Signature': originSignature.signature,
    'X-Sorita-Edge-Timestamp': timestamp,
  });

  if (token) {
    originHeaders.set('Authorization', `Bearer ${token}`);
  }

  if (params.allowedOrigin) {
    originHeaders.set('Origin', params.allowedOrigin);
  }

  if (params.cfRay) {
    originHeaders.set('X-Cf-Ray', params.cfRay);
  }

  const clientIp = params.request.headers.get('cf-connecting-ip')?.trim();

  if (clientIp) {
    originHeaders.set('X-Forwarded-For', clientIp);
  }

  forwardValidatedClientHeaders(params.request, originHeaders);
  return fetchOrigin({
    action: contract.action,
    allowedOrigin: params.allowedOrigin,
    bodyText,
    cfRay: params.cfRay,
    config: params.config,
    fetchFunction: params.dependencies.fetchFunction,
    headers: originHeaders,
    originUrl,
    requestId: params.requestId,
    route: params.route,
  });
}

function shouldSampleLog(sampleRate: number, requestId: string, status: number): boolean {
  if (status >= 400 || sampleRate >= 1) {
    return true;
  }

  if (sampleRate <= 0) {
    return false;
  }

  const prefix = requestId.replace(/-/g, '').slice(0, 8);
  const bucket = Number.parseInt(prefix, 16);
  return Number.isFinite(bucket) && bucket / 0xffff_ffff < sampleRate;
}

export async function handleWorkerRequest(
  request: Request,
  env: Env,
  dependencies: WorkerDependencies = defaultDependencies,
): Promise<Response> {
  const startedAt = dependencies.now();
  const requestId = dependencies.randomUuid();
  const url = new URL(request.url);
  const cfRay = readCfRay(request);
  const logContext: RequestLogContext = { action: 'none', actorType: 'none' };
  let allowedOrigin: string | undefined;
  let config: RuntimeConfig | undefined;
  let response: Response;

  try {
    config = parseRuntimeConfig(env);
    allowedOrigin = validateRequestOrigin(request, config);

    if (url.search) {
      throw new GatewayError(400, 'query_not_allowed', 'Query parameters are not allowed.');
    }

    if (request.method === 'OPTIONS') {
      response = handleCorsPreflight({
        allowedOrigin,
        cfRay,
        pathname: url.pathname,
        request,
        requestId,
      });
    } else if (url.pathname === '/health') {
      if (request.method !== 'GET') {
        throw new GatewayError(405, 'method_not_allowed', 'Method not allowed.', {
          allow: 'GET, OPTIONS',
        });
      }

      response = jsonResponse(
        { buildSha: config.buildSha, ok: true },
        200,
        { allowedOrigin, cfRay, requestId },
      );
    } else {
      const route = findRoute(url.pathname);

      if (!route) {
        throw new GatewayError(404, 'not_found', 'Route not found.');
      }

      if (request.method !== 'POST') {
        throw new GatewayError(405, 'method_not_allowed', 'Method not allowed.', {
          allow: 'POST, OPTIONS',
        });
      }

      await enforceCoarseIpRateLimit({ config, env, request });

      response = await proxyRequest({
        allowedOrigin,
        cfRay,
        config,
        dependencies,
        env,
        logContext,
        request,
        requestId,
        route,
      });
    }
  } catch (error) {
    const gatewayError =
      error instanceof GatewayError
        ? error
        : new GatewayError(500, 'internal_error', 'Internal gateway error.');
    logContext.errorCode = gatewayError.code;
    response = errorResponse(gatewayError, { allowedOrigin, cfRay, requestId });
  }

  const durationMs = Math.max(0, dependencies.now() - startedAt);
  const sampleRate = config?.logSampleRate ?? 1;

  if (shouldSampleLog(sampleRate, requestId, response.status)) {
    dependencies.log(response.status >= 500 ? 'error' : 'info', {
      action: logContext.action,
      actorType: logContext.actorType,
      cfRay,
      durationMs,
      environment: config?.environment ?? 'unknown',
      errorCode: logContext.errorCode,
      event: 'edge_request_complete',
      method:
        request.method === 'GET' || request.method === 'OPTIONS' || request.method === 'POST'
          ? request.method
          : 'OTHER',
      path: isKnownPath(url.pathname) ? url.pathname : 'unmatched',
      requestId,
      status: response.status,
    });
  }

  return response;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleWorkerRequest(request, env);
  },
} satisfies ExportedHandler<Env>;
