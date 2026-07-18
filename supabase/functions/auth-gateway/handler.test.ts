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
}) {
  const rpcMock = vi.fn().mockImplementation(async (functionName: string, args: Record<string, unknown>) => {
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
        data: {
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
  const signUpMock = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  const resendMock = vi.fn().mockResolvedValue({ error: null });
  const resetPasswordForEmailMock = vi.fn().mockResolvedValue({ error: null });
  const getUserMock = vi.fn().mockResolvedValue({
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
      allowedRedirectOrigins: ['https://cayankuzu.github.io/SoRita_web', 'http://localhost:8081'],
      supabasePublishableKey: 'anon-key',
      supabaseServiceRoleKey: 'service-role',
      supabaseUrl: 'https://example.supabase.co',
    },
    createAdminClient: () => ({
      rpc: rpcMock,
    }),
    createAnonymousAuthClient: () => ({
      auth: {
        getUser: getUserMock,
        resend: resendMock,
        resetPasswordForEmail: resetPasswordForEmailMock,
        signInWithPassword: signInWithPasswordMock,
        signUp: signUpMock,
      },
    }),
    createAuthenticatedAuthClient: () => ({
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
    getUserMock,
    handler,
    rpcMock,
    resetPasswordForEmailMock,
    signInWithPasswordMock,
  };
}

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
    const { handler, resetPasswordForEmailMock } = createDeps({
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
          redirectUrl: 'https://cayankuzu.github.io/SoRita_web/reset-password',
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
    });
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://cayankuzu.github.io/SoRita_web/reset-password',
    });
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
          redirectUrl: 'https://cayankuzu.github.io/SoRita_web/reset-password',
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
});
