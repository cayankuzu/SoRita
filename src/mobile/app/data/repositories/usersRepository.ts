import type { User } from '@/mobile/app/data/contracts/entities';
import { onlineManager } from '@tanstack/react-query';
import { enqueueDurableOutboxEntry } from '@/mobile/app/data/outbox/enqueueDurableOutboxEntry';
import { deleteStorageAssetsWithRetry } from '@/mobile/app/data/outbox/mediaCleanupOutbox';
import { submitModerationReport } from '@/mobile/app/data/repositories/moderationReports';
import {
  fetchBlockState,
  fetchUserByIdIncludingBlocked,
} from '@/mobile/app/data/repositories/visibleDataRepository';
import { env } from '@/mobile/app/platform/config/env';
import { getFunctionUrl } from '@/mobile/app/platform/api/edgeFunctions';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { createSignedEdgeHeaders } from '@/mobile/app/platform/security/requestSigning';
import { uploadImageAsset } from '@/mobile/app/platform/supabase/media';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { assertNoObjectionableContent } from '@/mobile/app/shared/utils/contentModeration';
import { uniqueStrings } from '@/mobile/app/shared/utils/format';
import {
  normalizeUserBioInput,
  normalizeUserNameInput,
  normalizeUsernameInput,
} from '@/mobile/app/shared/validation/contentLimits';

export type FollowStateResult = 'following' | 'requested' | 'unfollowed';

function isRemoteAssetUri(uri?: string) {
  return Boolean(uri && /^https?:\/\//i.test(uri));
}

async function getTargetIsPublic(targetUserId: string) {
  const { data, error } = await supabase
    .from('public_profile_summaries')
    .select('is_public_account')
    .eq('id', targetUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.is_public_account !== false;
}

async function relationExists(table: 'user_follows' | 'follow_requests', currentUserId: string, targetUserId: string) {
  const query = table === 'user_follows'
    ? supabase
        .from(table)
        .select('follower_id')
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId)
        .maybeSingle()
    : supabase
        .from(table)
        .select('id')
        .eq('requester_id', currentUserId)
        .eq('target_user_id', targetUserId)
        .eq('status', 'pending')
        .maybeSingle();

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function extractResponseErrorMessage(response: Response) {
  try {
    const payload = await response.json();

    if (payload && typeof payload === 'object') {
      if ('error' in payload && typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error;
      }

      if ('message' in payload && typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message;
      }
    }
  } catch {
    const text = await response.text().catch(() => '');

    if (text.trim()) {
      return text;
    }
  }

  return tr.system.requestFailed(response.status);
}

export async function fetchVisibleUserById(userId: string) {
  return fetchUserByIdIncludingBlocked(userId);
}

export { fetchUserByIdIncludingBlocked };

export async function updateUser(user: User) {
  const normalizedName = normalizeUserNameInput(user.name).trim();
  const normalizedUsername = normalizeUsernameInput(user.username).trim();
  const normalizedBio = normalizeUserBioInput(user.bio).trim();

  assertNoObjectionableContent([
    { label: tr.moderation.nameField, value: normalizedName },
    { label: tr.auth.register.usernameLabel, value: normalizedUsername },
    { label: tr.auth.register.bioLabel, value: normalizedBio },
  ]);

  const shouldLoadPreviousUser =
    !isRemoteAssetUri(user.profilePhoto) || !isRemoteAssetUri(user.coverPhoto);
  const previousUserPromise = shouldLoadPreviousUser
    ? fetchUserByIdIncludingBlocked(user.id)
    : Promise.resolve(null);
  const profilePhotoPromise = uploadImageAsset({
    bucket: 'profile-media',
    userId: user.id,
    uri: user.profilePhoto,
    prefix: 'profile',
  });
  const coverPhotoPromise = uploadImageAsset({
    bucket: 'profile-media',
    userId: user.id,
    uri: user.coverPhoto,
    prefix: 'cover',
  });
  const [previousUser, profilePhoto, coverPhoto] = await Promise.all([
    previousUserPromise,
    profilePhotoPromise,
    coverPhotoPromise,
  ]);

  const { error } = await supabase
    .from('profiles')
    .update({
      name: normalizedName,
      username: normalizedUsername,
      is_public_account: user.isPublicAccount ?? true,
      bio: normalizedBio || null,
      interests: user.interests?.length ? uniqueStrings(user.interests) : null,
      profile_photo_url: profilePhoto || null,
      cover_photo_url: coverPhoto || null,
    })
    .eq('id', user.id);

  if (error) {
    throw error;
  }

  void Promise.resolve(
    deleteStorageAssetsWithRetry({
      bucket: 'profile-media',
      urls: [
        previousUser?.profilePhoto && previousUser.profilePhoto !== profilePhoto ? previousUser.profilePhoto : undefined,
        previousUser?.coverPhoto && previousUser.coverPhoto !== coverPhoto ? previousUser.coverPhoto : undefined,
      ],
      userId: user.id,
    }),
  );

  return {
    ...user,
    bio: normalizedBio || undefined,
    coverPhoto,
    interests: user.interests?.length ? uniqueStrings(user.interests) : undefined,
    isPublicAccount: user.isPublicAccount ?? true,
    name: normalizedName,
    profilePhoto,
    username: normalizedUsername,
  };
}

export async function followUser(currentUserId: string, targetUserId: string): Promise<FollowStateResult> {
  const blockState = await fetchBlockState(currentUserId, targetUserId);

  if (blockState.blockedByCurrent) {
    throw new Error(tr.profile.userActions.blockedFollowAttempt);
  }

  if (blockState.blockedByTarget) {
    throw new Error(tr.profile.userActions.cannotInteract);
  }

  if (await relationExists('user_follows', currentUserId, targetUserId)) {
    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('following_id', targetUserId);

    if (error) {
      throw error;
    }

    return 'unfollowed';
  }

  if (await relationExists('follow_requests', currentUserId, targetUserId)) {
    return 'requested';
  }

  if (!(await getTargetIsPublic(targetUserId))) {
    const { error } = await supabase.from('follow_requests').insert({
      requester_id: currentUserId,
      target_user_id: targetUserId,
      status: 'pending',
    });

    if (error && error.code !== '23505') {
      throw error;
    }

    return 'requested';
  }

  const { error } = await supabase.from('user_follows').insert({
    follower_id: currentUserId,
    following_id: targetUserId,
  });

  if (error) {
    throw error;
  }

  return 'following';
}

export async function setFollowState(
  currentUserId: string,
  targetUserId: string,
  desiredState: FollowStateResult,
): Promise<FollowStateResult> {
  if (desiredState === 'unfollowed') {
    const [followResult, requestResult] = await Promise.all([
      supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId),
      supabase
        .from('follow_requests')
        .delete()
        .eq('requester_id', currentUserId)
        .eq('target_user_id', targetUserId),
    ]);

    if (followResult.error) {
      throw followResult.error;
    }
    if (requestResult.error) {
      throw requestResult.error;
    }
    return 'unfollowed';
  }

  const blockState = await fetchBlockState(currentUserId, targetUserId);
  if (blockState.blockedByCurrent) {
    throw new Error(tr.profile.userActions.blockedFollowAttempt);
  }
  if (blockState.blockedByTarget) {
    throw new Error(tr.profile.userActions.cannotInteract);
  }

  const targetIsPublic = await getTargetIsPublic(targetUserId);
  const resolvedState = desiredState === 'following' && targetIsPublic
    ? 'following'
    : 'requested';
  const removeTable = resolvedState === 'following' ? 'follow_requests' : 'user_follows';
  const removeResult = resolvedState === 'following'
    ? await supabase
        .from(removeTable)
        .delete()
        .eq('requester_id', currentUserId)
        .eq('target_user_id', targetUserId)
    : await supabase
        .from(removeTable)
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId);

  if (removeResult.error) {
    throw removeResult.error;
  }

  const upsertResult = resolvedState === 'following'
    ? await supabase.from('user_follows').upsert(
        { follower_id: currentUserId, following_id: targetUserId },
        { onConflict: 'follower_id,following_id', ignoreDuplicates: true },
      )
    : await supabase.from('follow_requests').upsert(
        {
          requester_id: currentUserId,
          status: 'pending',
          target_user_id: targetUserId,
        },
        { onConflict: 'requester_id,target_user_id', ignoreDuplicates: true },
      );

  if (upsertResult.error) {
    throw upsertResult.error;
  }

  return resolvedState;
}

export async function blockUser(currentUserId: string, targetUserId: string) {
  if (currentUserId === targetUserId) {
    throw new Error(tr.profile.userActions.cannotBlockSelf);
  }

  if (!onlineManager.isOnline()) {
    await enqueueDurableOutboxEntry({
      idempotencyKey: `user-block-state:${currentUserId}:${targetUserId}`,
      kind: 'user-block-state',
      payloadRef: { blocked: true, targetUserId },
      userId: currentUserId,
    });
    return;
  }

  const { error } = await supabase.from('user_blocks').upsert(
    {
      blocker_user_id: currentUserId,
      blocked_user_id: targetUserId,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'blocker_user_id,blocked_user_id' },
  );

  if (error) {
    throw error;
  }

  const { error: moderationSignalError } = await supabase.from('user_reports').upsert(
    {
      reporter_user_id: currentUserId,
      target_user_id: targetUserId,
      reason: 'blocked_user_safety_signal',
      created_at: new Date().toISOString(),
    },
    {
      onConflict: 'reporter_user_id,target_user_id',
      ignoreDuplicates: true,
    },
  );

  if (moderationSignalError) {
    logger.warn('users', 'Failed to persist moderation signal for blocked user', moderationSignalError);
  }
}

export async function unblockUser(currentUserId: string, targetUserId: string) {
  if (!onlineManager.isOnline()) {
    await enqueueDurableOutboxEntry({
      idempotencyKey: `user-block-state:${currentUserId}:${targetUserId}`,
      kind: 'user-block-state',
      payloadRef: { blocked: false, targetUserId },
      userId: currentUserId,
    });
    return;
  }

  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_user_id', currentUserId)
    .eq('blocked_user_id', targetUserId);

  if (error) {
    throw error;
  }

}

export async function reportUser(
  reporterUserId: string,
  targetUserId: string,
  reason: string,
  details?: string,
) {
  if (reporterUserId === targetUserId) {
    throw new Error(tr.profile.userActions.cannotReportSelf);
  }

  await submitModerationReport({
    targetType: 'user',
    reporterUserId,
    targetUserId,
    reason,
    details,
  });
}

export async function deleteCurrentUser() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session?.access_token) {
    throw new Error(tr.settings.sessionMissing);
  }

  const bodyText = JSON.stringify({});
  const signedHeaders = await createSignedEdgeHeaders({
    accessToken: session.access_token,
    bodyText,
    functionName: env.supabaseDeleteUserFunctionName,
    method: 'POST',
  });
  const requestInit = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: env.supabasePublishableKey,
      'Content-Type': 'application/json',
      ...signedHeaders,
    },
    body: bodyText,
  } satisfies RequestInit;
  const response = await fetch(getFunctionUrl(env.supabaseDeleteUserFunctionName), requestInit);

  if (!response.ok) {
    throw new Error(await extractResponseErrorMessage(response));
  }

}
