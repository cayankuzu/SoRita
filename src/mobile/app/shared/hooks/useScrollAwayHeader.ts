import { useCallback, useRef, useState } from 'react';
import { Animated, type LayoutChangeEvent } from 'react-native';

import { motion } from '@/mobile/app/shared/theme/tokens';

type ScrollAwayHeaderOptions = {
  // The part of the header that never leaves, such as the status bar strip.
  pinnedHeight?: number;
};

export type ScrollAwayHeaderController = {
  height: number;
  onLayout: (event: LayoutChangeEvent) => void;
  onScrollOffset: (offset: number) => void;
  reveal: () => void;
  translateY: Animated.Value;
};

/**
 * A top bar that slides away as the content scrolls down and comes back the
 * moment it scrolls up, the way Instagram's and Facebook's bars behave. Near
 * the top the bar moves exactly with the content, so it never leaves an
 * empty band above the first item.
 */
export function useScrollAwayHeader({
  pinnedHeight = 0,
}: ScrollAwayHeaderOptions = {}): ScrollAwayHeaderController {
  const translateY = useRef(new Animated.Value(0)).current;
  const [height, setHeight] = useState(0);
  const heightRef = useRef(0);
  const hiddenRef = useRef(0);
  const lastOffsetRef = useRef<number | null>(null);
  const pinnedHeightRef = useRef(pinnedHeight);
  pinnedHeightRef.current = pinnedHeight;

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (nextHeight > 0 && Math.abs(nextHeight - heightRef.current) >= 1) {
      heightRef.current = nextHeight;
      setHeight(nextHeight);
    }
  }, []);

  const onScrollOffset = useCallback(
    (offset: number) => {
      const current = Math.max(0, offset);
      const last = lastOffsetRef.current;
      lastOffsetRef.current = current;
      if (last === null) {
        return;
      }

      const range = Math.max(0, heightRef.current - pinnedHeightRef.current);
      const next = Math.min(
        current,
        range,
        Math.max(0, hiddenRef.current + current - last),
      );
      if (Math.abs(next - hiddenRef.current) < 0.5) {
        return;
      }

      hiddenRef.current = next;
      translateY.setValue(-next);
    },
    [translateY],
  );

  // Brings the bar back, as on a tab switch, and starts tracking afresh so
  // the next list's first scroll event is not read as a jump.
  const reveal = useCallback(() => {
    lastOffsetRef.current = null;
    if (hiddenRef.current === 0) {
      return;
    }

    hiddenRef.current = 0;
    Animated.timing(translateY, {
      duration: motion.standard,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  return { height, onLayout, onScrollOffset, reveal, translateY };
}
