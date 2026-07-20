import { useCallback, useEffect, useRef } from 'react';

export type ScrollToOffsetHandle = {
  scrollToOffset: (params: { animated: boolean; offset: number }) => void;
};

const OFFSET_EPSILON = 2;

export function normalizeTabScrollOffset(offset: number) {
  return Number.isFinite(offset) ? Math.max(0, offset) : 0;
}

function restoreOffset(
  handle: ScrollToOffsetHandle,
  offset: number,
  force = false,
) {
  const nextOffset = normalizeTabScrollOffset(offset);

  if (!force && nextOffset <= OFFSET_EPSILON) {
    return;
  }

  try {
    handle.scrollToOffset({ animated: false, offset: nextOffset });
  } catch {
    // A native list can reject restoration until its first layout/content pass.
  }
}

function scheduleOnAnimationFrame(callback: () => void) {
  if (typeof requestAnimationFrame === 'function') {
    const frame = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(frame);
  }

  const timer = setTimeout(callback, 0);
  return () => clearTimeout(timer);
}

export function useTabScrollMemory<TTab extends string>() {
  const refs = useRef<Partial<Record<TTab, ScrollToOffsetHandle | null>>>({});
  const offsets = useRef<Partial<Record<TTab, number>>>({});
  const pendingRestores = useRef<Partial<Record<TTab, boolean>>>({});
  const scheduledCancels = useRef<Partial<Record<TTab, () => void>>>({});
  const refCallbacks = useRef<
    Partial<Record<TTab, (handle: ScrollToOffsetHandle | null) => void>>
  >({});

  const cancelScheduledRestore = useCallback((tab: TTab) => {
    scheduledCancels.current[tab]?.();
    delete scheduledCancels.current[tab];
  }, []);

  const scheduleRestore = useCallback(
    (tab: TTab, force = false) => {
      const handle = refs.current[tab];

      if (!handle) {
        if (force) {
          pendingRestores.current[tab] = true;
        }
        return;
      }

      cancelScheduledRestore(tab);
      scheduledCancels.current[tab] = scheduleOnAnimationFrame(() => {
        delete scheduledCancels.current[tab];
        delete pendingRestores.current[tab];
        restoreOffset(handle, offsets.current[tab] ?? 0, force);
      });
    },
    [cancelScheduledRestore],
  );

  const setTabScrollRef = useCallback(
    (tab: TTab, handle: ScrollToOffsetHandle | null) => {
      if (!handle) {
        cancelScheduledRestore(tab);
        delete refs.current[tab];
        return;
      }

      if (refs.current[tab] === handle) {
        return;
      }

      refs.current[tab] = handle;
      scheduleRestore(tab, Boolean(pendingRestores.current[tab]));
    },
    [cancelScheduledRestore, scheduleRestore],
  );

  const getTabScrollRefCallback = useCallback(
    (tab: TTab): ((handle: ScrollToOffsetHandle | null) => void) => {
      let callback = refCallbacks.current[tab];

      if (!callback) {
        callback = (handle) => setTabScrollRef(tab, handle);
        refCallbacks.current[tab] = callback;
      }

      return callback;
    },
    [setTabScrollRef],
  );

  const recordTabScrollOffset = useCallback((tab: TTab, offset: number) => {
    const nextOffset = normalizeTabScrollOffset(offset);
    const currentOffset = offsets.current[tab] ?? 0;

    if (Math.abs(nextOffset - currentOffset) < OFFSET_EPSILON) {
      return;
    }

    offsets.current[tab] = nextOffset;
  }, []);

  const getTabScrollRef = useCallback(
    (tab: TTab) => refs.current[tab] ?? null,
    [],
  );

  const restoreTabScrollOffset = useCallback(
    (tab: TTab) => {
      scheduleRestore(tab, true);
    },
    [scheduleRestore],
  );

  const notifyTabContentReady = useCallback(
    (tab: TTab) => {
      if (pendingRestores.current[tab] || (offsets.current[tab] ?? 0) > OFFSET_EPSILON) {
        scheduleRestore(tab, true);
      }
    },
    [scheduleRestore],
  );

  useEffect(
    () => () => {
      Object.keys(scheduledCancels.current).forEach((tab) => {
        scheduledCancels.current[tab as TTab]?.();
      });
      scheduledCancels.current = {};
    },
    [],
  );

  return {
    getTabScrollRef,
    getTabScrollRefCallback,
    notifyTabContentReady,
    recordTabScrollOffset,
    restoreTabScrollOffset,
    setTabScrollRef,
  };
}
