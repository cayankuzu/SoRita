import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { FlatList } from 'react-native';

// Brings one row of a list into view once the list can reach it.
//
// scrollToIndex fails until every row above the target has been measured,
// and a tall header (cover, map) is measured late. A fixed set of quick
// retries ran out before that on a slow phone and left the list at its top.
// This retries as the content grows and on a slower timer, steps to the
// furthest measured row so the next rows render, and aims once more after the
// first hit because images above can still push the row down. A touch on the
// list hands control back to the person.
const FIRST_ATTEMPT_DELAY_MS = 16;
const CONTENT_RETRY_DELAY_MS = 60;
const RETRY_DELAY_MS = 250;
const SETTLE_DELAY_MS = 400;
const MAX_ATTEMPTS = 20;
const ROW_VIEW_OFFSET = 12;
const ROW_VIEW_POSITION = 0.08;

type ScrollableList = Pick<FlatList<unknown>, 'scrollToIndex'>;

type UseScrollToListRowParams = {
  listRef: RefObject<ScrollableList | null>;
  // The row to reach, or null while there is none or it has not loaded.
  targetIndex: number | null;
  // Names the request: a new key starts over, null means nothing to reach.
  targetKey: string | null;
  // Reached, given up, or taken over by a touch.
  onDone: () => void;
};

export function useScrollToListRow({
  listRef,
  targetIndex,
  targetKey,
  onDone,
}: UseScrollToListRowParams) {
  const active = Boolean(targetKey) && targetIndex != null && targetIndex >= 0;
  const activeRef = useRef(active);
  const targetIndexRef = useRef(targetIndex);
  const onDoneRef = useRef(onDone);
  const attemptsRef = useRef(0);
  const hitsRef = useRef(0);
  const failedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tryScrollRef = useRef<() => void>(() => undefined);

  activeRef.current = active;
  targetIndexRef.current = targetIndex;
  onDoneRef.current = onDone;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const schedule = useCallback(
    (delayMs: number) => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        tryScrollRef.current();
      }, delayMs);
    },
    [clearTimer],
  );

  const finish = useCallback(() => {
    clearTimer();
    failedRef.current = false;
    if (activeRef.current) {
      onDoneRef.current();
    }
  }, [clearTimer]);

  tryScrollRef.current = () => {
    const index = targetIndexRef.current;
    if (!activeRef.current || index == null) {
      return;
    }

    attemptsRef.current += 1;
    failedRef.current = false;
    listRef.current?.scrollToIndex({
      animated: true,
      index,
      viewOffset: ROW_VIEW_OFFSET,
      viewPosition: ROW_VIEW_POSITION,
    });

    if (!failedRef.current) {
      hitsRef.current += 1;
      if (hitsRef.current >= 2) {
        finish();
      } else {
        schedule(SETTLE_DELAY_MS);
      }
      return;
    }

    if (attemptsRef.current >= MAX_ATTEMPTS) {
      finish();
      return;
    }

    schedule(RETRY_DELAY_MS);
  };

  useEffect(() => {
    attemptsRef.current = 0;
    hitsRef.current = 0;
    failedRef.current = false;

    if (!active) {
      clearTimer();
      return;
    }

    schedule(FIRST_ATTEMPT_DELAY_MS);
  }, [active, clearTimer, schedule, targetIndex, targetKey]);

  useEffect(() => clearTimer, [clearTimer]);

  const onContentSizeChange = useCallback(() => {
    if (activeRef.current && failedRef.current) {
      schedule(CONTENT_RETRY_DELAY_MS);
    }
  }, [schedule]);

  const onScrollBeginDrag = useCallback(() => {
    if (activeRef.current) {
      finish();
    }
  }, [finish]);

  const onScrollToIndexFailed = useCallback(
    ({ highestMeasuredFrameIndex, index }: { highestMeasuredFrameIndex: number; index: number }) => {
      failedRef.current = true;
      if (highestMeasuredFrameIndex >= 0 && highestMeasuredFrameIndex < index) {
        listRef.current?.scrollToIndex({ animated: false, index: highestMeasuredFrameIndex });
      }
    },
    [listRef],
  );

  return { onContentSizeChange, onScrollBeginDrag, onScrollToIndexFailed };
}
