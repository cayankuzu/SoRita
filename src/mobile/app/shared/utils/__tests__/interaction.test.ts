import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Keyboard } from 'react-native';

import { dismissKeyboardAndRunAfterInteractions } from '@/mobile/app/shared/utils/interaction';

describe('interaction utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
});
