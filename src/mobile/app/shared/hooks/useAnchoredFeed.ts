import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Holds the first card on screen still while cards are added above it.
const KEEP_FIRST_VISIBLE_CARD = { minIndexForVisible: 0 } as const;

type UseAnchoredFeedParams<ItemT> = {
  items: readonly ItemT[];
  startIndex: number;
};

/**
 * Opens a feed of cards of differing heights on the card that was tapped,
 * the way Instagram's profile and explore feeds do. Scrolling to an index
 * needs every card above it measured, so it landed on the wrong card or on
 * the first one. Instead the feed first renders from the tapped card, which
 * puts it at the top with no scroll at all. Once it is on screen the cards
 * before it are put back above, and the list keeps the tapped card in place
 * while they arrive, so scrolling up reaches them.
 */
export function useAnchoredFeed<ItemT>({ items, startIndex }: UseAnchoredFeedParams<ItemT>) {
  const anchorIndex = Math.max(0, Math.min(startIndex, items.length - 1));
  const [earlierCardsShown, setEarlierCardsShown] = useState(anchorIndex === 0);
  const frameRef = useRef<number | null>(null);

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

  useEffect(
    () => () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  return {
    data,
    maintainVisibleContentPosition: KEEP_FIRST_VISIBLE_CARD,
    onContentSizeChange,
  };
}
