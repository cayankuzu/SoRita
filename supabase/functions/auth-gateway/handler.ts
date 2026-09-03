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
import { enforceRateLimit, rateLimitHeaders, type RateLimitAdminClientLike } from '../_shared/rateLimit.ts';
import {
  completeTrustedEdgeOriginVerification,
  verifyTrustedEdgeOriginHeaders,
} from '../_shared/originSecurity.ts';
import { readBoundedRequestBody } from '../_shared/requestSecurity.ts';

type RpcRowResult<T> = {
  data?: T[] | T | null;
  error?: ErrorLike | null;
};

type RpcClientLike = {
  rpc: <TRow = unknown>(
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<RpcRowResult<TRow>>;
};

type AuthErrorLike = ErrorLike & {
  status?: number;
};

type AuthSessionLike = {
  access_token?: string;
  refresh_token?: string;
};

type AuthUserLike = {
  email?: string | null;
  id?: string;
};

type AuthClientLike = RpcClientLike & {
  auth: {
    getUser: (token?: string) => Promise<{ data?: { user?: AuthUserLike | null } | null; error?: AuthErrorLike | null }>;
    resend: (params: {
      email: string;
      options?: { emailRedirectTo?: string };
      type: 'signup';
    }) => Promise<{ error?: AuthErrorLike | null }>;
    resetPasswordForEmail: (
      email: string,
      options?: { redirectTo?: string },
    ) => Promise<{ error?: AuthErrorLike | null }>;
    signInWithPassword: (params: {
      email: string;
      password: string;
    }) => Promise<{
      data?: { session?: AuthSessionLike | null; user?: AuthUserLike | null } | null;
      error?: AuthErrorLike | null;
    }>;
    signUp: (params: {
      email: string;
      options?: {
        data?: Record<string, unknown>;
        emailRedirectTo?: string;
      };
      password: string;
    }) => Promise<{
      data?: { user?: AuthUserLike | null } | null;
      error?: AuthErrorLike | null;
    }>;
  };
};

type AvailabilityRpcRow = {
  email_available: boolean;
  username_available: boolean;
};

type AuthLoginGuardRpcRow = {
  failure_count: number;
  locked_until: string | null;
  retry_after_seconds: number;
};

type AuthGatewayAdminClientLike = RateLimitAdminClientLike & RpcClientLike;

export type AuthGatewayHandlerConfig = {
  allowedOrigins: string[];
  allowedRedirectOrigins: string[];
  supabasePublishableKey: string;
  supabaseServiceRoleKey: string;
  supabaseUrl: string;
};

export type AuthGatewayHandlerDeps = {
  config: AuthGatewayHandlerConfig;
  createAdminClient: () => AuthGatewayAdminClientLike;
  createAnonymousAuthClient: () => AuthClientLike;
  createAuthenticatedAuthClient: (token: string) => AuthClientLike;
};

const DEVICE_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/, 'Kullanici adi 3-30 karakter olmali ve sadece harf, rakam veya alt cizgi icermeli.');
const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Isim en az 2 karakter olmali.')
  .max(60, 'Isim en fazla 60 karakter olabilir.');
const bioSchema = z.string().trim().max(150).optional().transform((value) => value || undefined);
const redirectUrlSchema = z.string().trim().url().max(400);
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Sifre en az ${PASSWORD_MIN_LENGTH} karakter olmali.`)
  .max(PASSWORD_MAX_LENGTH)
  .refine(
    (value) =>
      /[a-z]/.test(value) &&
      /[A-Z]/.test(value) &&
      /\d/.test(value) &&
      /[^a-zA-Z0-9]/.test(value),
    'Sifre buyuk harf, kucuk harf, rakam ve sembol icermeli.',
  );

const authGatewayPayloadSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('check-availability'),
    email: emailSchema.optional(),
    excludeUserId: z.string().uuid().optional(),
    username: usernameSchema.optional(),
  }).refine((value) => Boolean(value.email || value.username), {
    message: 'Email veya kullanici adi zorunludur.',
    path: ['email'],
  }),
  z.object({
    action: z.literal('login'),
    email: emailSchema,
    password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  }),
  z.object({
    action: z.literal('register'),
    bio: bioSchema,
    coverPhoto: z.string().trim().url().max(500).optional(),
    email: emailSchema,
    interests: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    legalConsent: z.object({
      acceptedAt: z.string().datetime(),
      documentsAccepted: z.array(z.string().trim().min(1).max(32)).min(1).max(10),
      version: z.string().trim().min(1).max(32),
    }),
    name: displayNameSchema,
    password: passwordSchema,
    profilePhoto: z.string().trim().url().max(500).optional(),
    redirectUrl: redirectUrlSchema,
    username: usernameSchema,
  }),
  z.object({
    action: z.literal('resend-confirmation'),
    email: emailSchema,
    redirectUrl: redirectUrlSchema,
  }),
  z.object({
    action: z.literal('request-password-reset'),
    email: emailSchema,
    redirectUrl: redirectUrlSchema,
  }),
  z.object({
    action: z.literal('prepare-password-reset'),
    email: emailSchema,
  }),
  z.object({
    action: z.literal('request-password-reset-authenticated'),
    currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    redirectUrl: redirectUrlSchema,
  }),
  z.object({
    action: z.literal('prepare-password-reset-authenticated'),
    currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  }),
]);

type AvailabilityPayload = Extract<
  z.infer<typeof authGatewayPayloadSchema>,
  { action: 'check-availability' }
>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

function isValidDeviceId(value: string | null) {
  return Boolean(value && DEVICE_ID_PATTERN.test(value));
}

function getClientIdentifier(
  request: Request,
  deviceId: string,
) {
  const forwardedAddress = (
    request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-real-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]
    ?? 'unknown-ip'
  ).trim();

  // This identifier is passed only to the server-side rate-limit hash RPC; it
  // is never added to the Edge log context.
  return `${deviceId}:${forwardedAddress.slice(0, 128)}`;
}

function inferAuthErrorCode(message: string | undefined) {
  const normalized = message?.toLowerCase() ?? '';

  if (normalized.includes('email not confirmed')) {
    return 'email_not_confirmed';
  }

  if (normalized.includes('invalid login credentials')) {
    return 'invalid_credentials';
  }

  if (
    normalized.includes('password is known to be weak') ||
    normalized.includes('weak and easy to guess') ||
    normalized.includes('weak password')
  ) {
    return 'weak_password';
  }

  if (
    normalized.includes('user already registered') ||
    normalized.includes('already registered') ||
    normalized.includes('already exists') ||
    normalized.includes('profiles_email_key') ||
    normalized.includes('users_email_key')
  ) {
    return 'duplicate_email';
  }

  if (
    normalized.includes('profiles_username_key') ||
    normalized.includes('username already') ||
    (normalized.includes('username') && normalized.includes('duplicate'))
  ) {
    return 'duplicate_username';
  }

  return 'unexpected';
}

function isIdentifierPresenceError(error: AuthErrorLike) {
  const normalized = error.message?.toLowerCase() ?? '';

  return (
    error.status === 404
    || normalized.includes('user not found')
    || normalized.includes('email not found')
    || normalized.includes('no user')
    || normalized.includes('already registered')
  );
}

function isAllowedRedirectUrl(url: string, allowedOrigins: string[]) {
  const normalizedUrl = url.replace(/\/+$/g, '');

  return allowedOrigins.some((origin) => {
    const normalizedOrigin = origin.replace(/\/+$/g, '');

    return (
      normalizedUrl === normalizedOrigin ||
      normalizedUrl.startsWith(`${normalizedOrigin}/`) ||
      normalizedUrl.startsWith(`${normalizedOrigin}?`)
    );
  });
}

async function readRpcRow<TRow>(
  client: RpcClientLike,
  functionName: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await client.rpc<TRow>(functionName, args);

  if (error) {
    throw new Error(error.message);
  }

  return (Array.isArray(data) ? data[0] : data) as TRow | null;
}

async function handleAccountAvailability(params: {
  adminClient: AuthGatewayAdminClientLike;
  allowedOrigins: string[];
  createAuthenticatedAuthClient: AuthGatewayHandlerDeps['createAuthenticatedAuthClient'];
  payload: AvailabilityPayload;
  request: Request;
  requestId: string;
}) {
  const token = getBearerToken(params.request.headers.get('Authorization'));

  if (params.payload.excludeUserId) {
    if (!token) {
      return jsonResponse(
        params.request,
        params.allowedOrigins,
        401,
        { code: 'missing_authorization', error: 'Eksik yetkilendirme basligi.' },
        { requestId: params.requestId },
      );
    }

    const authClient = params.createAuthenticatedAuthClient(token);
    const { data, error } = await authClient.auth.getUser(token);

    if (error || !data?.user?.id || data.user.id !== params.payload.excludeUserId) {
      return jsonResponse(
        params.request,
        params.allowedOrigins,
        403,
        { code: 'invalid_session', error: 'Oturum dogrulanamadi.' },
        { requestId: params.requestId },
      );
    }
  }

  const availabilityRow = await readRpcRow<AvailabilityRpcRow>(
    params.adminClient,
    'check_account_availability',
    {
      input_email: params.payload.email ?? null,
      input_exclude_user_id: params.payload.excludeUserId ?? null,
      input_username: params.payload.username ?? null,
    },
  );

  return jsonResponse(
    params.request,
    params.allowedOrigins,
    200,
    {
      // Email presence is deliberately never exposed. Username availability
      // remains part of the existing public registration/profile contract.
      emailAvailable: true,
      usernameAvailable: availabilityRow?.username_available ?? true,
    },
    { requestId: params.requestId },
  );
}

export function createAuthGatewayHandler({
  config,
  createAdminClient,
  createAnonymousAuthClient,
  createAuthenticatedAuthClient,
}: AuthGatewayHandlerDeps) {
  return async function handleAuthGatewayRequest(request: Request) {
    const requestContext = createEdgeRequestContext(request, 'auth-gateway');
    const { allowedOrigins, allowedRedirectOrigins, supabasePublishableKey, supabaseServiceRoleKey, supabaseUrl } =
      config;

    try {
      if (request.method === 'OPTIONS') {
        return corsPreflightResponse(request, allowedOrigins, requestContext.requestId);
      }

      if (request.method !== 'POST') {
        return jsonResponse(
          request,
          allowedOrigins,
          405,
          { code: 'method_not_allowed', error: 'Method not allowed' },
          { requestId: requestContext.requestId },
        );
      }

      if (!supabaseUrl || !supabasePublishableKey || !supabaseServiceRoleKey) {
        logEdgeEvent('error', 'Auth gateway is missing configuration', requestContext);
        return jsonResponse(
          request,
          allowedOrigins,
          500,
          { code: 'misconfigured', error: 'Kimlik dogrulama servisi su anda kullanilamiyor.' },
          { requestId: requestContext.requestId },
        );
      }

      const deviceId = request.headers.get('x-device-id');

      if (!isValidDeviceId(deviceId)) {
        return jsonResponse(
          request,
          allowedOrigins,
          400,
          { code: 'invalid_device', error: 'Gecersiz cihaz kimligi.' },
          { requestId: requestContext.requestId },
        );
      }

      const adminClient = createAdminClient();
      const originPreflight = await verifyTrustedEdgeOriginHeaders({
        functionName: 'auth-gateway',
        request,
      });
      if (!originPreflight.ok) {
        return jsonResponse(
          request,
          allowedOrigins,
          originPreflight.status,
          { code: 'invalid_origin', error: originPreflight.error },
          { requestId: requestContext.requestId },
        );
      }
      const bodyResult = await readBoundedRequestBody(request, 32 * 1024);
      if (!bodyResult.ok) {
        return jsonResponse(
          request,
          allowedOrigins,
          bodyResult.status,
          { code: 'invalid_request_body', error: bodyResult.error },
          { requestId: requestContext.requestId },
        );
      }
      const bodyText = bodyResult.bodyText;
      const originResult = await completeTrustedEdgeOriginVerification({
        adminClient,
        bodyText,
        functionName: 'auth-gateway',
        preflight: originPreflight,
      });

      if (!originResult.ok) {
        return jsonResponse(
          request,
          allowedOrigins,
          originResult.status,
          { code: 'invalid_origin_signature', error: originResult.error },
          { requestId: requestContext.requestId },
        );
      }

      const parsedPayload = authGatewayPayloadSchema.safeParse(parseJsonBody(bodyText));

      if (!parsedPayload.success) {
        return jsonResponse(
          request,
          allowedOrigins,
          400,
          { code: 'invalid_input', error: parsedPayload.error.issues[0]?.message ?? 'Gecersiz istek.' },
          { requestId: requestContext.requestId },
        );
      }

      const payload = parsedPayload.data;
      const clientIdentifier = getClientIdentifier(request, deviceId);

      const applyRateLimit = async (scope: string, maxRequests: number, windowMs: number) => {
        const result = await enforceRateLimit({
          adminClient,
          identifier: clientIdentifier,
          maxRequests,
          scope,
          windowMs,
        });

        if (!result.allowed) {
          logEdgeEvent('warn', 'Auth gateway rate limit exceeded', requestContext, {
            action: payload.action,
            scope,
          });
          return jsonResponse(
            request,
            allowedOrigins,
            429,
            {
              code: 'rate_limited',
              error: 'Cok fazla istek gonderildi. Lutfen biraz sonra tekrar deneyin.',
            },
            {
              extraHeaders: rateLimitHeaders(result, maxRequests),
              requestId: requestContext.requestId,
            },
          );
        }

        return result;
      };

      if (payload.action !== 'login') {
        const sharedLimitResult = await applyRateLimit(`auth:${payload.action}`, 10, 60_000);
        if (sharedLimitResult instanceof Response) {
          return sharedLimitResult;
        }
      }

      if (
        'redirectUrl' in payload &&
        payload.redirectUrl &&
        !isAllowedRedirectUrl(payload.redirectUrl, allowedRedirectOrigins)
      ) {
        return jsonResponse(
          request,
          allowedOrigins,
          400,
          { code: 'invalid_redirect', error: 'Gecersiz yonlendirme adresi.' },
          { requestId: requestContext.requestId },
        );
      }

      if (payload.action === 'check-availability') {
        const availabilityResponse = await handleAccountAvailability({
          adminClient,
          allowedOrigins,
          createAuthenticatedAuthClient,
          payload,
          request,
          requestId: requestContext.requestId,
        });
        return availabilityResponse;
      }

      if (payload.action === 'login') {
        const generalLoginLimitResult = await applyRateLimit('auth:login', 5, 15 * 60_000);
        if (generalLoginLimitResult instanceof Response) {
          return generalLoginLimitResult;
        }

        const emailLoginLimitResult = await enforceRateLimit({
          adminClient,
          identifier: payload.email,
          maxRequests: 5,
          scope: 'auth:login-email',
          windowMs: 15 * 60_000,
        });

        if (!emailLoginLimitResult.allowed) {
          return jsonResponse(
            request,
            allowedOrigins,
            429,
            {
              code: 'rate_limited',
              error: 'Cok fazla giris denemesi yapildi. Lutfen daha sonra tekrar deneyin.',
            },
            {
              extraHeaders: rateLimitHeaders(emailLoginLimitResult, 5),
              requestId: requestContext.requestId,
            },
          );
        }

        const guardStatus = await readRpcRow<AuthLoginGuardRpcRow>(adminClient, 'get_auth_login_guard_status', {
          input_email: payload.email,
        });

        if ((guardStatus?.retry_after_seconds ?? 0) > 0 && guardStatus?.locked_until) {
          return jsonResponse(
            request,
            allowedOrigins,
            423,
            {
              code: 'account_locked',
              error: 'Cok sayida basarisiz giris denemesi nedeniyle hesap gecici olarak kilitlendi.',
            },
            {
              extraHeaders: {
                'Retry-After': String(guardStatus.retry_after_seconds),
              },
              requestId: requestContext.requestId,
            },
          );
        }

        const authClient = createAnonymousAuthClient();
        const { data, error } = await authClient.auth.signInWithPassword({
          email: payload.email,
          password: payload.password,
        });

        if (error) {
          const authCode = inferAuthErrorCode(error.message);

          if (authCode === 'invalid_credentials' || authCode === 'email_not_confirmed') {
            const failureResult = await readRpcRow<AuthLoginGuardRpcRow>(adminClient, 'record_auth_login_failure', {
              input_email: payload.email,
            });

            if ((failureResult?.retry_after_seconds ?? 0) > 0 && failureResult?.locked_until) {
              return jsonResponse(
                request,
                allowedOrigins,
                423,
                {
                  code: 'account_locked',
                  error: 'Cok sayida basarisiz giris denemesi nedeniyle hesap gecici olarak kilitlendi.',
                },
                {
                  extraHeaders: {
                    'Retry-After': String(failureResult.retry_after_seconds),
                  },
                  requestId: requestContext.requestId,
                },
              );
            }

            return jsonResponse(
              request,
              allowedOrigins,
              401,
              {
                code: 'invalid_credentials',
                error: 'Gecersiz e-posta veya sifre.',
              },
              { requestId: requestContext.requestId },
            );
          }

          logEdgeEvent('warn', 'Supabase auth login failed', requestContext, {
            action: payload.action,
            authCode,
            message: error.message,
          });
          return jsonResponse(
            request,
            allowedOrigins,
            400,
            { code: authCode, error: 'Giris islemi tamamlanamadi.' },
            { requestId: requestContext.requestId },
          );
        }

        if (!data?.session?.access_token || !data.session.refresh_token || !data.user) {
          logEdgeEvent('error', 'Login succeeded without session payload', requestContext);
          return jsonResponse(
            request,
            allowedOrigins,
            500,
            { code: 'unexpected', error: 'Giris oturumu olusturulamadi.' },
            { requestId: requestContext.requestId },
          );
        }

        await adminClient.rpc('clear_auth_login_failures', {
          input_email: payload.email,
        });

        return jsonResponse(
          request,
          allowedOrigins,
          200,
          {
            session: {
              accessToken: data.session.access_token,
              refreshToken: data.session.refresh_token,
            },
          },
          { requestId: requestContext.requestId },
        );
      }

      if (payload.action === 'register') {
        const authClient = createAnonymousAuthClient();
        const availabilityRow = await readRpcRow<AvailabilityRpcRow>(adminClient, 'check_account_availability', {
          // Email uniqueness is intentionally delegated to Supabase Auth so its
          // duplicate-account obfuscation remains intact.
          input_email: null,
          input_exclude_user_id: null,
          input_username: payload.username,
        });

        if (availabilityRow && !availabilityRow.username_available) {
          return jsonResponse(
            request,
            allowedOrigins,
            409,
            { code: 'duplicate_username', error: 'Bu kullanici adi zaten kullaniliyor.' },
            { requestId: requestContext.requestId },
          );
        }

        const { error } = await authClient.auth.signUp({
          email: payload.email,
          password: payload.password,
          options: {
            emailRedirectTo: payload.redirectUrl,
            data: {
              bio: payload.bio ?? null,
              community_safety_acknowledged: true,
              cover_photo_url: payload.coverPhoto ?? null,
              interests: payload.interests?.length ? payload.interests : null,
              legal_consent_at: payload.legalConsent.acceptedAt,
              legal_consent_documents: payload.legalConsent.documentsAccepted,
              legal_consent_version: payload.legalConsent.version,
              name: payload.name,
              profile_photo_url: payload.profilePhoto ?? null,
              username: payload.username,
            },
          },
        });

        if (error) {
          const authCode = inferAuthErrorCode(error.message);

          if (authCode === 'duplicate_email') {
            return jsonResponse(
              request,
              allowedOrigins,
              200,
              { success: true },
              { requestId: requestContext.requestId },
            );
          }

          const status = authCode === 'duplicate_username' ? 409 : 400;

          return jsonResponse(
            request,
            allowedOrigins,
            status,
            {
              code: authCode,
              error:
                authCode === 'duplicate_username'
                    ? 'Bu kullanici adi zaten kullaniliyor.'
                    : authCode === 'weak_password'
                      ? 'Sifre guvenlik gereksinimlerini karsilamiyor.'
                      : 'Kayit islemi tamamlanamadi.',
            },
            { requestId: requestContext.requestId },
          );
        }

        return jsonResponse(
          request,
          allowedOrigins,
          200,
          { success: true },
          { requestId: requestContext.requestId },
        );
      }

      if (payload.action === 'resend-confirmation') {
        const authClient = createAnonymousAuthClient();
        const { error } = await authClient.auth.resend({
          type: 'signup',
          email: payload.email,
          options: {
            emailRedirectTo: payload.redirectUrl,
          },
        });

        if (error) {
          if (isIdentifierPresenceError(error)) {
            return jsonResponse(
              request,
              allowedOrigins,
              200,
              { success: true },
              { requestId: requestContext.requestId },
            );
          }

          return jsonResponse(
            request,
            allowedOrigins,
            400,
            { code: inferAuthErrorCode(error.message), error: 'Onay e-postasi tekrar gonderilemedi.' },
            { requestId: requestContext.requestId },
          );
        }

        return jsonResponse(
          request,
          allowedOrigins,
          200,
          { success: true },
          { requestId: requestContext.requestId },
        );
      }

      if (
        payload.action === 'request-password-reset' ||
        payload.action === 'prepare-password-reset'
      ) {
        const authClient = createAnonymousAuthClient();

        if (payload.action === 'request-password-reset') {
          const { error } = await authClient.auth.resetPasswordForEmail(payload.email, {
            redirectTo: payload.redirectUrl,
          });

          if (error) {
            if (isIdentifierPresenceError(error)) {
              return jsonResponse(
                request,
                allowedOrigins,
                200,
                { success: true },
                { requestId: requestContext.requestId },
              );
            }

            return jsonResponse(
              request,
              allowedOrigins,
              400,
              { code: inferAuthErrorCode(error.message), error: 'Sifre sifirlama e-postasi gonderilemedi.' },
              { requestId: requestContext.requestId },
            );
          }
        }

        return jsonResponse(
          request,
          allowedOrigins,
          200,
          { success: true },
          { requestId: requestContext.requestId },
        );
      }

      const token = getBearerToken(request.headers.get('Authorization'));

      if (!token) {
        return jsonResponse(
          request,
          allowedOrigins,
          401,
          { code: 'missing_authorization', error: 'Eksik yetkilendirme basligi.' },
          { requestId: requestContext.requestId },
        );
      }

      const authenticatedClient = createAuthenticatedAuthClient(token);
      const {
        data: authenticatedUserData,
        error: authenticatedUserError,
      } = await authenticatedClient.auth.getUser(token);
      const authenticatedUser = authenticatedUserData?.user ?? null;

      if (authenticatedUserError || !authenticatedUser?.email) {
        return jsonResponse(
          request,
          allowedOrigins,
          401,
          { code: 'invalid_session', error: 'Oturum dogrulanamadi.' },
          { requestId: requestContext.requestId },
        );
      }

      const passwordResetLimitResult = await applyRateLimit('auth:request-password-reset-authenticated', 5, 15 * 60_000);
      if (passwordResetLimitResult instanceof Response) {
        return passwordResetLimitResult;
      }

      const anonymousAuthClient = createAnonymousAuthClient();
      const verificationResult = await anonymousAuthClient.auth.signInWithPassword({
        email: authenticatedUser.email,
        password: payload.currentPassword,
      });

      if (verificationResult.error) {
        return jsonResponse(
          request,
          allowedOrigins,
          401,
          { code: 'invalid_credentials', error: 'Mevcut sifre dogrulanamadi.' },
          { requestId: requestContext.requestId },
        );
      }

      if (payload.action === 'request-password-reset-authenticated') {
        const resetPasswordResult = await anonymousAuthClient.auth.resetPasswordForEmail(authenticatedUser.email, {
          redirectTo: payload.redirectUrl,
        });

        if (resetPasswordResult.error) {
          return jsonResponse(
            request,
            allowedOrigins,
            400,
            { code: inferAuthErrorCode(resetPasswordResult.error.message), error: 'Sifre sifirlama e-postasi gonderilemedi.' },
            { requestId: requestContext.requestId },
          );
        }
      }

      return jsonResponse(
        request,
        allowedOrigins,
        200,
        { success: true },
        { requestId: requestContext.requestId },
      );
    } catch (error) {
      if (isHttpRequestError(error)) {
        return jsonResponse(
          request,
          allowedOrigins,
          error.status,
          { code: error.code, error: error.message },
          { requestId: requestContext.requestId },
        );
      }

      logEdgeEvent('error', 'Unhandled auth gateway error', requestContext, {
        error: getErrorMessage(error),
      });
      return jsonResponse(
        request,
        allowedOrigins,
        500,
        { code: 'unexpected', error: 'Kimlik dogrulama islemi tamamlanamadi.' },
        { requestId: requestContext.requestId },
      );
    }
  };
}
