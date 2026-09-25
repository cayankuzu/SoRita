import { describe, expect, it, vi } from 'vitest';

import { createFeedVisibilityStore } from '@/mobile/app/features/home/application/feedVisibilityStore';

describe('feedVisibilityStore', () => {
  it('notifies a row only the first time it comes on screen', () => {
    const store = createFeedVisibilityStore();
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    store.subscribe('first', firstListener);
    store.subscribe('second', secondListener);

    store.markSeen(new Set(['first']));

    expect(firstListener).toHaveBeenCalledOnce();
    expect(secondListener).not.toHaveBeenCalled();
    expect(store.hasBeenSeen('first')).toBe(true);

    store.markSeen(new Set(['second']));

    expect(firstListener).toHaveBeenCalledOnce();
    expect(secondListener).toHaveBeenCalledOnce();
  });

  it('keeps a card seen after it scrolls away and back', () => {
    const store = createFeedVisibilityStore();
    const listener = vi.fn();
    store.subscribe('item', listener);

    store.markSeen(new Set(['item']));
    store.markSeen(new Set(['other']));
    store.markSeen(new Set(['item']));

    expect(store.hasBeenSeen('item')).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('shares subscriptions by key and removes the final empty listener set', () => {
    const store = createFeedVisibilityStore();
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    const unsubscribeFirst = store.subscribe('item', firstListener);
    const unsubscribeSecond = store.subscribe('item', secondListener);

    unsubscribeFirst();
    store.markSeen(new Set(['item']));

    expect(firstListener).not.toHaveBeenCalled();
    expect(secondListener).toHaveBeenCalledOnce();

    unsubscribeSecond();
    store.markSeen(new Set(['later']));

    expect(secondListener).toHaveBeenCalledOnce();
  });

  it('gives the first rows a head start before the list reports viewability', () => {
    const store = createFeedVisibilityStore();
    const listener = vi.fn();
    store.subscribe('first', listener);

    store.seedInitial(new Set(['first']));

    expect(store.hasBeenSeen('first')).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('never overrides what the list actually reported', () => {
    const store = createFeedVisibilityStore();
    store.markSeen(new Set(['second']));

    store.seedInitial(new Set(['first']));

    expect(store.hasBeenSeen('first')).toBe(false);
    expect(store.hasBeenSeen('second')).toBe(true);
  });
});
