import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Keyboard } from 'react-native';

import {
  dismissKeyboardAndRunAfterInteractions,
  runAfterNextPaint,
} from '@/mobile/app/shared/utils/interaction';

describe('interaction utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('dismisses the keyboard before running deferred modal-close work', () => {
    const dismissSpy = vi.spyOn(Keyboard, 'dismiss');
    const task = vi.fn();

    dismissKeyboardAndRunAfterInteractions(task);

    expect(dismissSpy).toHaveBeenCalledTimes(1);
    expect(task).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('runs non-critical work after the next paint and supports cancellation', () => {
    const task = vi.fn();
    const cancel = runAfterNextPaint(task);

    expect(task).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(task).toHaveBeenCalledTimes(1);

    const cancelledTask = vi.fn();
    const cancelPendingTask = runAfterNextPaint(cancelledTask);
    cancelPendingTask();
    vi.runAllTimers();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(cancelledTask).not.toHaveBeenCalled();
    cancel();
  });
});
