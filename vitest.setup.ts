import { afterEach, vi } from 'vitest';

const { asyncStorageStore } = vi.hoisted(() => ({
  asyncStorageStore: new Map<string, string>(),
}));
const { secureStoreValues } = vi.hoisted(() => ({
  secureStoreValues: new Map<string, string>(),
}));

Object.assign(globalThis, {
  Deno: {
    env: {
      get: (name: string) => name === 'CLOUDFLARE_ORIGIN_SIGNATURE_REQUIRED'
        ? 'false'
        : undefined,
    },
  },
  IS_REACT_ACT_ENVIRONMENT: true,
  __DEV__: false,
});

const originalConsoleError = console.error.bind(console);
console.error = ((...args: unknown[]) => {
  const joinedArgs = args
    .filter((value): value is string => typeof value === 'string')
    .join(' ');

  if (joinedArgs.includes('react-test-renderer is deprecated.')) {
    return;
  }

  if (joinedArgs.includes('An update to TestComponent inside a test was not wrapped in act')) {
    return;
  }

  originalConsoleError(...args);
}) as typeof console.error;

afterEach(() => {
  asyncStorageStore.clear();
  secureStoreValues.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    clear: vi.fn(() => {
      asyncStorageStore.clear();
      return Promise.resolve();
    }),
    getItem: vi.fn((key: string) => Promise.resolve(asyncStorageStore.get(key) ?? null)),
    getAllKeys: vi.fn(() => Promise.resolve([...asyncStorageStore.keys()])),
    multiRemove: vi.fn((keys: string[]) => {
      keys.forEach((key) => asyncStorageStore.delete(key));
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      asyncStorageStore.delete(key);
      return Promise.resolve();
    }),
    setItem: vi.fn((key: string, value: string) => {
      asyncStorageStore.set(key, value);
      return Promise.resolve();
    }),
  },
}));

vi.mock('expo-secure-store', () => ({
  deleteItemAsync: vi.fn((key: string) => {
    secureStoreValues.delete(key);
    return Promise.resolve();
  }),
  getItemAsync: vi.fn((key: string) => Promise.resolve(secureStoreValues.get(key) ?? null)),
  setItemAsync: vi.fn((key: string, value: string) => {
    secureStoreValues.set(key, value);
    return Promise.resolve();
  }),
}));

vi.mock('expo-camera', async () => {
  const React = await import('react');

  const CameraView = React.forwardRef<unknown, Record<string, unknown>>((props, ref) =>
    React.createElement('CameraView', { ...props, ref }, props.children as React.ReactNode),
  );

  return {
    CameraView,
    useCameraPermissions: () => [{ granted: true }, vi.fn(async () => ({ granted: true }))],
    useMicrophonePermissions: () => [{ granted: true }, vi.fn(async () => ({ granted: true }))],
  };
});

vi.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}));
vi.mock('react-native', async () => import('@/mobile/app/test/mocks/react-native'));
vi.mock('@/mobile/app/platform/observability/sentry', () => ({
  captureAppMessage: () => undefined,
  registerSentryNavigationContainer: () => undefined,
  wrapWithSentry: <T,>(value: T) => value,
}));
