import {
  isNativeNetInfoAvailable,
  removeNetInfoSubscription,
  subscribeToNetInfo,
  type NetworkReachabilityState,
} from '@/mobile/app/platform/network/netInfoAdapter';

describe('netInfoAdapter', () => {
  it('does not load NetInfo when the native module is unavailable', () => {
    const loadModule = vi.fn(() => ({ default: { addEventListener: vi.fn() } }));

    const subscription = subscribeToNetInfo(vi.fn(), loadModule, () => false);

    expect(subscription).toBeNull();
    expect(loadModule).not.toHaveBeenCalled();
  });

  it('does not throw when the native NetInfo module fails during load', () => {
    const listener = vi.fn();

    const subscription = subscribeToNetInfo(listener, () => {
      throw new Error('@react-native-community/netinfo: NativeModule.RNCNetInfo is null');
    }, () => true);

    expect(subscription).toBeNull();
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not throw when NetInfo subscription fails', () => {
    const addEventListener = vi.fn(() => {
      throw new Error('NativeModule.RNCNetInfo is null');
    });

    const subscription = subscribeToNetInfo(vi.fn(), () => ({ default: { addEventListener } }), () => true);

    expect(subscription).toBeNull();
    expect(addEventListener).toHaveBeenCalledTimes(1);
  });

  it('subscribes through a valid default export and supports function cleanup', () => {
    const listener = vi.fn();
    const unsubscribe = vi.fn();
    const offlineState: NetworkReachabilityState = {
      isConnected: false,
      isInternetReachable: false,
    };
    const addEventListener = vi.fn((receivedListener: (state: NetworkReachabilityState) => void) => {
      receivedListener(offlineState);
      return unsubscribe;
    });

    const subscription = subscribeToNetInfo(listener, () => ({ default: { addEventListener } }), () => true);

    expect(listener).toHaveBeenCalledWith(offlineState);
    removeNetInfoSubscription(subscription);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('supports native subscription objects with remove methods', () => {
    const remove = vi.fn();

    const subscription = subscribeToNetInfo(vi.fn(), () => ({
      addEventListener: () => ({ remove }),
    }), () => true);

    removeNetInfoSubscription(subscription);

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('detects native NetInfo through NativeModules before requiring the package', () => {
    expect(
      isNativeNetInfoAvailable(
        { RNCNetInfo: { getCurrentState: vi.fn() } },
        { get: vi.fn(() => null) },
      ),
    ).toBe(true);
  });

  it('detects native NetInfo through TurboModuleRegistry.get', () => {
    expect(
      isNativeNetInfoAvailable(
        {},
        { get: vi.fn((name: string) => (name === 'RNCNetInfo' ? { getCurrentState: vi.fn() } : null)) },
      ),
    ).toBe(true);
  });

  it('treats TurboModuleRegistry lookup errors as unavailable', () => {
    expect(
      isNativeNetInfoAvailable(
        {},
        {
          get: () => {
            throw new Error('TurboModuleRegistry unavailable');
          },
        },
      ),
    ).toBe(false);
  });
});
