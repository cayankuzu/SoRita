import { InteractionManager, Keyboard } from 'react-native';

export function runAfterNextPaint(task: () => void | Promise<void>) {
  if (typeof requestAnimationFrame !== 'function') {
    const timeoutId = setTimeout(() => {
      void task();
    }, 0);

    return () => clearTimeout(timeoutId);
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const frameId = requestAnimationFrame(() => {
    timeoutId = setTimeout(() => {
      timeoutId = null;
      void task();
    }, 0);
  });

  return () => {
    cancelAnimationFrame(frameId);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };
}

export function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    runAfterNextPaint(resolve);
  });
}

export function dismissKeyboardAndRunAfterInteractions(task: () => void | Promise<void>) {
  Keyboard.dismiss();
  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      void task();
    }, 0);
  });
}

export function isPromiseLike<T = unknown>(value: unknown): value is Promise<T> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'then' in value &&
      typeof (value as Promise<T>).then === 'function',
  );
}
