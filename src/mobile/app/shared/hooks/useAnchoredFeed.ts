import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FlatList, ViewToken } from 'react-native';

// Holds the first card on screen still while cards are added above it.
const KEEP_FIRST_VISIBLE_CARD = { minIndexForVisible: 0 } as const;
// Counts a card as on screen once any of it shows.
const FIRST_CARD_VIEWABILITY = { itemVisiblePercentThreshold: 1 } as const;
// Long enough for the cards added above to be laid out and measured.
const ANCHOR_CHECK_DELAY_MS = 250;
const ANCHOR_RETRY_DELAY_MS = 120;
const MAX_ANCHOR_RETRIES = 3;

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
 * puts it at the top with no scroll at all. Once it is on screen the cards
 * before it are put back above, and the list keeps the tapped card in place
 * while they arrive, so scrolling up reaches them.
 *
 * Android does not always hold the card: now and then the cards went in
 * above before the tapped one was mounted, and the feed showed the first
 * card. So once they are laid out, if the first card on screen is
 * not the tapped one and nobody has scrolled, the list goes back to it; by
 * then the tapped card is measured and the scroll is exact.
 */
export function useAnchoredFeed<ItemT>({
  items,
  startIndex,
  viewOffset = 0,
}: UseAnchoredFeedParams<ItemT>) {
  const listRef = useRef<FlatList<ItemT>>(null);
  const anchorIndex = Math.max(0, Math.min(startIndex, items.length - 1));
  const [earlierCardsShown, setEarlierCardsShown] = useState(anchorIndex === 0);
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstVisibleItemRef = useRef<ItemT | null>(null);
  const userScrolledRef = useRef(false);
  const retriesRef = useRef(0);
  const anchorItemRef = useRef<ItemT | undefined>(items[anchorIndex]);
  anchorItemRef.current = items[anchorIndex];

  const data = useMemo(
    () => (earlierCardsShown ? items : items.slice(anchorIndex)),
    [anchorIndex, earlierCardsShown, items],
  );

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      if (earlierCardsShown || height <= 0 || data.length === 0 || frameRef.current != null) {
        return;
      }

      // One frame for the tapped card to reach the screen, so the list has a
      // card to hold on to when the earlier ones go in above it.
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        setEarlierCardsShown(true);
      });
    },
    [data.length, earlierCardsShown],
  );

  const returnToAnchor = useCallback(() => {
    timerRef.current = null;
    const anchorItem = anchorItemRef.current;
    if (userScrolledRef.current || anchorItem === undefined || firstVisibleItemRef.current === anchorItem) {
      return;
    }

    listRef.current?.scrollToIndex({ animated: false, index: anchorIndex, viewOffset });
  }, [anchorIndex, viewOffset]);

  const scheduleReturn = useCallback(
    (delay: number) => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(returnToAnchor, delay);
    },
    [returnToAnchor],
  );

  useEffect(() => {
    if (!earlierCardsShown || anchorIndex === 0) {
      return undefined;
    }

    scheduleReturn(ANCHOR_CHECK_DELAY_MS);
    return undefined;
  }, [anchorIndex, earlierCardsShown, scheduleReturn]);

  useEffect(
    () => () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
      }
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  // FlatList refuses a new viewability callback after mount, so it reads refs.
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<ItemT>[] }) => {
      firstVisibleItemRef.current = viewableItems.find((token) => token.isViewable)?.item ?? null;
    },
  ).current;

  const onScrollBeginDrag = useCallback(() => {
    userScrolledRef.current = true;
  }, []);

  const onScrollToIndexFailed = useCallback(() => {
    if (retriesRef.current >= MAX_ANCHOR_RETRIES) {
      return;
    }

    retriesRef.current += 1;
    scheduleReturn(ANCHOR_RETRY_DELAY_MS);
  }, [scheduleReturn]);

  return {
    data,
    listRef,
    maintainVisibleContentPosition: KEEP_FIRST_VISIBLE_CARD,
    onContentSizeChange,
    onScrollBeginDrag,
    onScrollToIndexFailed,
    onViewableItemsChanged,
    viewabilityConfig: FIRST_CARD_VIEWABILITY,
  };
}
