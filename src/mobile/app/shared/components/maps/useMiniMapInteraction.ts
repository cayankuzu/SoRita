import React from 'react';

export const MINI_MAP_RESET_LONG_PRESS_MS = 500;
const MINI_MAP_HINT_DURATION_MS = 3000;

export function useMiniMapInteraction(resetKey: string) {
  const [isMapInteractive, setIsMapInteractive] = React.useState(false);
  const [mapFocusKey, setMapFocusKey] = React.useState(0);
  const [showInteractionHint, setShowInteractionHint] = React.useState(false);
  const hintTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const activateMap = () => {
    if (hintTimeoutRef.current) {
      clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = null;
    }

    setIsMapInteractive(true);
    setMapFocusKey((current) => current + 1);
    setShowInteractionHint(true);

    hintTimeoutRef.current = setTimeout(() => {
      setShowInteractionHint(false);
      hintTimeoutRef.current = null;
    }, MINI_MAP_HINT_DURATION_MS);
  };

  const deactivateMap = () => {
    if (hintTimeoutRef.current) {
      clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = null;
    }

    setIsMapInteractive(false);
    setShowInteractionHint(false);
  };

  React.useEffect(() => {
    if (hintTimeoutRef.current) {
      clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = null;
    }

    setIsMapInteractive(false);
    setMapFocusKey(0);
    setShowInteractionHint(false);
  }, [resetKey]);

  React.useEffect(() => {
    return () => {
      if (hintTimeoutRef.current) {
        clearTimeout(hintTimeoutRef.current);
        hintTimeoutRef.current = null;
      }
    };
  }, []);

  return {
    activateMap,
    deactivateMap,
    isMapInteractive,
    mapFocusKey,
    showInteractionHint,
  };
}
