import { beforeEach, describe, expect, it, vi } from 'vitest';

const refreshSessionMock = vi.fn();

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    auth: {
      refreshSession: refreshSessionMock,
    },
  },
}));

describe('refreshSupabaseSession', () => {
  beforeEach(() => {
    refreshSessionMock.mockReset();
  });

  it('shares one Supabase refresh across concurrent callers and resets afterward', async () => {
    const result = {
      data: { session: { access_token: 'fresh-token' } },
      error: null,
    };
    let resolveRefresh!: (value: typeof result) => void;

    refreshSessionMock.mockReturnValueOnce(new Promise<typeof result>((resolve) => {
      resolveRefresh = resolve;
    }));

    const { refreshSupabaseSession } = await import(
      '@/mobile/app/platform/supabase/sessionRefresh'
    );
    const first = refreshSupabaseSession();
    const second = refreshSupabaseSession();

    expect(first).toBe(second);
    await Promise.resolve();
    expect(refreshSessionMock).toHaveBeenCalledTimes(1);

    resolveRefresh(result);
    await expect(Promise.all([first, second])).resolves.toEqual([result, result]);

    refreshSessionMock.mockResolvedValueOnce(result);
    await expect(refreshSupabaseSession()).resolves.toEqual(result);
    expect(refreshSessionMock).toHaveBeenCalledTimes(2);
  });
});
