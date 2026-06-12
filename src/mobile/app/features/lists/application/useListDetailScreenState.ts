import { useCallback, useMemo } from 'react';

import type { User } from '@/mobile/app/data/contracts/entities';
import { useReportListMutation } from '@/mobile/app/data/hooks/useListMutations';
import { useDeletePlaceMutation } from '@/mobile/app/data/hooks/usePlaceMutations';
import { useVisibleDataQuery } from '@/mobile/app/data/hooks/useVisibleDataQuery';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { getMapMarkers } from '@/mobile/app/shared/utils/format';

type UseListDetailScreenStateParams = {
  listId: string;
  user: User | null;
};

export function useListDetailScreenState({ listId, user }: UseListDetailScreenStateParams) {
  const userId = user?.id;
  const visibleDataQuery = useVisibleDataQuery(userId, { listId });
  const { mutateAsync: reportListAsync } = useReportListMutation();
  const { mutateAsync: deletePlaceAsync } = useDeletePlaceMutation();
  const { refetch } = visibleDataQuery;
  const visibleUsers = visibleDataQuery.data?.users || [];
  const visibleLists = visibleDataQuery.data?.lists || [];

  const loadList = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const { refreshing, onRefresh } = useFocusRefresh(loadList);

  const list = useMemo(() => visibleLists.find((item) => item.id === listId) || null, [listId, visibleLists]);
  const owner = useMemo(
    () => (list ? visibleUsers.find((item) => item.id === list.userId) || null : null),
    [list, visibleUsers],
  );
  const isOwner = Boolean(list && userId && list.userId === userId);
  const canReportList = Boolean(list && userId && list.userId !== userId);
  const displayPlaces = list?.places || [];
  const mapPlaces = useMemo(
    () => (list ? getMapMarkers(displayPlaces, list.isPublic) : []),
    [displayPlaces, list],
  );

  const deletePlace = useCallback(async (placeId: string) => {
    await deletePlaceAsync(placeId);
  }, [deletePlaceAsync]);

  const reportList = useCallback(
    async (reason: string) => {
      if (!list || !userId) {
        throw new Error('Liste bulunamadi.');
      }

      await reportListAsync({ reporterUserId: userId, listId: list.id, reason });
    },
    [list, reportListAsync, userId],
  );

  return {
    canReportList,
    deletePlace,
    displayPlaces,
    isOwner,
    list,
    mapPlaces,
    onRefresh,
    owner,
    refreshing,
    reportList,
  };
}
