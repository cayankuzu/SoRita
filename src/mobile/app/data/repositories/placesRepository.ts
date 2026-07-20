import type {
  ListPlaceCommentLikeRow,
  ListPlaceCommentRow,
} from '@/mobile/app/platform/supabase/databaseTypes';
import { submitModerationReport } from '@/mobile/app/data/repositories/moderationReports';
import { deleteStorageAssetsByUrls } from '@/mobile/app/platform/supabase/media';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { assertNoObjectionableContent } from '@/mobile/app/shared/utils/contentModeration';
import {
  COMMENT_EDIT_WINDOW_MS,
  COMMENT_MAX_LENGTH,
  clampTextLength,
} from '@/mobile/app/shared/validation/contentLimits';

type PlaceCommentRecord = ListPlaceCommentRow & {
  like_count?: number;
  list_place_comment_likes?: ListPlaceCommentLikeRow[] | null;
  viewer_has_liked?: boolean;
};

export type PlaceCommentCursor = {
  createdAt: string;
  id: string;
};

export type PlaceCommentPage = PlaceCommentRecord[] & {
  nextCursor?: PlaceCommentCursor;
};

type PlaceCommentThreadRow = Omit<PlaceCommentRecord, 'list_place_comment_likes'> & {
  like_count?: number | string | null;
  thread_created_at: string;
  thread_id: string;
  viewer_has_liked?: boolean | null;
};

function buildCommentEditCutoffIso(now = Date.now()) {
  return new Date(now - COMMENT_EDIT_WINDOW_MS).toISOString();
}

export async function getPlaceCommentsPage(
  placeId: string,
  pageOffset: number,
  pageSize: number,
): Promise<PlaceCommentRecord[]> {
  const { data: topLevelComments, error: topLevelCommentsError } = await supabase
    .from('list_place_comments')
    .select(`
      id,
      list_place_id,
      user_id,
      parent_comment_id,
      content,
      created_at,
      updated_at,
      list_place_comment_likes (
        comment_id,
        user_id,
        created_at
      )
    `)
    .eq('list_place_id', placeId)
    .is('parent_comment_id', null)
    .order('created_at', { ascending: false })
    .range(pageOffset, pageOffset + pageSize - 1);

  if (topLevelCommentsError) {
    throw topLevelCommentsError;
  }

  const topLevelRows = (topLevelComments || []) as PlaceCommentRecord[];
  const topLevelIds = topLevelRows.map((item) => item.id);

  if (topLevelIds.length === 0) {
    return [];
  }

  const { data: replyComments, error: replyCommentsError } = await supabase
    .from('list_place_comments')
    .select(`
      id,
      list_place_id,
      user_id,
      parent_comment_id,
      content,
      created_at,
      updated_at,
      list_place_comment_likes (
        comment_id,
        user_id,
        created_at
      )
    `)
    .in('parent_comment_id', topLevelIds)
    .order('created_at', { ascending: true });

  if (replyCommentsError) {
    throw replyCommentsError;
  }

  return [
    ...topLevelRows,
    ...((replyComments || []) as PlaceCommentRecord[]),
  ];
}

export async function getPlaceCommentThreadsPage(params: {
  cursor?: PlaceCommentCursor | null;
  pageSize: number;
  placeId: string;
  signal?: AbortSignal;
  viewerId?: string | null;
}): Promise<PlaceCommentPage> {
  let request = supabase.rpc('place_comment_threads_page', {
    p_cursor_created_at: params.cursor?.createdAt ?? null,
    p_cursor_id: params.cursor?.id ?? null,
    p_limit: params.pageSize,
    p_list_place_id: params.placeId,
  });

  if (params.signal) {
    request = request.abortSignal(params.signal);
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const rows = ((data || []) as unknown) as PlaceCommentThreadRow[];
  const items = rows.map<PlaceCommentRecord>((row) => ({
    content: row.content,
    created_at: row.created_at,
    id: row.id,
    like_count:
      typeof row.like_count === 'string'
        ? Number(row.like_count) || 0
        : row.like_count ?? 0,
    list_place_comment_likes:
      row.viewer_has_liked && params.viewerId
        ? [{
            comment_id: row.id,
            created_at: row.updated_at,
            user_id: params.viewerId,
          }]
        : [],
    list_place_id: row.list_place_id,
    parent_comment_id: row.parent_comment_id,
    updated_at: row.updated_at,
    user_id: row.user_id,
    viewer_has_liked: Boolean(row.viewer_has_liked),
  }));
  const distinctThreads = new Map<string, string>();

  rows.forEach((row) => distinctThreads.set(row.thread_id, row.thread_created_at));
  const threadEntries = Array.from(distinctThreads.entries());
  const lastThread = threadEntries[threadEntries.length - 1];

  return Object.assign(items, {
    nextCursor:
      threadEntries.length >= params.pageSize && lastThread
        ? { createdAt: lastThread[1], id: lastThread[0] }
        : undefined,
  });
}

export async function deletePlace(placeId: string) {
  const { data: placeRows, error: placeSelectError } = await supabase
    .from('list_places')
    .select('list_place_photos ( url, thumbnail_url )')
    .eq('id', placeId);

  if (placeSelectError) {
    throw placeSelectError;
  }

  const { error } = await supabase.from('list_places').delete().eq('id', placeId);

  if (error) {
    throw error;
  }

  await deleteStorageAssetsByUrls({
    bucket: 'place-media',
    urls: ((placeRows || []) as Array<{
      list_place_photos?: Array<{ thumbnail_url?: string | null; url?: string | null }> | null;
    }>).flatMap((place) =>
      (place.list_place_photos || []).flatMap((media) => [media.url, media.thumbnail_url]),
    ).filter((value): value is string => Boolean(value)),
  });
}

export async function toggleLikePlace(placeId: string, _userId: string) {
  const { error: rpcError } = await supabase.rpc('toggle_list_place_like', {
    target_place_id: placeId,
  });

  if (rpcError) {
    throw rpcError;
  }
}

export async function createPlaceComment(
  placeId: string,
  userId: string,
  content: string,
  parentCommentId?: string | null,
  commentId?: string,
) {
  const normalizedContent = clampTextLength(content, COMMENT_MAX_LENGTH);
  assertNoObjectionableContent([{ label: tr.moderation.commentField, value: normalizedContent }]);

  const payload: Record<string, unknown> = {
    list_place_id: placeId,
    user_id: userId,
    content: normalizedContent.trim(),
  };

  if (parentCommentId) {
    payload.parent_comment_id = parentCommentId;
  }

  if (commentId) {
    payload.id = commentId;
  }

  const { error } = await supabase.from('list_place_comments').insert(payload);

  if (error) {
    throw error;
  }

}

export async function updatePlaceComment(commentId: string, userId: string, content: string) {
  const normalizedContent = clampTextLength(content, COMMENT_MAX_LENGTH);
  assertNoObjectionableContent([{ label: tr.moderation.commentField, value: normalizedContent }]);
  const editCutoffIso = buildCommentEditCutoffIso();

  const { data: updatedComment, error } = await supabase
    .from('list_place_comments')
    .update({
      content: normalizedContent.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', commentId)
    .eq('user_id', userId)
    .gte('created_at', editCutoffIso)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!updatedComment) {
    throw new Error(tr.cards.commentEditExpired);
  }

}

export async function deletePlaceComment(commentId: string) {
  const { error } = await supabase.from('list_place_comments').delete().eq('id', commentId);

  if (error) {
    throw error;
  }

}

export async function toggleLikePlaceComment(commentId: string, _userId: string) {
  const { error: rpcError } = await supabase.rpc('toggle_list_place_comment_like', {
    target_comment_id: commentId,
  });

  if (rpcError) {
    throw rpcError;
  }
}

export async function reportPlace(
  reporterUserId: string,
  placeId: string,
  reason: string,
  details?: string,
) {
  await submitModerationReport({
    targetType: 'place',
    reporterUserId,
    placeId,
    reason,
    details,
  });
}

export async function reportPlaceComment(
  commentId: string,
  reporterUserId: string,
  reason: string,
  details?: string,
) {
  await submitModerationReport({
    targetType: 'comment',
    reporterUserId,
    commentId,
    reason,
    details,
  });
}
