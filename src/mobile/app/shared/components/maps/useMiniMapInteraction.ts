import React from 'react';

export const MINI_MAP_RESET_LONG_PRESS_MS = 500;
const MINI_MAP_HINT_DURATION_MS = 3000;
const coordinatorListeners = new Set<() => void>();
let activeMiniMapOwner: string | null = null;
let nextMiniMapInstance = 0;

function subscribeToMiniMapCoordinator(listener: () => void) {
  coordinatorListeners.add(listener);
  return () => coordinatorListeners.delete(listener);
}

function setActiveMiniMapOwner(owner: string | null) {
  if (activeMiniMapOwner === owner) {
    return;
  }

  activeMiniMapOwner = owner;
  coordinatorListeners.forEach((listener) => listener());
}

export function useMiniMapInteraction(resetKey: string) {
  const instanceIdRef = React.useRef<string | null>(null);
  if (!instanceIdRef.current) {
    nextMiniMapInstance += 1;
    instanceIdRef.current = `mini-map:${nextMiniMapInstance}`;
  }
  const instanceId = instanceIdRef.current;
  const isMapInteractive = React.useSyncExternalStore(
    subscribeToMiniMapCoordinator,
    () => activeMiniMapOwner === instanceId,
    () => false,
  );
  const [mapFocusKey, setMapFocusKey] = React.useState(0);
  const [showInteractionHint, setShowInteractionHint] = React.useState(false);
  const hintTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHintTimeout = React.useCallback(() => {
    if (hintTimeoutRef.current) {
      clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = null;
    }
  }, []);

  const activateMap = React.useCallback(() => {
    clearHintTimeout();
    setActiveMiniMapOwner(instanceId);
    setMapFocusKey((current) => current + 1);
    setShowInteractionHint(true);

    hintTimeoutRef.current = setTimeout(() => {
      setShowInteractionHint(false);
      hintTimeoutRef.current = null;
    }, MINI_MAP_HINT_DURATION_MS);
  }, [clearHintTimeout, instanceId]);

  const deactivateMap = React.useCallback(() => {
    clearHintTimeout();
    if (activeMiniMapOwner === instanceId) {
      setActiveMiniMapOwner(null);
    }
    setShowInteractionHint(false);
  }, [clearHintTimeout, instanceId]);

  React.useEffect(() => {
    clearHintTimeout();
    if (activeMiniMapOwner === instanceId) {
      setActiveMiniMapOwner(null);
    }
    setMapFocusKey(0);
    setShowInteractionHint(false);
  }, [clearHintTimeout, instanceId, resetKey]);

  React.useEffect(() => {
    if (!isMapInteractive) {
      clearHintTimeout();
      setShowInteractionHint(false);
    }
  }, [clearHintTimeout, isMapInteractive]);

  React.useEffect(() => {
    return () => {
      clearHintTimeout();
      if (activeMiniMapOwner === instanceId) {
        setActiveMiniMapOwner(null);
      }
    };
  }, [clearHintTimeout, instanceId]);

  return {
    activateMap,
    deactivateMap,
    isMapInteractive,
    mapFocusKey,
    showInteractionHint,
  };
}
