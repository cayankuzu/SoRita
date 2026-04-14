export function runAfterNextPaint(task: () => void | Promise<void>) {
  requestAnimationFrame(() => {
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
