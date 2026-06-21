import type {
  ListPlaceCommentLikeRow,
  ListPlaceCommentRow,
} from '@/mobile/app/platform/supabase/databaseTypes';
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
  list_place_comment_likes?: ListPlaceCommentLikeRow[] | null;
};

function isMissingRpcFunctionError(error: unknown) {
  return (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error.code === 'PGRST202' || error.code === '42883')
  );
}

function buildCommentEditCutoffIso(now = Date.now()) {
  return new Date(now - COMMENT_EDIT_WINDOW_MS).toISOString();
}

function isCommentEditable(createdAt?: string | null, now = Date.now()) {
  if (!createdAt) {
    return false;
  }

  const createdAtMs = new Date(createdAt).getTime();

  if (Number.isNaN(createdAtMs)) {
    return false;
  }

  return now - createdAtMs <= COMMENT_EDIT_WINDOW_MS;
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
    ),
  });
}

export async function toggleLikePlace(placeId: string, userId: string) {
  const { data: existingLike, error: selectError } = await supabase
    .from('list_place_likes')
    .select('list_place_id')
    .eq('list_place_id', placeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existingLike) {
    const { error } = await supabase
      .from('list_place_likes')
      .delete()
      .eq('list_place_id', placeId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase.from('list_place_likes').insert({
      list_place_id: placeId,
      user_id: userId,
    });

    if (error) {
      throw error;
    }
  }

}

export async function createPlaceComment(
  placeId: string,
  userId: string,
  content: string,
  parentCommentId?: string | null,
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

  const { error } = await supabase.from('list_place_comments').insert(payload);

  if (error) {
    throw error;
  }

}

export async function updatePlaceComment(commentId: string, userId: string, content: string) {
  const normalizedContent = clampTextLength(content, COMMENT_MAX_LENGTH);
  assertNoObjectionableContent([{ label: tr.moderation.commentField, value: normalizedContent }]);
  const now = Date.now();
  const editCutoffIso = buildCommentEditCutoffIso(now);
  const { data: existingComment, error: existingCommentError } = await supabase
    .from('list_place_comments')
    .select('id, created_at')
    .eq('id', commentId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingCommentError) {
    throw existingCommentError;
  }

  if (!existingComment) {
    throw new Error(tr.cards.commentUpdateFailed);
  }

  if (!isCommentEditable(existingComment.created_at, now)) {
    throw new Error(tr.cards.commentEditExpired);
  }

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

export async function toggleLikePlaceComment(commentId: string, userId: string) {
  const { error: rpcError } = await supabase.rpc('toggle_list_place_comment_like', {
    target_comment_id: commentId,
  });

  if (!rpcError) {
    return;
  }

  if (!isMissingRpcFunctionError(rpcError)) {
    throw rpcError;
  }

  const { data: existingLike, error: selectError } = await supabase
    .from('list_place_comment_likes')
    .select('comment_id')
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existingLike) {
    const { error } = await supabase
      .from('list_place_comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase.from('list_place_comment_likes').insert({
      comment_id: commentId,
      user_id: userId,
    });

    if (error) {
      throw error;
    }
  }

}

export async function reportPlace(reporterUserId: string, placeId: string, reason: string) {
  const { error } = await supabase.from('list_place_reports').upsert(
    {
      list_place_id: placeId,
      reporter_user_id: reporterUserId,
      reason: reason.trim(),
      created_at: new Date().toISOString(),
    },
    { onConflict: 'list_place_id,reporter_user_id' },
  );

  if (error) {
    throw error;
  }
}

export async function reportPlaceComment(commentId: string, reporterUserId: string, reason: string) {
  const { error } = await supabase.from('list_place_comment_reports').insert({
    comment_id: commentId,
    reporter_user_id: reporterUserId,
    reason: reason.trim(),
  });

  if (error) {
    throw error;
  }
}
