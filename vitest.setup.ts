import { afterEach, vi } from 'vitest';

Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

vi.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}));
