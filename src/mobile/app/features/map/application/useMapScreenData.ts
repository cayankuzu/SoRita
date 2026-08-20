import { useCallback, useEffect, useMemo, useState } from 'react';

import { useMapMarkersQuery } from '@/mobile/app/data/hooks/useMapMarkersQuery';
import { useVisibleDataQuery } from '@/mobile/app/data/hooks/useVisibleDataQuery';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { tr } from '@/mobile/app/shared/i18n/tr';

export function useMapScreenData(userId?: string) {
  const [fullDataRequested, setFullDataRequested] = useState(false);
  const markersQuery = useMapMarkersQuery(userId);
  const visibleDataQuery = useVisibleDataQuery(userId, {
    enabled: Boolean(userId) && fullDataRequested,
    listPageSize: 100,
    ownerId: userId,
  });
  const refetchMarkers = markersQuery.refetch;
  const refetchVisibleData = visibleDataQuery.refetch;
  const prepareFullData = useCallback(() => {
    setFullDataRequested(true);
  }, []);

  useEffect(() => {
    setFullDataRequested(false);
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) {
      return;
    }

    prepareFullData();
    await Promise.allSettled([
      refetchVisibleData(),
      refetchMarkers(),
    ]);
  }, [prepareFullData, refetchMarkers, refetchVisibleData, userId]);
  const focusRefresh = useFocusRefresh(refresh, {
    refreshOnFocus: false,
    skipInitialFocus: true,
  });
  const lists = useMemo(
    () =>
      userId
        ? (visibleDataQuery.data?.lists ?? []).filter((list) => list.userId === userId)
        : [],
    [userId, visibleDataQuery.data?.lists],
  );
  const dataError = visibleDataQuery.error || markersQuery.error;

  return {
    areMarkersLoading: markersQuery.isLoading,
    fullDataLoading: visibleDataQuery.isLoading || visibleDataQuery.isFetching,
    fullDataRequested,
    hasVisibleDataPartialError: visibleDataQuery.hasPartialDataError,
    lists,
    markerError: markersQuery.error,
    markerSnapshots: markersQuery.data,
    onRefresh: focusRefresh.onRefresh,
    prepareFullData,
    refreshing: focusRefresh.refreshing,
    retry: refresh,
    visibleDataErrorMessage: dataError
      ? getUserFacingErrorMessage(dataError, tr.map.dataErrorDescription)
      : null,
  };
}
