import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import type { ExplorePage } from '@/mobile/app/data/repositories/exploreRepository';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';

type FeedPageData = InfiniteData<{ items: PlaceFeedCardItem[] }, unknown>;
type ListPlacesData = InfiniteData<{ items: Place[] }, unknown>;
type ProfileContentData = InfiniteData<{
  lists: PlaceList[];
  places: PlaceFeedCardItem[];
}, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isInfiniteListsData(value: unknown): value is InfiniteData<PlaceList[], number> {
  return (
    isRecord(value) &&
    Array.isArray(value.pages) &&
    value.pages.every(
      (page) =>
        Array.isArray(page) &&
        page.every((list) => isRecord(list) && Array.isArray(list.places)),
    ) &&
    Array.isArray(value.pageParams)
  );
}

function isInfiniteExploreData(value: unknown): value is InfiniteData<ExplorePage> {
  return (
    isRecord(value) &&
    Array.isArray(value.pages) &&
    Array.isArray(value.pageParams) &&
    value.pages.every(
      (page) =>
        isRecord(page) &&
        Array.isArray(page.listItems) &&
        Array.isArray(page.placeItems) &&
        Array.isArray(page.userItems),
    )
  );
}

function isFeedPageData(value: unknown): value is FeedPageData {
  return (
    isRecord(value) &&
    Array.isArray(value.pages) &&
    Array.isArray(value.pageParams) &&
    value.pages.every(
      (page) =>
        isRecord(page) &&
        Array.isArray(page.items) &&
        page.items.every(isRecord),
    )
  );
}

function isProfileContentData(value: unknown): value is ProfileContentData {
  return (
    isRecord(value) &&
    Array.isArray(value.pages) &&
    Array.isArray(value.pageParams) &&
    value.pages.every(
      (page) => isRecord(page) && Array.isArray(page.lists) && Array.isArray(page.places),
    )
  );
}

export function updatePlaceReadModelCaches(
  queryClient: QueryClient,
  placeId: string,
  updater: (place: Place) => Place,
) {
  queryClient.setQueriesData({ queryKey: queryKeys.feed.all }, (data: unknown) => {
    if (!isFeedPageData(data)) {
      return data;
    }

    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((item) =>
          item.place.id === placeId ? { ...item, place: updater(item.place) } : item,
        ),
      })),
    };
  });
  queryClient.setQueriesData({ queryKey: queryKeys.explore.all }, (data: unknown) => {
    if (!isInfiniteExploreData(data)) {
      return data;
    }

    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        placeItems: page.placeItems.map((item) =>
          item.place.id === placeId ? { ...item, place: updater(item.place) } : item,
        ),
      })),
    };
  });
  queryClient.setQueriesData({ queryKey: queryKeys.profile.all }, (data: unknown) => {
    if (!isProfileContentData(data)) {
      return data;
    }

    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        lists: page.lists.map((list) => ({
          ...list,
          places: list.places.map((place) => place.id === placeId ? updater(place) : place),
        })),
        places: page.places.map((item) =>
          item.place.id === placeId ? { ...item, place: updater(item.place) } : item,
        ),
      })),
    };
  });
  queryClient.setQueriesData(
    {
      queryKey: queryKeys.list.all,
      predicate: (query) => query.queryKey[1] === 'places',
    },
    (data: unknown) => {
      if (!isFeedPageData(data)) {
        return data;
      }

      const listPlacesData = data as unknown as ListPlacesData;
      return {
        ...listPlacesData,
        pages: listPlacesData.pages.map((page) => ({
          ...page,
          items: page.items.map((place) => place.id === placeId ? updater(place) : place),
        })),
      };
    },
  );
}

function findPlaceInReadModel(data: unknown, placeId: string): Place | undefined {
  if (isInfiniteListsData(data)) {
    for (const page of data.pages) {
      for (const list of page) {
        const place = list.places.find((item) => item.id === placeId);
        if (place) {
          return place;
        }
      }
    }
  }

  if (isRecord(data) && Array.isArray(data.lists)) {
    for (const list of data.lists as PlaceList[]) {
      const place = list.places.find((item) => item.id === placeId);
      if (place) {
        return place;
      }
    }
  }

  if (isFeedPageData(data)) {
    for (const page of data.pages) {
      for (const item of page.items) {
        if ('place' in item && item.place.id === placeId) {
          return item.place;
        }

        const place = item as unknown as Place;
        if (place.id === placeId) {
          return place;
        }
      }
    }
  }

  if (isInfiniteExploreData(data)) {
    for (const page of data.pages) {
      const match = page.placeItems.find((item) => item.place.id === placeId);
      if (match) {
        return match.place;
      }
    }
  }

  if (isProfileContentData(data)) {
    for (const page of data.pages) {
      const match = page.places.find((item) => item.place.id === placeId);
      if (match) {
        return match.place;
      }
    }
  }

  return undefined;
}

export function inferOptimisticPlaceLikeState(
  queryClient: QueryClient,
  input: { placeId: string; userId: string },
) {
  const queryRoots = [
    queryKeys.feed.all,
    queryKeys.explore.all,
    queryKeys.profile.all,
    queryKeys.list.all,
    queryKeys.visibleData.all,
  ];

  for (const queryRoot of queryRoots) {
    for (const [, data] of queryClient.getQueriesData({ queryKey: queryRoot })) {
      const place = findPlaceInReadModel(data, input.placeId);
      if (place) {
        return (place.likedBy || []).includes(input.userId);
      }
    }
  }

  return false;
}
