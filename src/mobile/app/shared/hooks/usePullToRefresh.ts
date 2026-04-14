import { useCallback, useState } from 'react';

const MIN_REFRESH_DURATION_MS = 250;

export function usePullToRefresh(action: () => void | Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await Promise.all([
        Promise.resolve(action()),
        new Promise((resolve) => setTimeout(resolve, MIN_REFRESH_DURATION_MS)),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [action]);

  return { refreshing, onRefresh };
}
