import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { usePullToRefresh } from '@/mobile/app/shared/hooks/usePullToRefresh';

export function useFocusRefresh(action: () => void | Promise<void>) {
  useFocusEffect(
    useCallback(() => {
      void Promise.resolve(action());
    }, [action]),
  );

  return usePullToRefresh(action);
}
