import { useCallback, useMemo } from 'react';

import type { User } from '@/mobile/app/data/contracts/entities';
import { storage } from '@/mobile/app/data/repositories/supabaseStorage';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { useStorageVersion } from '@/mobile/app/shared/hooks/useStorageVersion';
import { getMapMarkers } from '@/mobile/app/shared/utils/format';

type UseListDetailScreenStateParams = {
  listId: string;
  user: User | null;
};

export function useListDetailScreenState({ listId, user }: UseListDetailScreenStateParams) {
  const storageVersion = useStorageVersion();
  const userId = user?.id;

  const loadList = useCallback(async () => {
    await storage.refreshVisibleData(userId);
  }, [userId]);

  const { refreshing, onRefresh } = useFocusRefresh(loadList);

  const list = useMemo(() => storage.getListById(listId) || null, [listId, storageVersion]);
  const owner = useMemo(() => (list ? storage.findUserById(list.userId) : null), [list, storageVersion]);
  const isOwner = Boolean(list && userId && list.userId === userId);
  const canReportList = Boolean(list && userId && list.userId !== userId);
  const displayPlaces = list?.places || [];
  const mapPlaces = useMemo(
    () => (list ? getMapMarkers(displayPlaces, list.isPublic) : []),
    [displayPlaces, list],
  );

  const deletePlace = useCallback(async (placeId: string) => {
    await storage.deletePlace(placeId);
  }, []);

  const reportList = useCallback(
    async (reason: string) => {
      if (!list || !userId) {
        throw new Error('Liste bulunamadi.');
      }

      await storage.reportList(userId, list.id, reason);
    },
    [list, userId],
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
