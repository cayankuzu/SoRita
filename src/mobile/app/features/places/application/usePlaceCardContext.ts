import { useMemo } from 'react';

import type { Place, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { useVisibleDataQuery } from '@/mobile/app/data/hooks/useVisibleDataQuery';
import { getHiddenUserIdsFor } from '@/mobile/app/data/selectors/visibility';

type PlaceCardContextParams = {
  commentsEnabled: boolean;
  likersEnabled: boolean;
  listsEnabled: boolean;
  owner?: User | null;
  ownerId?: string | null;
  place: Place;
  sourceAttributionEnabled: boolean;
  user: User | null;
};

export function canViewPrivateUserContent(
  viewer: User | null,
  targetUser: User | null,
  hiddenUserIds: Set<string>,
) {
  if (!targetUser) {
    return true;
  }

  if (!viewer) {
    return targetUser.isPublicAccount !== false;
  }

  if (viewer.id === targetUser.id) {
    return true;
  }

  if (hiddenUserIds.has(targetUser.id)) {
    return false;
  }

  if (targetUser.isPublicAccount !== false) {
    return true;
  }

  return (
    (viewer.following || []).includes(targetUser.id) ||
    (targetUser.followers || []).includes(viewer.id)
  );
}

function shouldHydrateVisibleContext(params: PlaceCardContextParams, sourceUserId: string | null) {
  return Boolean(
    params.commentsEnabled ||
    params.likersEnabled ||
    params.listsEnabled ||
    params.sourceAttributionEnabled ||
    sourceUserId,
  );
}

function getResolvedOwnerId(params: PlaceCardContextParams) {
  return params.ownerId || params.owner?.id || null;
}

function useVisiblePlaceContext(params: PlaceCardContextParams) {
  const sourceUserId = params.place.sourceAttribution?.userId || null;
  const enabled = shouldHydrateVisibleContext(params, sourceUserId);
  const userId = params.user?.id;
  const query = useVisibleDataQuery(params.user?.id, {
    enabled,
    includeLists: params.listsEnabled,
    includePlaceComments: false,
    listPageSize: 100,
    ownerId: userId,
  });
  const visibleUsers = useMemo(
    () => enabled ? query.data?.users || [] : [],
    [enabled, query.data?.users],
  );
  const allUsers = useMemo(
    () => enabled ? query.data?.allUsers || [] : [],
    [enabled, query.data?.allUsers],
  );
  const blockRows = useMemo(
    () => enabled ? query.data?.blockRows || [] : [],
    [enabled, query.data?.blockRows],
  );
  const visibleLists = useMemo(
    () => params.listsEnabled ? query.data?.lists || [] : [],
    [params.listsEnabled, query.data?.lists],
  );
  const usersById = useMemo(
    () => new Map(visibleUsers.map((item) => [item.id, item])),
    [visibleUsers],
  );
  const allUsersById = useMemo(
    () => new Map(allUsers.map((item) => [item.id, item])),
    [allUsers],
  );
  const hiddenUserIds = useMemo(
    () => getHiddenUserIdsFor(blockRows, userId),
    [blockRows, userId],
  );
  const myLists = useMemo<PlaceList[]>(
    () => userId
      ? visibleLists.filter((list) => list.userId === userId)
      : [],
    [userId, visibleLists],
  );
  const myListsById = useMemo(
    () => new Map(myLists.map((list) => [list.id, list])),
    [myLists],
  );

  return {
    allUsersById,
    hiddenUserIds,
    myLists,
    myListsById,
    resolvedOwnerId: getResolvedOwnerId(params),
    sourceUserId,
    usersById,
  };
}

function useSourceAttribution(
  params: PlaceCardContextParams,
  context: ReturnType<typeof useVisiblePlaceContext>,
) {
  const sourceUser = useMemo(
    () => context.sourceUserId
      ? context.allUsersById.get(context.sourceUserId) ||
        context.usersById.get(context.sourceUserId) ||
        null
      : null,
    [context.allUsersById, context.sourceUserId, context.usersById],
  );
  const canOpenSourcePlaceCard = useMemo(
    () => canViewPrivateUserContent(params.user, sourceUser, context.hiddenUserIds),
    [context.hiddenUserIds, params.user, sourceUser],
  );
  const sourceListId = params.place.sourceAttribution?.listId || null;
  const sourcePlaceId = params.place.sourceAttribution?.placeId || null;
  const canLoadSourceList = Boolean(sourceListId && canOpenSourcePlaceCard);
  const sourceQuery = useVisibleDataQuery(params.user?.id, {
    enabled: params.sourceAttributionEnabled && canLoadSourceList,
    includeLists: canLoadSourceList,
    includePlaceComments: false,
    listId: sourceListId || undefined,
    listPageSize: 1,
  });
  const sourceList = params.sourceAttributionEnabled
    ? sourceQuery.data?.lists?.[0] || null
    : null;
  const sourcePlace = useMemo(
    () => sourceList && sourcePlaceId
      ? sourceList.places.find((item) => item.id === sourcePlaceId) || null
      : null,
    [sourceList, sourcePlaceId],
  );
  const sourceOwner = useMemo(
    () => sourceList
      ? context.allUsersById.get(sourceList.userId) ||
        context.usersById.get(sourceList.userId) ||
        null
      : sourceUser,
    [context.allUsersById, context.usersById, sourceList, sourceUser],
  );

  return {
    canOpenSourcePlaceCard,
    sourceAttributionList: sourceList,
    sourceAttributionOwner: sourceOwner,
    sourceAttributionPlace: sourcePlace,
    sourceAttributionUser: sourceUser,
  };
}

export function usePlaceCardContext(params: PlaceCardContextParams) {
  const context = useVisiblePlaceContext(params);
  const source = useSourceAttribution(params, context);

  return {
    ...context,
    ...source,
    sourceAttributionUserId: context.sourceUserId,
  };
}
