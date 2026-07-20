import { NativeModules, TurboModuleRegistry } from 'react-native';

export type NetworkReachabilityState = {
  details?: {
    cellularGeneration?: '2g' | '3g' | '4g' | '5g' | null;
    isConnectionExpensive?: boolean;
  } | null;
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};

export type NetInfoSubscription = (() => void) | { remove: () => void };

type NetInfoRuntime = {
  addEventListener: (listener: (state: NetworkReachabilityState) => void) => NetInfoSubscription;
};

type NativeModuleLookup = {
  get?: (name: string) => unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNetInfoRuntime(value: unknown): value is NetInfoRuntime {
  return isRecord(value) && typeof value.addEventListener === 'function';
}

export function isNativeNetInfoAvailable(
  nativeModules: Record<string, unknown> = NativeModules,
  turboModuleRegistry: NativeModuleLookup = TurboModuleRegistry,
) {
  if (isRecord(nativeModules.RNCNetInfo)) {
    return true;
  }

  try {
    return typeof turboModuleRegistry.get === 'function' && turboModuleRegistry.get('RNCNetInfo') != null;
  } catch {
    return false;
  }
}

function loadNetInfoModule(loadModule: () => unknown, canLoadNativeModule: () => boolean): NetInfoRuntime | null {
  if (!canLoadNativeModule()) {
    return null;
  }

  try {
    const module = loadModule();
    const candidate = isRecord(module) && 'default' in module ? module.default : module;

    return isNetInfoRuntime(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function subscribeToNetInfo(
  listener: (state: NetworkReachabilityState) => void,
  loadModule = () => require('@react-native-community/netinfo') as unknown,
  canLoadNativeModule = isNativeNetInfoAvailable,
) {
  const netInfo = loadNetInfoModule(loadModule, canLoadNativeModule);

  if (!netInfo) {
    return null;
  }

  try {
    return netInfo.addEventListener(listener);
  } catch {
    return null;
  }
}

export function removeNetInfoSubscription(subscription: NetInfoSubscription | null) {
  if (!subscription) {
    return;
  }

  if (typeof subscription === 'function') {
    subscription();
    return;
  }

  subscription.remove();
}
