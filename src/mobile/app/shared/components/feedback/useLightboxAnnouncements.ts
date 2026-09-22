import React from 'react';
import { AccessibilityInfo, findNodeHandle } from 'react-native';

type LightboxAnnouncementOptions = {
  currentIndex: number;
  /** Changes when the page set is replaced, which restarts the lightbox. */
  flatListKey: string;
  /** How many pages the lightbox currently has. */
  itemCount: number;
  /** The "Fotoğraf 2/5" style label announced after a swipe. */
  positionLabel: string;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  startIndex: number;
  /** True while something is layered over the pages, such as an open menu. */
  suppressFocus: boolean;
  titleRef: React.RefObject<unknown>;
};

/**
 * The screen-reader behaviour both lightboxes need: start on the requested
 * page, put the cursor on the title once the modal has settled, and announce
 * the new position after a swipe but never on the way in.
 *
 * `ImageLightbox` and `MediaLightbox` carried identical copies of these three
 * effects - same refs, same 120ms delay, same suppression dance. They stay two
 * components because one shows cover photos and the other shows place media
 * with video, but the announcement logic has no reason to be written twice.
 */
export function useLightboxAnnouncements({
  currentIndex,
  flatListKey,
  itemCount,
  positionLabel,
  setCurrentIndex,
  startIndex,
  suppressFocus,
  titleRef,
}: LightboxAnnouncementOptions) {
  const previousAnnouncedIndexRef = React.useRef<number | null>(null);
  const suppressNextAnnouncementRef = React.useRef(true);

  // Opening on page 3 of 5 must not read "3/5" as though the user swiped there.
  React.useEffect(() => {
    suppressNextAnnouncementRef.current = true;
    setCurrentIndex(startIndex);
    previousAnnouncedIndexRef.current = startIndex;
    const resetAnnouncementTimer = setTimeout(() => {
      suppressNextAnnouncementRef.current = false;
    }, 0);

    return () => clearTimeout(resetAnnouncementTimer);
  }, [flatListKey, setCurrentIndex, startIndex]);

  React.useEffect(() => {
    if (itemCount === 0) {
      previousAnnouncedIndexRef.current = null;
      return undefined;
    }

    if (suppressFocus) {
      return undefined;
    }

    // Focusing mid-transition is dropped, so this waits for the modal.
    const focusTimer = setTimeout(() => {
      const titleHandle = titleRef.current ? findNodeHandle(titleRef.current as never) : null;
      if (titleHandle) {
        AccessibilityInfo.setAccessibilityFocus(titleHandle);
      }
    }, 120);

    return () => clearTimeout(focusTimer);
  }, [flatListKey, itemCount, suppressFocus, titleRef]);

  React.useEffect(() => {
    if (suppressNextAnnouncementRef.current) {
      suppressNextAnnouncementRef.current = false;
      return;
    }

    if (
      itemCount === 0 ||
      previousAnnouncedIndexRef.current == null ||
      previousAnnouncedIndexRef.current === currentIndex
    ) {
      previousAnnouncedIndexRef.current = currentIndex;
      return;
    }

    previousAnnouncedIndexRef.current = currentIndex;
    AccessibilityInfo.announceForAccessibility(positionLabel);
  }, [currentIndex, itemCount, positionLabel]);
}
