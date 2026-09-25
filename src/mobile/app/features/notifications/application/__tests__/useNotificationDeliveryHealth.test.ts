import { beforeEach, describe, expect, it, vi } from 'vitest';

const appState = vi.hoisted(() => ({
  listener: null as null | ((state: string) => void),
  remove: vi.fn(),
}));
const linking = vi.hoisted(() => ({ openSettings: vi.fn(async () => undefined) }));
const permission = vi.hoisted(() => ({ resolve: vi.fn() }));
const reliability = vi.hoisted(() => ({
  dismiss: vi.fn(async () => undefined),
  dismissed: vi.fn(async () => false),
  maker: vi.fn(() => null as string | null),
  openChannel: vi.fn(async () => undefined),
}));

vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_type: string, listener: (state: string) => void) => {
      appState.listener = listener;
      return { remove: appState.remove };
    },
  },
  Linking: linking,
}));
vi.mock('@/mobile/app/platform/notifications/pushPermission', () => ({
  resolvePushPermission: permission.resolve,
}));
vi.mock('@/mobile/app/platform/notifications/pushReliability', () => ({
  dismissBackgroundDeliveryTip: reliability.dismiss,
  getRestrictiveMakerName: reliability.maker,
  isBackgroundDeliveryTipDismissed: reliability.dismissed,
  openAppNotificationSettings: reliability.openChannel,
}));

import { useNotificationDeliveryHealth } from '@/mobile/app/features/notifications/application/useNotificationDeliveryHealth';
import { act, renderHook } from '@/mobile/app/test/hookTestUtils';

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useNotificationDeliveryHealth', () => {
  beforeEach(() => {
    appState.listener = null;
    appState.remove.mockClear();
    linking.openSettings.mockClear();
    permission.resolve.mockReset();
    reliability.dismiss.mockClear();
    reliability.dismissed.mockReset();
    reliability.dismissed.mockResolvedValue(false);
    reliability.maker.mockReset();
    reliability.maker.mockReturnValue(null);
    reliability.openChannel.mockClear();
  });

  it('warns when pushes are switched off for the app', async () => {
    permission.resolve.mockResolvedValue({ granted: false });
    const hook = renderHook(() => useNotificationDeliveryHealth());
    await settle();

    expect(hook.result.current.health).toEqual({ kind: 'blocked' });
    hook.unmount();
    expect(appState.remove).toHaveBeenCalled();
  });

  it('offers the on-screen tip once on a restrictive maker, until it is dismissed', async () => {
    permission.resolve.mockResolvedValue({ granted: true });
    reliability.maker.mockReturnValue('Xiaomi');
    const hook = renderHook(() => useNotificationDeliveryHealth());
    await settle();

    expect(hook.result.current.health).toEqual({ kind: 'background-tip', maker: 'Xiaomi' });

    act(() => {
      hook.result.current.dismissTip();
    });
    expect(hook.result.current.health).toEqual({ kind: 'ok' });
    expect(reliability.dismiss).toHaveBeenCalledOnce();

    // Back from the settings, a dismissed tip stays away.
    reliability.dismissed.mockResolvedValue(true);
    act(() => {
      appState.listener?.('active');
    });
    await settle();
    expect(hook.result.current.health).toEqual({ kind: 'ok' });
    hook.unmount();
  });

  it('shows nothing on phones that deliver, or when the check itself fails', async () => {
    permission.resolve.mockResolvedValue({ granted: true });
    const healthy = renderHook(() => useNotificationDeliveryHealth());
    await settle();
    expect(healthy.result.current.health).toEqual({ kind: 'ok' });
    healthy.unmount();

    permission.resolve.mockRejectedValue(new Error('no permission API'));
    const unknown = renderHook(() => useNotificationDeliveryHealth());
    await settle();
    expect(unknown.result.current.health).toEqual({ kind: 'ok' });

    // Going to the background does not re-check.
    permission.resolve.mockClear();
    act(() => {
      appState.listener?.('background');
    });
    expect(permission.resolve).not.toHaveBeenCalled();
    unknown.unmount();
  });

  it('opens the channel page and the app page', async () => {
    permission.resolve.mockResolvedValue({ granted: true });
    const hook = renderHook(() => useNotificationDeliveryHealth());
    await settle();

    act(() => {
      hook.result.current.openNotificationSettings();
      hook.result.current.openAppSettings();
    });
    expect(reliability.openChannel).toHaveBeenCalledOnce();
    expect(linking.openSettings).toHaveBeenCalledOnce();
    hook.unmount();
  });
});
