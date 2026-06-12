import {
  InfiniteData,
  useInfiniteQuery,
} from '@tanstack/react-query';

import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import { getPlaceCommentsPage } from '@/mobile/app/data/repositories/placesRepository';
import type {
  ListPlaceCommentLikeRow,
  ListPlaceCommentRow,
} from '@/mobile/app/platform/supabase/databaseTypes';

const PLACE_COMMENTS_PAGE_SIZE = 20;

type PlaceCommentRecord = ListPlaceCommentRow & {
  list_place_comment_likes?: ListPlaceCommentLikeRow[] | null;
};

export function usePlaceCommentsQuery(
  placeId?: string | null,
  viewerId?: string | null,
  enabled = true,
) {
  return useInfiniteQuery<
    PlaceCommentRecord[],
    Error,
    InfiniteData<PlaceCommentRecord[], number>,
    ReturnType<typeof queryKeys.placeComments.list> | typeof queryKeys.placeComments.all,
    number
  >({
    enabled: Boolean(placeId) && enabled,
    initialPageParam: 0,
    queryKey: placeId
      ? queryKeys.placeComments.list(placeId, viewerId || '__public__')
      : queryKeys.placeComments.all,
    queryFn: ({ pageParam = 0 }) =>
      placeId
        ? getPlaceCommentsPage(placeId, pageParam, PLACE_COMMENTS_PAGE_SIZE)
        : Promise.resolve([]),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.filter((item) => !item.parent_comment_id).length < PLACE_COMMENTS_PAGE_SIZE
        ? undefined
        : allPages.reduce(
            (total, page) => total + page.filter((item) => !item.parent_comment_id).length,
            0,
          ),
  });
}
