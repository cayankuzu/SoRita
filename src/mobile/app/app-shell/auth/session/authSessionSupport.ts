import type { InfiniteData } from '@tanstack/react-query';
import {
  isAuthApiError,
  isAuthSessionMissingError,
  type Session,
  type User as SupabaseAuthUser,
} from '@supabase/supabase-js';

import type { User } from '@/mobile/app/data/contracts/entities';
import { queryClient } from '@/mobile/app/data/query/queryClient';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import {
  clearPersistedAuthSession,
  getPersistedAuthSession,
  getPersistedAuthUser,
  savePersistedAuthSession,
  savePersistedAuthUser,
} from '@/mobile/app/platform/storage/authSession';
import { supabase } from '@/mobile/app/platform/supabase/client';

export type AuthErrorCode =
  | 'duplicate_email'
  | 'duplicate_username'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'signup_pending_confirmation'
  | 'unexpected';

export class MissingAuthenticatedAccountError extends Error {
  constructor(message = 'Authenticated account no longer exists.') {
    super(message);
    this.name = 'MissingAuthenticatedAccountError';
  }
}

function createInfiniteQueryCachePage<T>(items: T[]): InfiniteData<T[], number> {
  return {
    pageParams: [0],
    pages: [items],
  };
}

async function loadUsersRepository() {
  return import('@/mobile/app/data/repositories/usersRepository');
}

async function loadVisibleDataRepository() {
  return import('@/mobile/app/data/repositories/visibleDataRepository');
}

async function loadNotificationRepository() {
  return import('@/mobile/app/data/repositories/notificationRepository');
}

async function loadPendingSignupMediaStorage() {
  return import('@/mobile/app/platform/storage/pendingSignupMedia');
}

export async function restorePersistedSession(): Promise<Session | null> {
  const persistedSession = await getPersistedAuthSession();

  if (!persistedSession) {
    return null;
  }

  const { data, error } = await supabase.auth.setSession(persistedSession);

  if (error || !data.session) {
    await clearPersistedAuthSession();
    return null;
  }

  await savePersistedAuthSession(data.session);
  return data.session;
}

export async function persistAuthSession(session: Session | null) {
  if (session) {
    await savePersistedAuthSession(session);
    return;
  }

  await clearPersistedAuthSession();
}

export async function getPersistedAuthUserSnapshot() {
  return getPersistedAuthUser<User>();
}

export async function persistResolvedAuthUser(user: User | null) {
  await savePersistedAuthUser(user);
}

export async function getActiveOrPersistedSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  const activeSession = data.session ?? null;

  if (!activeSession) {
    return restorePersistedSession();
  }

  await persistAuthSession(activeSession);
  return activeSession;
}

export async function getVerifiedAuthUser(session: Session | null): Promise<SupabaseAuthUser | null> {
  if (!session?.access_token) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(session.access_token);

  if (error) {
    throw error;
  }

  if (!user) {
    throw new MissingAuthenticatedAccountError();
  }

  return user;
}

export function isMissingAuthenticatedAccountError(error: unknown) {
  if (error instanceof MissingAuthenticatedAccountError) {
    return true;
  }

  if (isAuthSessionMissingError(error)) {
    return true;
  }

  return isAuthApiError(error) && error.status === 404;
}

export async function ensureProfileExists(authUser: SupabaseAuthUser) {
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', authUser.id)
    .maybeSingle();

  if (existingProfileError) {
    throw existingProfileError;
  }

  if (existingProfile) {
    return;
  }

  const metadata = authUser.user_metadata ?? {};

  const { error: insertError } = await supabase.from('profiles').insert({
    id: authUser.id,
    email: authUser.email ?? '',
    name: String(metadata.name ?? metadata.full_name ?? authUser.email?.split('@')[0] ?? 'Yeni Kullanici'),
    username: String(metadata.username ?? `user_${authUser.id.slice(0, 8)}`).toLowerCase(),
    is_public_account: true,
    bio: typeof metadata.bio === 'string' ? metadata.bio : null,
    interests: Array.isArray(metadata.interests) ? metadata.interests : null,
    profile_photo_url: typeof metadata.profile_photo_url === 'string' ? metadata.profile_photo_url : null,
    cover_photo_url: typeof metadata.cover_photo_url === 'string' ? metadata.cover_photo_url : null,
  });

  if (insertError) {
    throw insertError;
  }
}

export function createUserFromAuthUser(authUser: SupabaseAuthUser): User {
  const metadata = authUser.user_metadata ?? {};

  return {
    id: authUser.id,
    email: authUser.email ?? '',
    name: String(metadata.name ?? metadata.full_name ?? authUser.email?.split('@')[0] ?? 'Yeni Kullanici'),
    username: String(metadata.username ?? `user_${authUser.id.slice(0, 8)}`).toLowerCase(),
    isPublicAccount: true,
    bio: typeof metadata.bio === 'string' ? metadata.bio : undefined,
    interests: Array.isArray(metadata.interests) ? metadata.interests : undefined,
    profilePhoto: typeof metadata.profile_photo_url === 'string' ? metadata.profile_photo_url : undefined,
    coverPhoto: typeof metadata.cover_photo_url === 'string' ? metadata.cover_photo_url : undefined,
  };
}

export function resolveImmediateAuthUser(authUser: SupabaseAuthUser): User {
  return createUserFromAuthUser(authUser);
}

async function resolveSessionEmail(authUserId: string) {
  try {
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error || authUser?.id !== authUserId) {
      return null;
    }

    return authUser.email ?? null;
  } catch {
    return null;
  }
}

async function hydrateContextCurrentUserEmail<TContext extends {
  allUsers: User[];
  currentUser: User | null;
  users: User[];
}>(context: TContext, params: { fallbackEmail?: string | null; userId: string }) {
  if (!context.currentUser) {
    return context;
  }

  const resolvedEmail = params.fallbackEmail ?? (await resolveSessionEmail(params.userId));

  if (!resolvedEmail) {
    return context;
  }

  const hydrateUser = (user: User) =>
    user.id === params.userId
      ? {
          ...user,
          email: resolvedEmail,
        }
      : user;

  return {
    ...context,
    allUsers: context.allUsers.map(hydrateUser),
    currentUser: hydrateUser(context.currentUser),
    users: context.users.map(hydrateUser),
  };
}

export async function syncPendingProfileMedia(authUser: SupabaseAuthUser) {
  const [{ clearPendingSignupMedia, getPendingSignupMedia }, { fetchUserByIdIncludingBlocked, updateUser }] =
    await Promise.all([loadPendingSignupMediaStorage(), loadUsersRepository()]);
  const pendingMedia = await getPendingSignupMedia(authUser.email);

  if (!pendingMedia) {
    return;
  }

  const currentUser = await fetchUserByIdIncludingBlocked(authUser.id);

  if (!currentUser) {
    return;
  }

  const nextProfilePhoto = currentUser.profilePhoto || pendingMedia.profilePhoto;
  const nextCoverPhoto = currentUser.coverPhoto || pendingMedia.coverPhoto;

  if (nextProfilePhoto === currentUser.profilePhoto && nextCoverPhoto === currentUser.coverPhoto) {
    await clearPendingSignupMedia(authUser.email);
    return;
  }

  await updateUser({
    ...currentUser,
    profilePhoto: nextProfilePhoto,
    coverPhoto: nextCoverPhoto,
  });
  await clearPendingSignupMedia(authUser.email);
}

export async function resolveCurrentUser(authUserId: string | null): Promise<User | null> {
  if (!authUserId) {
    return null;
  }

  const { fetchVisibleDataContext } = await loadVisibleDataRepository();
  const context = await hydrateContextCurrentUserEmail(
    await fetchVisibleDataContext(authUserId),
    { userId: authUserId },
  );
  queryClient.setQueryData(queryKeys.visibleData.context(authUserId), context);
  queryClient.setQueryData(queryKeys.visibleData.snapshot(authUserId), { ...context, lists: [] });
  return context.currentUser;
}

export async function hydratePersistedAuthState(authUserId: string) {
  const [{ fetchVisibleDataContext }, { refreshNotifications }] = await Promise.all([
    loadVisibleDataRepository(),
    loadNotificationRepository(),
  ]);
  const context = await hydrateContextCurrentUserEmail(
    await fetchVisibleDataContext(authUserId),
    { userId: authUserId },
  );
  queryClient.setQueryData(queryKeys.visibleData.context(authUserId), context);
  queryClient.setQueryData(queryKeys.visibleData.snapshot(authUserId), { ...context, lists: [] });
  await savePersistedAuthUser(context.currentUser);
  void refreshNotifications(authUserId)
    .then((items) => {
      queryClient.setQueryData(
        queryKeys.notifications.list(authUserId),
        createInfiniteQueryCachePage(items),
      );
    })
    .catch(() => undefined);

  return context.currentUser;
}

export function clearCurrentUserState() {
  queryClient.clear();
}

export async function syncAuthenticatedUser(authUser: SupabaseAuthUser): Promise<User | null> {
  await ensureProfileExists(authUser);
  await syncPendingProfileMedia(authUser);

  const [{ fetchVisibleDataContext }, { refreshNotifications }] = await Promise.all([
    loadVisibleDataRepository(),
    loadNotificationRepository(),
  ]);
  const context = await hydrateContextCurrentUserEmail(
    await fetchVisibleDataContext(authUser.id),
    {
      fallbackEmail: authUser.email ?? null,
      userId: authUser.id,
    },
  );

  if (!context.currentUser) {
    throw new MissingAuthenticatedAccountError();
  }

  queryClient.setQueryData(queryKeys.visibleData.context(authUser.id), context);
  queryClient.setQueryData(queryKeys.visibleData.snapshot(authUser.id), { ...context, lists: [] });
  await savePersistedAuthUser(context.currentUser);
  void refreshNotifications(authUser.id)
    .then((items) => {
      queryClient.setQueryData(
        queryKeys.notifications.list(authUser.id),
        createInfiniteQueryCachePage(items),
      );
    })
    .catch(() => undefined);

  return context.currentUser;
}

export function getAuthErrorCode(message: string | undefined): AuthErrorCode {
  const normalized = message?.toLowerCase() ?? '';

  if (normalized.includes('email not confirmed')) {
    return 'email_not_confirmed';
  }

  if (normalized.includes('invalid login credentials')) {
    return 'invalid_credentials';
  }

  if (
    normalized.includes('user already registered') ||
    normalized.includes('already registered') ||
    normalized.includes('already exists') ||
    normalized.includes('email_address_not_authorized') ||
    normalized.includes('profiles_email_key') ||
    normalized.includes('users_email_key')
  ) {
    return 'duplicate_email';
  }

  if (
    normalized.includes('profiles_username_key') ||
    normalized.includes('username already') ||
    (normalized.includes('username') && normalized.includes('duplicate'))
  ) {
    return 'duplicate_username';
  }

  return 'unexpected';
}
