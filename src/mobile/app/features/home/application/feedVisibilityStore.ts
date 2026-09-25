type VisibilityListener = () => void;

export type FeedVisibilityStore = ReturnType<typeof createFeedVisibilityStore>;

/**
 * Remembers which feed cards have been on screen. A card loads its map
 * preview the first time it is seen and then keeps it: dropping the preview
 * whenever a card scrolled away re-rendered the whole card and decoded the map
 * again on the way back, which cost frames in both directions. Windowing
 * already unmounts rows far off screen.
 */
export function createFeedVisibilityStore() {
  const seenKeys = new Set<string>();
  const listenersByKey = new Map<string, Set<VisibilityListener>>();

  const markSeen = (visibleKeys: ReadonlySet<string>) => {
    visibleKeys.forEach((key) => {
      if (seenKeys.has(key)) {
        return;
      }

      seenKeys.add(key);
      listenersByKey.get(key)?.forEach((listener) => listener());
    });
  };

  return {
    hasBeenSeen(key: string) {
      return seenKeys.has(key);
    },
    markSeen,
    /**
     * The list reports viewability only after it has laid out and settled, which
     * delays the first cards' media. Seeding is a head start, never an override.
     */
    seedInitial(nextKeys: ReadonlySet<string>) {
      if (seenKeys.size > 0) {
        return;
      }

      markSeen(nextKeys);
    },
    subscribe(key: string, listener: VisibilityListener) {
      const listeners = listenersByKey.get(key) ?? new Set<VisibilityListener>();
      listeners.add(listener);
      listenersByKey.set(key, listeners);

      return () => {
        listeners.delete(listener);

        if (listeners.size === 0) {
          listenersByKey.delete(key);
        }
      };
    },
  };
}
