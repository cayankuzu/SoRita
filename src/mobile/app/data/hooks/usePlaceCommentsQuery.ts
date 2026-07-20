import {
  InfiniteData,
  useInfiniteQuery,
} from '@tanstack/react-query';

import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import {
  getPlaceCommentThreadsPage,
  type PlaceCommentCursor,
  type PlaceCommentPage,
} from '@/mobile/app/data/repositories/placesRepository';
import type {
  ListPlaceCommentLikeRow,
  ListPlaceCommentRow,
} from '@/mobile/app/platform/supabase/databaseTypes';

const PLACE_COMMENTS_PAGE_SIZE = 20;
const PLACE_COMMENTS_STALE_TIME_MS = 1000 * 60 * 2;

type PlaceCommentRecord = ListPlaceCommentRow & {
  is_pending?: boolean;
  like_count?: number;
  list_place_comment_likes?: ListPlaceCommentLikeRow[] | null;
  viewer_has_liked?: boolean;
};

export function usePlaceCommentsQuery(
  placeId?: string | null,
  viewerId?: string | null,
  enabled = true,
) {
  return useInfiniteQuery<
    PlaceCommentRecord[],
    Error,
    InfiniteData<PlaceCommentRecord[], PlaceCommentCursor | null>,
    ReturnType<typeof queryKeys.placeComments.list> | typeof queryKeys.placeComments.all,
    PlaceCommentCursor | null
  >({
    enabled: Boolean(placeId) && enabled,
    initialPageParam: null,
    queryKey: placeId
      ? queryKeys.placeComments.list(placeId, viewerId || '__public__')
      : queryKeys.placeComments.all,
    queryFn: ({ pageParam, signal }) =>
      placeId
        ? getPlaceCommentThreadsPage({
            cursor: pageParam,
            pageSize: PLACE_COMMENTS_PAGE_SIZE,
            placeId,
            signal,
            viewerId,
          })
        : Promise.resolve([]),
    getNextPageParam: (lastPage) => (lastPage as PlaceCommentPage).nextCursor,
    staleTime: PLACE_COMMENTS_STALE_TIME_MS,
  });
}
