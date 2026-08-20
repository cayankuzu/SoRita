type VisibilityListener = () => void;

export type FeedVisibilityStore = ReturnType<typeof createFeedVisibilityStore>;

export function createFeedVisibilityStore() {
  let visibleKeys = new Set<string>();
  const listenersByKey = new Map<string, Set<VisibilityListener>>();

  const notify = (key: string) => {
    listenersByKey.get(key)?.forEach((listener) => listener());
  };

  return {
    isVisible(key: string) {
      return visibleKeys.has(key);
    },
    replace(nextKeys: ReadonlySet<string>) {
      const changedKeys = new Set<string>();

      visibleKeys.forEach((key) => {
        if (!nextKeys.has(key)) {
          changedKeys.add(key);
        }
      });
      nextKeys.forEach((key) => {
        if (!visibleKeys.has(key)) {
          changedKeys.add(key);
        }
      });

      if (changedKeys.size === 0) {
        return;
      }

      visibleKeys = new Set(nextKeys);
      changedKeys.forEach(notify);
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
