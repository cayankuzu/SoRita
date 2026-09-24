import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

// Holds the first card on screen still while cards are added above it.
const KEEP_FIRST_VISIBLE_CARD = { minIndexForVisible: 0 } as const;
// How long the tapped card settles before the earlier cards go in above it.
const REVEAL_DELAY_MS = 500;
// Long enough for the list to have been moved down past the earlier cards.
const ANCHOR_CHECK_DELAY_MS = 300;
const ANCHOR_RETRY_DELAY_MS = 120;
const MAX_ANCHOR_STEPS = 6;

type UseAnchoredFeedParams<ItemT> = {
  items: readonly ItemT[];
  startIndex: number;
  // Space above the tapped card, as the list's top padding leaves it.
  viewOffset?: number;
};

/**
 * Opens a feed of cards of differing heights on the card that was tapped,
 * the way Instagram's profile and explore feeds do. Scrolling to an index
 * needs every card above it measured, so it landed on the wrong card or on
 * the first one. Instead the feed first renders from the tapped card, which
 * puts it at the top with no scroll at all. Once it has settled the cards
 * before it are put back above, and the list keeps the tapped card in place
 * while they arrive, so scrolling up reaches them.
 *
 * Android does not always hold the card: in two openings of four the list
 * stayed at the top, now showing the first card. The list is then still
 * scrolled to zero, where a held card never leaves it, so it is taken back
 * to the tapped card, stepping through unmeasured cards if it must.
 */
export function useAnchoredFeed<ItemT>({
  items,
  startIndex,
  viewOffset = 0,
}: UseAnchoredFeedParams<ItemT>) {
  const listRef = useRef<FlatList<ItemT>>(null);
  const anchorIndex = Math.max(0, Math.min(startIndex, items.length - 1));
  const [earlierCardsShown, setEarlierCardsShown] = useState(anchorIndex === 0);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offsetRef = useRef(0);
  const userScrolledRef = useRef(false);
  const stepsRef = useRef(0);

  const data = useMemo(
    () => (earlierCardsShown ? items : items.slice(anchorIndex)),
    [anchorIndex, earlierCardsShown, items],
  );

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      if (earlierCardsShown || height <= 0 || data.length === 0 || revealTimerRef.current != null) {
        return;
      }

      revealTimerRef.current = setTimeout(() => {
        revealTimerRef.current = null;
        setEarlierCardsShown(true);
      }, REVEAL_DELAY_MS);
    },
    [data.length, earlierCardsShown],
  );

  const scrollToAnchor = useCallback(() => {
    checkTimerRef.current = null;
    if (!userScrolledRef.current) {
      listRef.current?.scrollToIndex({ animated: false, index: anchorIndex, viewOffset });
    }
  }, [anchorIndex, viewOffset]);

  const schedule = useCallback((callback: () => void, delay: number) => {
    if (checkTimerRef.current != null) {
      clearTimeout(checkTimerRef.current);
    }
    checkTimerRef.current = setTimeout(callback, delay);
  }, []);

  useEffect(() => {
    if (!earlierCardsShown || anchorIndex === 0) {
      return;
    }

    // A held card leaves the list scrolled down past the cards above it.
    schedule(() => {
      checkTimerRef.current = null;
      if (offsetRef.current < 1) {
        scrollToAnchor();
      }
    }, ANCHOR_CHECK_DELAY_MS);
  }, [anchorIndex, earlierCardsShown, schedule, scrollToAnchor]);

  useEffect(
    () => () => {
      if (revealTimerRef.current != null) {
        clearTimeout(revealTimerRef.current);
      }
      if (checkTimerRef.current != null) {
        clearTimeout(checkTimerRef.current);
      }
    },
    [],
  );

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  const onScrollBeginDrag = useCallback(() => {
    userScrolledRef.current = true;
  }, []);

  // The tapped card is not measured yet: step to the furthest measured card,
  // which renders the next ones, then aim for it again.
  const onScrollToIndexFailed = useCallback(
    ({ highestMeasuredFrameIndex }: { highestMeasuredFrameIndex: number }) => {
      if (userScrolledRef.current || stepsRef.current >= MAX_ANCHOR_STEPS) {
        return;
      }

      stepsRef.current += 1;
      if (highestMeasuredFrameIndex >= 0 && highestMeasuredFrameIndex < anchorIndex) {
        listRef.current?.scrollToIndex({ animated: false, index: highestMeasuredFrameIndex });
      }
      schedule(scrollToAnchor, ANCHOR_RETRY_DELAY_MS);
    },
    [anchorIndex, schedule, scrollToAnchor],
  );

  return {
    data,
    listRef,
    maintainVisibleContentPosition: KEEP_FIRST_VISIBLE_CARD,
    onContentSizeChange,
    onScroll,
    onScrollBeginDrag,
    onScrollToIndexFailed,
  };
}
