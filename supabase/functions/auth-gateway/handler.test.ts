import { describe, expect, it, vi } from 'vitest';

import { createAuthGatewayHandler } from './handler';

function createDeps(options?: {
  availabilityRow?: {
    email_available: boolean;
    username_available: boolean;
  };
  loginGuardStatus?: {
    failure_count: number;
    locked_until: string | null;
    retry_after_seconds: number;
  };
  rateLimitedScope?: string;
  recordFailureStatus?: {
    failure_count: number;
    locked_until: string | null;
    retry_after_seconds: number;
  };
  rpcErrorFor?: string;
  configOverrides?: Partial<{
    allowedOrigins: string[];
    allowedRedirectOrigins: string[];
    supabasePublishableKey: string;
    supabaseServiceRoleKey: string;
    supabaseUrl: string;
  }>;
  signInResult?: {
    data?: {
      session?: {
        access_token?: string;
        refresh_token?: string;
      } | null;
      user?: {
        email?: string | null;
        id?: string;
      } | null;
    } | null;
    error?: {
      message: string;
      status?: number;
    } | null;
  };
  signUpError?: { message: string; status?: number } | null;
  resendError?: { message: string; status?: number } | null;
  resetPasswordErrors?: Array<{ message: string; status?: number } | null>;
  getUserResult?: {
    data?: { user?: { email?: string | null; id?: string } | null } | null;
    error?: { message: string; status?: number } | null;
  };
}) {
  const rpcMock = vi.fn().mockImplementation(async (functionName: string, args: Record<string, unknown>) => {
    if (functionName === options?.rpcErrorFor) {
      return { data: null, error: { message: 'rpc unavailable' } };
    }

    if (functionName === 'enforce_edge_rate_limit') {
      if (args.input_scope === options?.rateLimitedScope) {
        return {
          data: {
            allowed: false,
            remaining: 0,
            retry_after_seconds: 30,
          },
          error: null,
        };
      }

      return {
        data: {
          allowed: true,
          remaining: 4,
          retry_after_seconds: 0,
        },
        error: null,
      };
    }

    if (functionName === 'check_account_availability') {
      return {
        data: options?.availabilityRow ?? {
          email_available: true,
          username_available: true,
        },
        error: null,
      };
    }

    if (functionName === 'get_auth_login_guard_status') {
      return {
        data: options?.loginGuardStatus ?? {
          failure_count: 0,
          locked_until: null,
          retry_after_seconds: 0,
        },
        error: null,
      };
    }

    if (functionName === 'record_auth_login_failure') {
      return {
        data: options?.recordFailureStatus ?? {
          failure_count: 1,
          locked_until: null,
          retry_after_seconds: 0,
        },
        error: null,
      };
    }

    return {
      data: null,
      error: null,
    };
  });
  const adminRpcMock = vi.fn((functionName: string, args: Record<string, unknown>) =>
    rpcMock(functionName, args));
  const anonymousRpcMock = vi.fn((functionName: string, args: Record<string, unknown>) =>
    rpcMock(functionName, args));
  const signInWithPasswordMock = vi.fn().mockResolvedValue(options?.signInResult ?? {
    data: {
      session: {
        access_token: 'access-1',
        refresh_token: 'refresh-1',
      },
      user: {
        email: 'user@example.com',
        id: 'user-1',
      },
    },
    error: null,
  });
  const signUpMock = vi.fn().mockResolvedValue({
    data: options?.signUpError ? null : { user: { id: 'user-1' } },
    error: options?.signUpError ?? null,
  });
  const resendMock = vi.fn().mockResolvedValue({ error: options?.resendError ?? null });
  const resetPasswordForEmailMock = vi.fn();
  for (const error of options?.resetPasswordErrors ?? [null]) {
    resetPasswordForEmailMock.mockResolvedValueOnce({ error });
  }
  const getUserMock = vi.fn().mockResolvedValue(options?.getUserResult ?? {
    data: {
      user: {
        email: 'user@example.com',
        id: 'user-1',
      },
    },
    error: null,
  });

  const handler = createAuthGatewayHandler({
    config: {
      allowedOrigins: ['http://localhost:5173'],
      allowedRedirectOrigins: ['sorita://auth/callback', 'sorita://reset-password'],
      supabasePublishableKey: 'anon-key',
      supabaseServiceRoleKey: 'service-role',
      supabaseUrl: 'https://example.supabase.co',
      ...options?.configOverrides,
    },
    createAdminClient: () => ({
      rpc: adminRpcMock,
    }),
    createAnonymousAuthClient: () => ({
      rpc: anonymousRpcMock,
      auth: {
        getUser: getUserMock,
        resend: resendMock,
        resetPasswordForEmail: resetPasswordForEmailMock,
        signInWithPassword: signInWithPasswordMock,
        signUp: signUpMock,
      },
    }),
    createAuthenticatedAuthClient: () => ({
      rpc: rpcMock,
      auth: {
        getUser: getUserMock,
        resend: resendMock,
        resetPasswordForEmail: resetPasswordForEmailMock,
        signInWithPassword: signInWithPasswordMock,
        signUp: signUpMock,
      },
    }),
  });

  return {
    adminRpcMock,
    anonymousRpcMock,
    getUserMock,
    handler,
    resendMock,
    rpcMock,
    resetPasswordForEmailMock,
    signInWithPasswordMock,
    signUpMock,
  };
}

function authRequest(
  body: unknown,
  options: { authorization?: string; deviceId?: string; method?: string; origin?: string } = {},
) {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-device-id': options.deviceId ?? 'device-test-1234',
  });
  if (options.authorization) headers.set('Authorization', options.authorization);
  if (options.origin) headers.set('Origin', options.origin);

  return new Request('https://example.supabase.co/functions/v1/auth-gateway', {
    body: options.method === 'GET' || options.method === 'OPTIONS' ? undefined : JSON.stringify(body),
    headers,
    method: options.method ?? 'POST',
  });
}

const validRegistration = {
  action: 'register',
  bio: '',
  email: 'new@example.com',
  interests: ['kahve'],
  legalConsent: {
    acceptedAt: '2026-07-18T12:00:00.000Z',
    documentsAccepted: ['terms', 'privacy'],
    version: '2026-07',
  },
  name: 'Yeni Kullanici',
  password: 'Strong!Pass123',
  redirectUrl: 'sorita://auth/callback',
  username: 'yeni_kullanici',
} as const;

describe('auth-gateway handler', () => {
  it('rejects invalid device ids and malformed JSON bodies', async () => {
    const { handler } = createDeps();

    const invalidDeviceResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/auth-gateway', {
        method: 'POST',
        headers: {
          'x-device-id': 'bad',
        },
        body: '{}',
      }),
    );

    expect(invalidDeviceResponse.status).toBe(400);
    await expect(invalidDeviceResponse.json()).resolves.toMatchObject({
      code: 'invalid_device',
    });

    const malformedJsonResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/auth-gateway', {
        method: 'POST',
        headers: {
          'x-device-id': 'device-1234-1',
        },
        body: '{bad json',
      }),
    );

    expect(malformedJsonResponse.status).toBe(400);
    await expect(malformedJsonResponse.json()).resolves.toMatchObject({
      code: 'invalid_json',
      error: 'Malformed JSON body',
    });
  });

  it('checks account availability and logs users in through the gateway', async () => {
    const { handler, rpcMock, signInWithPasswordMock } = createDeps({
      availabilityRow: {
        email_available: false,
        username_available: true,
      },
    });

    const availabilityResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/auth-gateway', {
        method: 'POST',
        headers: {
          'x-device-id': 'device-1234-2',
        },
        body: JSON.stringify({
          action: 'check-availability',
          email: 'taken@example.com',
        }),
      }),
    );

    expect(availabilityResponse.status).toBe(200);
    await expect(availabilityResponse.json()).resolves.toEqual({
      emailAvailable: false,
      usernameAvailable: true,
    });

    const loginResponse = await handler(
      new Request('https://example.supabase.co/functions/v1/auth-gateway', {
        method: 'POST',
        headers: {
          'x-device-id': 'device-1234-3',
        },
        body: JSON.stringify({
          action: 'login',
          email: 'user@example.com',
          password: 'P@ssword123',
        }),
      }),
    );

    expect(loginResponse.status).toBe(200);
    await expect(loginResponse.json()).resolves.toEqual({
      session: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
      },
    });
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'P@ssword123',
    });
    expect(rpcMock).toHaveBeenCalledWith('clear_auth_login_failures', {
      input_email: 'user@example.com',
    });
  });

  it('blocks locked accounts before attempting login', async () => {
    const { handler, signInWithPasswordMock } = createDeps({
      loginGuardStatus: {
        failure_count: 5,
        locked_until: '2026-06-24T12:45:00.000Z',
        retry_after_seconds: 60,
      },
    });

    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/auth-gateway', {
        method: 'POST',
        headers: {
          'x-device-id': 'device-1234-4',
        },
        body: JSON.stringify({
          action: 'login',
          email: 'user@example.com',
          password: 'P@ssword123',
        }),
      }),
    );

    expect(response.status).toBe(423);
    expect(response.headers.get('Retry-After')).toBe('60');
    await expect(response.json()).resolves.toMatchObject({
      code: 'account_locked',
    });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it('sends password reset mail only for registered email addresses', async () => {
    const { adminRpcMock, anonymousRpcMock, handler, resetPasswordForEmailMock } = createDeps({
      availabilityRow: {
        email_available: false,
        username_available: true,
      },
    });

    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/auth-gateway', {
        method: 'POST',
        headers: {
          'x-device-id': 'device-1234-5',
        },
        body: JSON.stringify({
          action: 'request-password-reset',
          email: 'user@example.com',
          redirectUrl: 'sorita://reset-password',
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
    });
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'sorita://reset-password',
    });
    expect(anonymousRpcMock).toHaveBeenCalledWith('check_account_availability', {
      input_email: 'user@example.com',
      input_exclude_user_id: null,
      input_username: null,
    });
    expect(adminRpcMock).not.toHaveBeenCalledWith(
      'check_account_availability',
      expect.anything(),
    );
  });

  it('rejects password reset requests for unknown email addresses', async () => {
    const { handler, resetPasswordForEmailMock } = createDeps({
      availabilityRow: {
        email_available: true,
        username_available: true,
      },
    });

    const response = await handler(
      new Request('https://example.supabase.co/functions/v1/auth-gateway', {
        method: 'POST',
        headers: {
          'x-device-id': 'device-1234-6',
        },
        body: JSON.stringify({
          action: 'request-password-reset',
          email: 'missing@example.com',
          redirectUrl: 'sorita://reset-password',
        }),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      code: 'email_not_found',
      error: 'Bu e-posta adresiyle kayitli bir hesap bulunamadi.',
    });
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it('preflights password reset without sending mail from the edge runtime', async () => {
    const { anonymousRpcMock, handler, resetPasswordForEmailMock } = createDeps({
      availabilityRow: {
        email_available: false,
        username_available: true,
      },
    });

    const response = await handler(authRequest({
      action: 'prepare-password-reset',
      email: 'user@example.com',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(anonymousRpcMock).toHaveBeenCalledWith('check_account_availability', {
      input_email: 'user@example.com',
      input_exclude_user_id: null,
      input_username: null,
    });
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it('handles CORS preflight, unsupported methods, and missing server configuration', async () => {
    const { handler } = createDeps();
    const preflight = await handler(authRequest({}, {
      method: 'OPTIONS',
      origin: 'http://localhost:5173',
    }));
    expect(preflight.status).toBe(200);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');

    const method = await handler(authRequest({}, { method: 'GET' }));
    expect(method.status).toBe(405);
    await expect(method.json()).resolves.toMatchObject({ code: 'method_not_allowed' });

    for (const configOverrides of [
      { supabaseUrl: '' },
      { supabasePublishableKey: '' },
      { supabaseServiceRoleKey: '' },
    ]) {
      const misconfigured = createDeps({ configOverrides }).handler;
      const response = await misconfigured(authRequest({ action: 'login', email: 'u@example.com', password: 'x' }));
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({ code: 'misconfigured' });
    }
  });

  it('rejects invalid payload variants without reaching auth or RPC dependencies', async () => {
    const { handler, rpcMock, signInWithPasswordMock } = createDeps();
    const invalidPayloads = [
      {},
      { action: 'unknown' },
      { action: 'check-availability' },
      { action: 'check-availability', email: 'not-an-email' },
      { action: 'check-availability', username: 'A!' },
      { action: 'login', email: 'bad', password: '' },
      { ...validRegistration, email: 'bad' },
      { ...validRegistration, username: 'ab' },
      { ...validRegistration, name: 'x' },
      { ...validRegistration, password: 'weak' },
      { ...validRegistration, interests: Array.from({ length: 21 }, (_, index) => `i${index}`) },
      { ...validRegistration, legalConsent: { ...validRegistration.legalConsent, documentsAccepted: [] } },
      { action: 'request-password-reset', email: 'bad', redirectUrl: 'bad' },
      { action: 'prepare-password-reset', email: 'bad' },
      { action: 'request-password-reset-authenticated', currentPassword: '', redirectUrl: 'bad' },
      { action: 'prepare-password-reset-authenticated', currentPassword: '' },
    ];

    for (const payload of invalidPayloads) {
      const response = await handler(authRequest(payload));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ code: 'invalid_input' });
    }
    expect(rpcMock).not.toHaveBeenCalled();
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it('enforces shared, general-login, and per-email rate limits with retry headers', async () => {
    const shared = createDeps({ rateLimitedScope: 'auth:register' });
    const sharedResponse = await shared.handler(authRequest(validRegistration));
    expect(sharedResponse.status).toBe(429);
    expect(sharedResponse.headers.get('Retry-After')).toBe('30');

    const general = createDeps({ rateLimitedScope: 'auth:login' });
    const generalResponse = await general.handler(authRequest({
      action: 'login', email: 'user@example.com', password: 'x',
    }));
    expect(generalResponse.status).toBe(429);

    const email = createDeps({ rateLimitedScope: 'auth:login-email' });
    const emailResponse = await email.handler(authRequest({
      action: 'login', email: 'user@example.com', password: 'x',
    }));
    expect(emailResponse.status).toBe(429);
    expect(email.signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it('rejects redirect URLs outside the explicit allowlist', async () => {
    const { handler } = createDeps();
    for (const payload of [
      { ...validRegistration, redirectUrl: 'https://attacker.example/callback' },
      {
        action: 'resend-confirmation',
        email: 'user@example.com',
        redirectUrl: 'https://attacker.example/callback',
      },
      {
        action: 'request-password-reset',
        email: 'user@example.com',
        redirectUrl: 'https://attacker.example/callback',
      },
    ]) {
      const response = await handler(authRequest(payload));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ code: 'invalid_redirect' });
    }
  });

  it('records invalid login attempts and locks an account when the failure threshold is reached', async () => {
    const invalid = createDeps({
      signInResult: { data: null, error: { message: 'Invalid login credentials' } },
    });
    const invalidResponse = await invalid.handler(authRequest({
      action: 'login', email: 'user@example.com', password: 'wrong',
    }));
    expect(invalidResponse.status).toBe(401);
    await expect(invalidResponse.json()).resolves.toMatchObject({ code: 'invalid_credentials' });

    const locked = createDeps({
      recordFailureStatus: {
        failure_count: 5,
        locked_until: '2026-07-18T12:01:00.000Z',
        retry_after_seconds: 60,
      },
      signInResult: { data: null, error: { message: 'invalid LOGIN credentials' } },
    });
    const lockedResponse = await locked.handler(authRequest({
      action: 'login', email: 'user@example.com', password: 'wrong',
    }));
    expect(lockedResponse.status).toBe(423);
    expect(lockedResponse.headers.get('Retry-After')).toBe('60');
  });

  it('maps login provider failures and rejects incomplete successful sessions', async () => {
    for (const [message, code, status] of [
      ['Email not confirmed', 'email_not_confirmed', 403],
      ['Weak password', 'weak_password', 400],
      ['Provider unavailable', 'unexpected', 400],
    ] as const) {
      const { handler } = createDeps({ signInResult: { data: null, error: { message } } });
      const response = await handler(authRequest({
        action: 'login', email: 'user@example.com', password: 'x',
      }));
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toMatchObject({ code });
    }

    for (const data of [
      null,
      { session: null, user: { id: 'user-1' } },
      { session: { access_token: 'access' }, user: { id: 'user-1' } },
      { session: { access_token: 'access', refresh_token: 'refresh' }, user: null },
    ]) {
      const { handler } = createDeps({ signInResult: { data, error: null } });
      const response = await handler(authRequest({
        action: 'login', email: 'user@example.com', password: 'x',
      }));
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({ code: 'unexpected' });
    }
  });

  it('registers complete profiles and prevents duplicate account attributes', async () => {
    const success = createDeps();
    const successResponse = await success.handler(authRequest(validRegistration));
    expect(successResponse.status).toBe(200);
    expect(success.signUpMock).toHaveBeenCalledWith(expect.objectContaining({
      email: 'new@example.com',
      options: expect.objectContaining({
        data: expect.objectContaining({
          bio: null,
          community_safety_acknowledged: true,
          username: 'yeni_kullanici',
        }),
      }),
    }));

    const duplicateEmail = createDeps({
      availabilityRow: { email_available: false, username_available: true },
    });
    expect((await duplicateEmail.handler(authRequest(validRegistration))).status).toBe(409);
    expect(duplicateEmail.signUpMock).not.toHaveBeenCalled();

    const duplicateUsername = createDeps({
      availabilityRow: { email_available: true, username_available: false },
    });
    expect((await duplicateUsername.handler(authRequest(validRegistration))).status).toBe(409);
    expect(duplicateUsername.signUpMock).not.toHaveBeenCalled();
  });

  it('maps registration provider errors without exposing provider messages', async () => {
    const cases = [
      ['User already registered', 'duplicate_email', 409],
      ['profiles_email_key', 'duplicate_email', 409],
      ['profiles_username_key', 'duplicate_username', 409],
      ['Password is known to be weak', 'weak_password', 400],
      ['Provider unavailable', 'unexpected', 400],
    ] as const;

    for (const [message, code, status] of cases) {
      const { handler } = createDeps({ signUpError: { message } });
      const response = await handler(authRequest(validRegistration));
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toMatchObject({ code });
    }
  });

  it('resends confirmation emails and maps provider errors', async () => {
    const payload = {
      action: 'resend-confirmation',
      email: 'user@example.com',
      redirectUrl: 'sorita://auth/callback',
    };
    const success = createDeps();
    expect((await success.handler(authRequest(payload))).status).toBe(200);
    expect(success.resendMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      options: { emailRedirectTo: 'sorita://auth/callback' },
      type: 'signup',
    });

    const failure = createDeps({ resendError: { message: 'Provider unavailable' } });
    const failureResponse = await failure.handler(authRequest(payload));
    expect(failureResponse.status).toBe(400);
    await expect(failureResponse.json()).resolves.toMatchObject({ code: 'unexpected' });
  });

  it('maps anonymous password reset provider errors', async () => {
    const { handler } = createDeps({
      availabilityRow: { email_available: false, username_available: true },
      resetPasswordErrors: [{ message: 'Provider unavailable' }],
    });
    const response = await handler(authRequest({
      action: 'request-password-reset',
      email: 'user@example.com',
      redirectUrl: 'sorita://reset-password',
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'unexpected' });
  });

  it('requires a valid session and current password for authenticated password reset', async () => {
    const payload = {
      action: 'request-password-reset-authenticated',
      currentPassword: 'Current!123',
      redirectUrl: 'sorita://reset-password',
    };
    const missing = createDeps();
    const missingResponse = await missing.handler(authRequest(payload));
    expect(missingResponse.status).toBe(401);
    await expect(missingResponse.json()).resolves.toMatchObject({ code: 'missing_authorization' });

    for (const getUserResult of [
      { data: { user: null }, error: null },
      { data: { user: { id: 'user-1', email: null } }, error: null },
      { data: null, error: { message: 'invalid token' } },
    ]) {
      const invalid = createDeps({ getUserResult });
      const response = await invalid.handler(authRequest(payload, { authorization: 'Bearer access' }));
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ code: 'invalid_session' });
    }

    const rateLimited = createDeps({ rateLimitedScope: 'auth:request-password-reset-authenticated' });
    expect((await rateLimited.handler(authRequest(payload, { authorization: 'Bearer access' }))).status).toBe(429);

    const wrongPassword = createDeps({
      signInResult: { data: null, error: { message: 'Invalid login credentials' } },
    });
    const wrongResponse = await wrongPassword.handler(authRequest(payload, { authorization: 'Bearer access' }));
    expect(wrongResponse.status).toBe(401);
    await expect(wrongResponse.json()).resolves.toMatchObject({ code: 'invalid_credentials' });
  });

  it('sends authenticated password reset mail and handles reset provider failure', async () => {
    const payload = {
      action: 'request-password-reset-authenticated',
      currentPassword: 'Current!123',
      redirectUrl: 'sorita://reset-password',
    };
    const success = createDeps();
    const successResponse = await success.handler(authRequest(payload, { authorization: 'Bearer access' }));
    expect(successResponse.status).toBe(200);
    expect(success.resetPasswordForEmailMock).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'sorita://reset-password',
    });

    const failed = createDeps({ resetPasswordErrors: [{ message: 'Provider unavailable' }] });
    const failedResponse = await failed.handler(authRequest(payload, { authorization: 'Bearer access' }));
    expect(failedResponse.status).toBe(400);
    await expect(failedResponse.json()).resolves.toMatchObject({ code: 'unexpected' });
  });

  it('verifies an authenticated password reset without sending mail from the edge runtime', async () => {
    const { handler, resetPasswordForEmailMock, signInWithPasswordMock } = createDeps();
    const response = await handler(authRequest({
      action: 'prepare-password-reset-authenticated',
      currentPassword: 'Current!123',
    }, { authorization: 'Bearer access' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'Current!123',
    });
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it('fails closed when a required authorization RPC fails', async () => {
    const { handler } = createDeps({ rpcErrorFor: 'check_account_availability' });
    const response = await handler(authRequest({
      action: 'check-availability',
      email: 'user@example.com',
    }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ code: 'unexpected' });
  });
});
