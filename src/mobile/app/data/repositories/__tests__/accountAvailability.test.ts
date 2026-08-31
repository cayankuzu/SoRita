import { beforeEach, describe, expect, it, vi } from 'vitest';

const callJsonEdgeFunctionMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock('@/mobile/app/platform/api/edgeFunctions', () => ({
  callJsonEdgeFunction: callJsonEdgeFunctionMock,
}));

vi.mock('@/mobile/app/platform/config/env', () => ({
  env: {
    supabaseAuthGatewayFunctionName: 'auth-gateway',
  },
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}));

describe('checkAccountAvailability', () => {
  beforeEach(() => {
    callJsonEdgeFunctionMock.mockReset();
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'viewer-access-token' } },
      error: null,
    });
  });

  it('normalizes params and proxies availability checks through the auth gateway', async () => {
    callJsonEdgeFunctionMock.mockResolvedValue({
      emailAvailable: false,
      usernameAvailable: true,
    });

    const { checkAccountAvailability } = await import('@/mobile/app/data/repositories/accountAvailability');
    const result = await checkAccountAvailability({
      email: ' Test@Example.Com ',
      username: '  Test_User ',
      excludeUserId: 'viewer-1',
    });

    expect(result).toEqual({
      emailAvailable: false,
      usernameAvailable: true,
    });
    expect(callJsonEdgeFunctionMock).toHaveBeenCalledWith(
      'auth-gateway',
      {
        action: 'check-availability',
        email: 'test@example.com',
        excludeUserId: 'viewer-1',
        username: 'test_user',
      },
      { accessToken: 'viewer-access-token' },
    );
  });

  it('passes through missing optional values and defaults no payload locally', async () => {
    callJsonEdgeFunctionMock.mockResolvedValue({
      emailAvailable: true,
      usernameAvailable: false,
    });

    const { checkAccountAvailability } = await import('@/mobile/app/data/repositories/accountAvailability');
    const result = await checkAccountAvailability({});

    expect(result).toEqual({
      emailAvailable: true,
      usernameAvailable: false,
    });
    expect(callJsonEdgeFunctionMock).toHaveBeenCalledWith('auth-gateway', {
      action: 'check-availability',
      email: undefined,
      excludeUserId: undefined,
      username: undefined,
    });
  });

  it('fails closed when the gateway rejects the availability request', async () => {
    callJsonEdgeFunctionMock.mockRejectedValue(new Error('gateway failed'));

    const { checkAccountAvailability } = await import('@/mobile/app/data/repositories/accountAvailability');

    await expect(checkAccountAvailability({ email: 'a@b.com' })).rejects.toThrow('gateway failed');
  });

  it('fails closed before an owner-scoped check when no session exists', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    const { checkAccountAvailability } = await import('@/mobile/app/data/repositories/accountAvailability');

    await expect(checkAccountAvailability({
      username: 'demo_user',
      excludeUserId: 'viewer-2',
    })).rejects.toThrow('requires a session');
    expect(callJsonEdgeFunctionMock).not.toHaveBeenCalled();
  });
});
