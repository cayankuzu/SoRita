import { describe, expect, it, vi } from 'vitest';

import { createFeedVisibilityStore } from '@/mobile/app/features/home/application/feedVisibilityStore';

describe('feedVisibilityStore', () => {
  it('notifies only rows whose visibility changed', () => {
    const store = createFeedVisibilityStore();
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    store.subscribe('first', firstListener);
    store.subscribe('second', secondListener);

    store.replace(new Set(['first']));

    expect(firstListener).toHaveBeenCalledOnce();
    expect(secondListener).not.toHaveBeenCalled();
    expect(store.isVisible('first')).toBe(true);

    store.replace(new Set(['second']));

    expect(firstListener).toHaveBeenCalledTimes(2);
    expect(secondListener).toHaveBeenCalledOnce();
  });

  it('does not notify for an identical snapshot', () => {
    const store = createFeedVisibilityStore();
    const listener = vi.fn();
    store.subscribe('item', listener);

    store.replace(new Set(['item']));
    store.replace(new Set(['item']));

    expect(listener).toHaveBeenCalledOnce();
  });

  it('shares subscriptions by key and removes the final empty listener set', () => {
    const store = createFeedVisibilityStore();
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    const unsubscribeFirst = store.subscribe('item', firstListener);
    const unsubscribeSecond = store.subscribe('item', secondListener);

    unsubscribeFirst();
    store.replace(new Set(['item']));

    expect(firstListener).not.toHaveBeenCalled();
    expect(secondListener).toHaveBeenCalledOnce();

    unsubscribeSecond();
    store.replace(new Set());

    expect(secondListener).toHaveBeenCalledOnce();
  });
});
