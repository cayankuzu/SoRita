import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook } from '@/mobile/app/test/hookTestUtils';

let focusEffectCallback: (() => void | (() => void)) | null = null;

vi.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    focusEffectCallback = callback;
  },
}));

async function triggerFocus() {
  if (!focusEffectCallback) {
    throw new Error('Focus effect callback was not registered.');
  }

  act(() => {
    focusEffectCallback?.();
  });

  await act(async () => {
    await Promise.resolve();
  });
}

describe('useFocusRefresh', () => {
  beforeEach(() => {
    focusEffectCallback = null;
  });

  it('skips the initial focus refresh by default', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    const hooks = await import('@/mobile/app/shared/hooks/useFocusRefresh');

    renderHook(() => hooks.useFocusRefresh(action, { minFocusIntervalMs: 0 }));

    await triggerFocus();
    await triggerFocus();

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('can refresh on the first focus when requested', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    const hooks = await import('@/mobile/app/shared/hooks/useFocusRefresh');

    renderHook(() => hooks.useFocusRefresh(action, { minFocusIntervalMs: 0, skipInitialFocus: false }));

    await triggerFocus();

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('throttles rapid focus refreshes', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy
      .mockReturnValueOnce(100_000)
      .mockReturnValueOnce(100_100)
      .mockReturnValueOnce(120_500);

    const hooks = await import('@/mobile/app/shared/hooks/useFocusRefresh');

    renderHook(() => hooks.useFocusRefresh(action, { minFocusIntervalMs: 20_000, skipInitialFocus: false }));

    await triggerFocus();
    await triggerFocus();
    await triggerFocus();

    expect(action).toHaveBeenCalledTimes(2);

    nowSpy.mockRestore();
  });
});
