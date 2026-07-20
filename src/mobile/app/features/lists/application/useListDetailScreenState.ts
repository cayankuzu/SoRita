import { useCallback, useMemo } from 'react';

import type { User } from '@/mobile/app/data/contracts/entities';
import { useListDetailQuery } from '@/mobile/app/data/hooks/useListDetailQuery';
import { useReportListMutation } from '@/mobile/app/data/hooks/useListMutations';
import { useDeletePlaceMutation } from '@/mobile/app/data/hooks/usePlaceMutations';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { useFocusRefresh } from '@/mobile/app/shared/hooks/useFocusRefresh';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  getMapMarkers,
  getMarkerColorForPlaceAcrossLists,
} from '@/mobile/app/shared/utils/markerColors';

type UseListDetailScreenStateParams = {
  listId: string;
  user: User | null;
};

export function useListDetailScreenState({ listId, user }: UseListDetailScreenStateParams) {
  const userId = user?.id;
  const listDetailQuery = useListDetailQuery(listId, userId);
  const { mutateAsync: reportListAsync } = useReportListMutation();
  const { mutateAsync: deletePlaceAsync } = useDeletePlaceMutation();
  const readModelList = useMemo(
    () =>
      listDetailQuery.header
        ? {
            ...listDetailQuery.header.list,
            places: listDetailQuery.places,
          }
        : null,
    [listDetailQuery.header, listDetailQuery.places],
  );

  const loadList = useCallback(async () => {
    await listDetailQuery.refetch();
  }, [listDetailQuery]);

  const { refreshing, onRefresh } = useFocusRefresh(loadList, {
    refreshOnFocus: false,
    skipInitialFocus: true,
  });

  const list = readModelList;
  const owner = listDetailQuery.header?.owner || null;
  const isOwner = Boolean(list && userId && list.userId === userId);
  const canReportList = Boolean(list && userId && list.userId !== userId);
  const displayPlaces = useMemo(() => list?.places || [], [list?.places]);
  const mapPlaces = useMemo(
    () =>
      list
        ? getMapMarkers(
            displayPlaces,
            list.isPublic,
            (place) => getMarkerColorForPlaceAcrossLists(place, [list], list.isPublic),
          )
        : [],
    [displayPlaces, list],
  );
  const placeMarkerColorsById = useMemo(
    () =>
      new Map(
        displayPlaces.map((place) => [
          place.id,
          getMarkerColorForPlaceAcrossLists(
            place,
            list ? [list] : [],
            list?.isPublic ?? true,
          ),
        ]),
      ),
    [displayPlaces, list],
  );
  const errorMessage = listDetailQuery.error
    ? getUserFacingErrorMessage(listDetailQuery.error, tr.profile.error.contentUnavailable)
    : null;

  const deletePlace = useCallback(async (placeId: string) => {
    await deletePlaceAsync(placeId);
  }, [deletePlaceAsync]);

  const reportList = useCallback(
    async (reason: string, details?: string) => {
      if (!list || !userId) {
        throw new Error(tr.cards.listNotFound);
      }

      await reportListAsync({ reporterUserId: userId, listId: list.id, reason, details });
    },
    [list, reportListAsync, userId],
  );
  return {
    canReportList,
    deletePlace,
    displayPlaces,
    errorMessage,
    fetchNextPage: listDetailQuery.fetchNextPage,
    hasNextPage: listDetailQuery.hasNextPage,
    hasPartialDataError: Boolean(listDetailQuery.error && list),
    isFetchingNextPage: listDetailQuery.isFetchingNextPage,
    isInitialLoading:
      listDetailQuery.isLoading && !list && !listDetailQuery.error,
    isOwner,
    list,
    mapPlaces,
    onRefresh,
    owner,
    placeMarkerColorsById,
    refreshing,
    reportList,
    retry: loadList,
  };
}
