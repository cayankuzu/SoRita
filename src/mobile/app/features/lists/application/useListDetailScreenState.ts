import { useCallback, useMemo } from 'react';

import type { User } from '@/mobile/app/data/contracts/entities';
import { useListDetailQuery } from '@/mobile/app/data/hooks/useListDetailQuery';
import { useReportListMutation } from '@/mobile/app/data/hooks/useListMutations';
import { useDeletePlaceMutation } from '@/mobile/app/data/hooks/usePlaceMutations';
import { useVisibleDataQuery } from '@/mobile/app/data/hooks/useVisibleDataQuery';
import { isMissingReadModelError } from '@/mobile/app/data/query/readModelErrors';
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
  const shouldUseLegacyList = isMissingReadModelError(listDetailQuery.error);
  const visibleDataQuery = useVisibleDataQuery(userId, {
    enabled: shouldUseLegacyList,
    includePlaceComments: false,
    listId,
  });
  const { mutateAsync: reportListAsync } = useReportListMutation();
  const { mutateAsync: deletePlaceAsync } = useDeletePlaceMutation();
  const activeQuery = shouldUseLegacyList ? visibleDataQuery : listDetailQuery;
  const visibleUsers = visibleDataQuery.data?.users || [];
  const visibleLists = visibleDataQuery.data?.lists || [];
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
    await activeQuery.refetch();
  }, [activeQuery]);

  const { refreshing, onRefresh } = useFocusRefresh(loadList, {
    refreshOnFocus: false,
    skipInitialFocus: true,
  });

  const list = useMemo(
    () =>
      shouldUseLegacyList
        ? visibleLists.find((item) => item.id === listId) || null
        : readModelList,
    [listId, readModelList, shouldUseLegacyList, visibleLists],
  );
  const owner = useMemo(
    () =>
      shouldUseLegacyList
        ? (list ? visibleUsers.find((item) => item.id === list.userId) || null : null)
        : listDetailQuery.header?.owner || null,
    [list, listDetailQuery.header?.owner, shouldUseLegacyList, visibleUsers],
  );
  const isOwner = Boolean(list && userId && list.userId === userId);
  const canReportList = Boolean(list && userId && list.userId !== userId);
  const displayPlaces = list?.places || [];
  const mapPlaces = useMemo(
    () =>
      list
        ? getMapMarkers(
            displayPlaces,
            list.isPublic,
            (place) => getMarkerColorForPlaceAcrossLists(place, shouldUseLegacyList ? visibleLists : [list], list.isPublic),
          )
        : [],
    [displayPlaces, list, shouldUseLegacyList, visibleLists],
  );
  const placeMarkerColorsById = useMemo(
    () =>
      new Map(
        displayPlaces.map((place) => [
          place.id,
          getMarkerColorForPlaceAcrossLists(
            place,
            shouldUseLegacyList ? visibleLists : list ? [list] : [],
            list?.isPublic ?? true,
          ),
        ]),
      ),
    [displayPlaces, list, shouldUseLegacyList, visibleLists],
  );
  const errorMessage = activeQuery.error
    ? getUserFacingErrorMessage(activeQuery.error, tr.profile.error.contentUnavailable)
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
    fetchNextPage: shouldUseLegacyList ? visibleDataQuery.fetchNextPage : listDetailQuery.fetchNextPage,
    hasNextPage: shouldUseLegacyList ? visibleDataQuery.hasNextPage : listDetailQuery.hasNextPage,
    hasPartialDataError:
      shouldUseLegacyList
        ? visibleDataQuery.hasPartialDataError
        : Boolean(listDetailQuery.error && list),
    isFetchingNextPage:
      shouldUseLegacyList
        ? visibleDataQuery.isFetchingNextPage
        : listDetailQuery.isFetchingNextPage,
    isInitialLoading:
      activeQuery.isLoading && !list && !activeQuery.error,
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
