import { beforeEach, describe, expect, it, vi } from 'vitest';

const callJsonEdgeFunctionMock = vi.fn();
const isMissingEdgeFunctionErrorMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('@/mobile/app/platform/api/edgeFunctions', () => ({
  callJsonEdgeFunction: callJsonEdgeFunctionMock,
  isMissingEdgeFunctionError: isMissingEdgeFunctionErrorMock,
}));

vi.mock('@/mobile/app/platform/config/env', () => ({
  env: {
    supabaseAuthGatewayFunctionName: 'auth-gateway',
  },
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

describe('checkAccountAvailability', () => {
  beforeEach(() => {
    callJsonEdgeFunctionMock.mockReset();
    isMissingEdgeFunctionErrorMock.mockReset();
    rpcMock.mockReset();
    isMissingEdgeFunctionErrorMock.mockReturnValue(false);
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
    expect(callJsonEdgeFunctionMock).toHaveBeenCalledWith('auth-gateway', {
      action: 'check-availability',
      email: 'test@example.com',
      excludeUserId: 'viewer-1',
      username: 'test_user',
    });
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

  it('rethrows gateway errors', async () => {
    callJsonEdgeFunctionMock.mockRejectedValue(new Error('gateway failed'));
    rpcMock.mockResolvedValue({
      data: null,
      error: new Error('rpc failed'),
    });

    const { checkAccountAvailability } = await import('@/mobile/app/data/repositories/accountAvailability');

    await expect(checkAccountAvailability({ email: 'a@b.com' })).rejects.toThrow('gateway failed');
  });

  it('falls back to the rpc when the gateway returns an unexpected error', async () => {
    callJsonEdgeFunctionMock.mockRejectedValue(new Error('gateway failed'));
    rpcMock.mockResolvedValue({
      data: [
        {
          email_available: false,
          username_available: true,
        },
      ],
      error: null,
    });

    const { checkAccountAvailability } = await import('@/mobile/app/data/repositories/accountAvailability');
    const result = await checkAccountAvailability({
      email: 'taken@example.com',
      username: 'free_user',
    });

    expect(result).toEqual({
      emailAvailable: false,
      usernameAvailable: true,
    });
    expect(rpcMock).toHaveBeenCalledWith('check_account_availability', {
      input_email: 'taken@example.com',
      input_exclude_user_id: null,
      input_username: 'free_user',
    });
  });

  it('falls back to the rpc when the auth gateway function is unavailable', async () => {
    const missingFunctionError = new Error('Requested function was not found');
    callJsonEdgeFunctionMock.mockRejectedValue(missingFunctionError);
    isMissingEdgeFunctionErrorMock.mockReturnValue(true);
    rpcMock.mockResolvedValue({
      data: [
        {
          email_available: true,
          username_available: false,
        },
      ],
      error: null,
    });

    const { checkAccountAvailability } = await import('@/mobile/app/data/repositories/accountAvailability');
    const result = await checkAccountAvailability({
      email: ' test@example.com ',
      username: ' Demo_User ',
      excludeUserId: 'viewer-2',
    });

    expect(result).toEqual({
      emailAvailable: true,
      usernameAvailable: false,
    });
    expect(rpcMock).toHaveBeenCalledWith('check_account_availability', {
      input_email: 'test@example.com',
      input_exclude_user_id: 'viewer-2',
      input_username: 'demo_user',
    });
  });
});
