import { useEffect, useRef } from 'react';

import type { PersistedMapScreenState } from '@/mobile/app/contracts/mapScreenState';
import { logger } from '@/mobile/app/platform/feedback/logger';
import {
  getPersistedMapScreenState,
  savePersistedMapScreenState,
} from '@/mobile/app/platform/storage/mapScreenState';

const SAVE_DEBOUNCE_MS = 180;

// The map comes back as it was left: the open or minimized editor and its
// draft, the selection, the filter and the viewport. Nothing is written until
// the saved state has been read, so an empty first render cannot overwrite it.
export function useMapScreenPersistence({
  restore,
  state,
  userId,
}: {
  restore: (persisted: PersistedMapScreenState) => void;
  state: PersistedMapScreenState;
  userId?: string;
}) {
  const hasRestoredRef = useRef(false);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;

  useEffect(() => {
    if (!userId || hasRestoredRef.current) {
      return;
    }

    let active = true;

    void getPersistedMapScreenState(userId)
      .then((persisted) => {
        if (active && persisted) {
          restoreRef.current(persisted);
        }

        hasRestoredRef.current = true;
      })
      .catch((error) => {
        logger.warn('map', 'Failed to restore persisted map screen state', error);
        hasRestoredRef.current = true;
      });

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !hasRestoredRef.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void savePersistedMapScreenState(userId, state).catch((error) => {
        logger.warn('map', 'Failed to persist map screen state', error);
      });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [state, userId]);
}
