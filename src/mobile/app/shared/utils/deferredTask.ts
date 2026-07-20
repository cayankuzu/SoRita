type IdleDeadlineLike = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IdleCallbackHandle = number;
type DeferredTaskCallback = () => void;
type DeferredTaskController = {
  cancel: () => void;
};

type RequestIdleCallbackLike = (
  callback: (deadline: IdleDeadlineLike) => void,
  options?: { timeout?: number },
) => IdleCallbackHandle;

type CancelIdleCallbackLike = (handle: IdleCallbackHandle) => void;

type IdleCallbackGlobal = typeof globalThis & {
  cancelIdleCallback?: CancelIdleCallbackLike;
  requestIdleCallback?: RequestIdleCallbackLike;
};

export function scheduleDeferredTask(
  callback: DeferredTaskCallback,
  timeout = 300,
): DeferredTaskController {
  const idleGlobal = globalThis as IdleCallbackGlobal;

  if (typeof idleGlobal.requestIdleCallback === 'function') {
    const handle = idleGlobal.requestIdleCallback(() => {
      callback();
    }, { timeout });

    return {
      cancel: () => {
        idleGlobal.cancelIdleCallback?.(handle);
      },
    };
  }

  const handle = setTimeout(callback, 0);

  return {
    cancel: () => clearTimeout(handle),
  };
}
