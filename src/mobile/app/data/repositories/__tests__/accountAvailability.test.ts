import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

describe('checkAccountAvailability', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    vi.useRealTimers();
  });

  it('normalizes params and returns availability flags from a row', async () => {
    rpcMock.mockResolvedValue({
      data: {
        email_available: false,
        username_available: true,
      },
      error: null,
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
    expect(rpcMock).toHaveBeenCalledWith('check_account_availability', {
      input_email: 'test@example.com',
      input_username: 'test_user',
      input_exclude_user_id: 'viewer-1',
    });
  });

  it('supports array rpc results and defaults missing values to true', async () => {
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
    const result = await checkAccountAvailability({});

    expect(result).toEqual({
      emailAvailable: true,
      usernameAvailable: false,
    });
  });

  it('throws repository errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: new Error('rpc failed'),
    });

    const { checkAccountAvailability } = await import('@/mobile/app/data/repositories/accountAvailability');

    await expect(checkAccountAvailability({ email: 'a@b.com' })).rejects.toThrow('rpc failed');
  });

  it('times out stalled rpc calls', async () => {
    vi.useFakeTimers();
    rpcMock.mockReturnValue(new Promise(() => undefined));

    const { checkAccountAvailability } = await import('@/mobile/app/data/repositories/accountAvailability');
    const promise = checkAccountAvailability({ username: 'waiting' }).catch((error) => error);

    await vi.advanceTimersByTimeAsync(3201);

    const error = await promise;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Availability check timed out');
  });
});
