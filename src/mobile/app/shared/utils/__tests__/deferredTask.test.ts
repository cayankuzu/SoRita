import { afterEach, describe, expect, it, vi } from 'vitest';

import { scheduleDeferredTask } from '@/mobile/app/shared/utils/deferredTask';

describe('scheduleDeferredTask', () => {
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis, 'requestIdleCallback');
    Reflect.deleteProperty(globalThis, 'cancelIdleCallback');
  });

  it('defers fallback work without blocking the current render turn', () => {
    vi.useFakeTimers();
    const task = vi.fn();

    scheduleDeferredTask(task);

    expect(task).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('cancels fallback work before it starts', () => {
    vi.useFakeTimers();
    const task = vi.fn();
    const controller = scheduleDeferredTask(task);

    controller.cancel();
    vi.runAllTimers();

    expect(task).not.toHaveBeenCalled();
  });

  it('uses and cancels the native idle callback when available', () => {
    const task = vi.fn();
    const cancelIdleCallback = vi.fn();
    const requestIdleCallback = vi.fn(() => 42);
    Object.assign(globalThis, { cancelIdleCallback, requestIdleCallback });

    const controller = scheduleDeferredTask(task, 250);
    controller.cancel();

    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 250 });
    expect(cancelIdleCallback).toHaveBeenCalledWith(42);
    expect(task).not.toHaveBeenCalled();
  });
});
