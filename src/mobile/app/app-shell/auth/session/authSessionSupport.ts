import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';

import type { User } from '@/mobile/app/data/contracts/entities';
import {
  clearNotificationCache,
  hydrateNotificationCache,
  refreshNotifications,
} from '@/mobile/app/data/repositories/notificationRepository';
import { storage } from '@/mobile/app/data/repositories/supabaseStorage';
import {
  clearPersistedAuthSession,
  getPersistedAuthSession,
  savePersistedAuthSession,
} from '@/mobile/app/platform/storage/authSession';
import {
  clearPendingSignupMedia,
  getPendingSignupMedia,
} from '@/mobile/app/platform/storage/pendingSignupMedia';
import { supabase } from '@/mobile/app/platform/supabase/client';

export type AuthErrorCode =
  | 'duplicate_email'
  | 'duplicate_username'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'signup_pending_confirmation'
  | 'unexpected';

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

export async function getActiveOrPersistedSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  const activeSession = data.session ?? null;

  if (!activeSession) {
    return restorePersistedSession();
  }

  await persistAuthSession(activeSession);
  return activeSession;
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

export async function syncPendingProfileMedia(authUser: SupabaseAuthUser) {
  const pendingMedia = await getPendingSignupMedia(authUser.email);

  if (!pendingMedia) {
    return;
  }

  const currentUser = storage.findUserById(authUser.id);

  if (!currentUser) {
    return;
  }

  const nextProfilePhoto = currentUser.profilePhoto || pendingMedia.profilePhoto;
  const nextCoverPhoto = currentUser.coverPhoto || pendingMedia.coverPhoto;

  if (nextProfilePhoto === currentUser.profilePhoto && nextCoverPhoto === currentUser.coverPhoto) {
    await clearPendingSignupMedia(authUser.email);
    return;
  }

  await storage.updateUser({
    ...currentUser,
    profilePhoto: nextProfilePhoto,
    coverPhoto: nextCoverPhoto,
  });
  await clearPendingSignupMedia(authUser.email);
}

export function resolveCurrentUser(authUserId: string | null): User | null {
  if (!authUserId) {
    storage.setCurrentUser(null);
    return null;
  }

  const nextUser = storage.findUserById(authUserId) || null;
  storage.setCurrentUser(nextUser);
  return nextUser;
}

export async function hydratePersistedAuthState(authUserId: string) {
  await Promise.all([
    storage.hydratePersistedCache(authUserId).catch(() => false),
    hydrateNotificationCache(authUserId).catch(() => false),
  ]);

  return resolveCurrentUser(authUserId);
}

export function clearCurrentUserState() {
  storage.setCurrentUser(null);
  clearNotificationCache();
}

export async function syncAuthenticatedUser(authUser: SupabaseAuthUser): Promise<User | null> {
  await ensureProfileExists(authUser);
  await storage.bootstrap(authUser.id);
  await syncPendingProfileMedia(authUser);

  const nextUser = resolveCurrentUser(authUser.id);
  void refreshNotifications(authUser.id).catch(() => undefined);

  return nextUser;
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
