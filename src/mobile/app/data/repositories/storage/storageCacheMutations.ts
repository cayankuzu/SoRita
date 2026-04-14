import type { Place, PlaceComment, PlaceList, User } from '@/mobile/app/data/contracts/entities';

export function upsertUserInCache(usersCache: User[], nextUser: User) {
  const existingIndex = usersCache.findIndex((item) => item.id === nextUser.id);

  if (existingIndex >= 0) {
    return usersCache.map((item, index) => (index === existingIndex ? nextUser : item));
  }

  return [nextUser, ...usersCache];
}

export function mergeListIntoCache(listsCache: PlaceList[], nextList: PlaceList) {
  const existingIndex = listsCache.findIndex((item) => item.id === nextList.id);

  if (existingIndex >= 0) {
    return listsCache.map((item, index) => (index === existingIndex ? nextList : item));
  }

  return [nextList, ...listsCache];
}

export function mergeListsIntoCache(listsCache: PlaceList[], nextLists: PlaceList[]) {
  let nextCache = listsCache;

  for (const list of nextLists) {
    nextCache = mergeListIntoCache(nextCache, list);
  }

  return nextCache
    .slice()
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

export function removeListFromCache(listsCache: PlaceList[], listId: string) {
  return listsCache.filter((item) => item.id !== listId);
}

function flattenComments(comments: PlaceComment[]): PlaceComment[] {
  return comments.flatMap((comment) => [
    comment,
    ...(comment.replies?.length ? flattenComments(comment.replies) : []),
  ]);
}

export function updatePlaceInLists(
  listsCache: PlaceList[],
  placeId: string,
  updater: (place: Place, list: PlaceList) => Place,
) {
  return listsCache.map((list) => {
    const hasPlace = list.places.some((place) => place.id === placeId);

    if (!hasPlace) {
      return list;
    }

    const nextUpdatedAt = new Date().toISOString();

    return {
      ...list,
      updatedAt: nextUpdatedAt,
      places: list.places.map((place) =>
        place.id === placeId ? updater(place, list) : place,
      ),
    };
  });
}

export function updateCommentTree(
  comments: PlaceComment[],
  commentId: string,
  updater: (comment: PlaceComment) => PlaceComment | null,
): PlaceComment[] {
  return comments
    .map((comment) => {
      if (comment.id === commentId) {
        return updater(comment);
      }

      if (comment.replies?.length) {
        return {
          ...comment,
          replies: updateCommentTree(comment.replies, commentId, updater),
        };
      }

      return comment;
    })
    .filter((comment): comment is PlaceComment => Boolean(comment));
}

export function updateCommentInLists(
  listsCache: PlaceList[],
  commentId: string,
  updater: (comment: PlaceComment, place: Place, list: PlaceList) => PlaceComment | null,
) {
  return listsCache.map((list) => {
    const nextPlaces = list.places.map((place) => {
      const hasComment = flattenComments(place.comments || []).some((comment) => comment.id === commentId);

      if (!hasComment) {
        return place;
      }

      return {
        ...place,
        updatedAt: new Date().toISOString(),
        comments: updateCommentTree(place.comments || [], commentId, (comment) =>
          updater(comment, place, list),
        ),
      };
    });

    const changed = nextPlaces.some((place, index) => place !== list.places[index]);

    if (!changed) {
      return list;
    }

    return {
      ...list,
      updatedAt: new Date().toISOString(),
      places: nextPlaces,
    };
  });
}
