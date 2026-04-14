import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const PENDING_SIGNUP_MEDIA_KEY = 'sorita_pending_signup_media';
const PENDING_SIGNUP_MEDIA_DIR = `${FileSystem.documentDirectory ?? ''}pending-signup-media/`;

type PendingSignupMediaMap = Record<
  string,
  {
    profilePhoto?: string;
    coverPhoto?: string;
  }
>;

async function readStore(): Promise<PendingSignupMediaMap> {
  const rawValue = await AsyncStorage.getItem(PENDING_SIGNUP_MEDIA_KEY);

  if (!rawValue) {
    return {};
  }

  try {
    return JSON.parse(rawValue) as PendingSignupMediaMap;
  } catch {
    return {};
  }
}

async function writeStore(value: PendingSignupMediaMap) {
  await AsyncStorage.setItem(PENDING_SIGNUP_MEDIA_KEY, JSON.stringify(value));
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getFileExtension(uri: string) {
  const cleanUri = uri.split('?')[0] || uri;
  const extension = cleanUri.split('.').pop()?.toLowerCase();
  return extension && extension.length <= 5 ? extension : 'jpg';
}

function buildPendingMediaPath(email: string, kind: 'profile' | 'cover', sourceUri: string) {
  const normalizedEmail = normalizeEmail(email).replace(/[^a-z0-9._-]/g, '_');
  const extension = getFileExtension(sourceUri);
  return `${PENDING_SIGNUP_MEDIA_DIR}${normalizedEmail}-${kind}.${extension}`;
}

async function ensurePendingMediaDirectory() {
  if (!PENDING_SIGNUP_MEDIA_DIR) {
    return;
  }

  const dirInfo = await FileSystem.getInfoAsync(PENDING_SIGNUP_MEDIA_DIR);

  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(PENDING_SIGNUP_MEDIA_DIR, { intermediates: true });
  }
}

async function persistPendingMedia(email: string, kind: 'profile' | 'cover', uri?: string) {
  if (!uri) {
    return undefined;
  }

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }

  await ensurePendingMediaDirectory();

  const targetPath = buildPendingMediaPath(email, kind, uri);

  try {
    const currentTargetInfo = await FileSystem.getInfoAsync(targetPath);

    if (currentTargetInfo.exists) {
      await FileSystem.deleteAsync(targetPath, { idempotent: true });
    }

    await FileSystem.copyAsync({
      from: uri,
      to: targetPath,
    });

    return targetPath;
  } catch {
    return uri;
  }
}

async function removePendingMediaFile(uri?: string) {
  if (!uri || uri.startsWith('http://') || uri.startsWith('https://')) {
    return;
  }

  if (!PENDING_SIGNUP_MEDIA_DIR || !uri.startsWith(PENDING_SIGNUP_MEDIA_DIR)) {
    return;
  }

  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}

export async function savePendingSignupMedia(params: {
  email: string;
  profilePhoto?: string;
  coverPhoto?: string;
}) {
  const { email, profilePhoto, coverPhoto } = params;
  const key = normalizeEmail(email);
  const currentStore = await readStore();
  const previousEntry = currentStore[key];

  if (!profilePhoto && !coverPhoto) {
    await removePendingMediaFile(previousEntry?.profilePhoto);
    await removePendingMediaFile(previousEntry?.coverPhoto);
    delete currentStore[key];
    await writeStore(currentStore);
    return;
  }

  const nextProfilePhoto = await persistPendingMedia(email, 'profile', profilePhoto);
  const nextCoverPhoto = await persistPendingMedia(email, 'cover', coverPhoto);

  if (previousEntry?.profilePhoto && previousEntry.profilePhoto !== nextProfilePhoto) {
    await removePendingMediaFile(previousEntry.profilePhoto);
  }

  if (previousEntry?.coverPhoto && previousEntry.coverPhoto !== nextCoverPhoto) {
    await removePendingMediaFile(previousEntry.coverPhoto);
  }

  currentStore[key] = {
    profilePhoto: nextProfilePhoto,
    coverPhoto: nextCoverPhoto,
  };

  await writeStore(currentStore);
}

export async function getPendingSignupMedia(email?: string | null) {
  if (!email) {
    return null;
  }

  const key = normalizeEmail(email);
  const currentStore = await readStore();
  return currentStore[key] || null;
}

export async function clearPendingSignupMedia(email?: string | null) {
  if (!email) {
    return;
  }

  const key = normalizeEmail(email);
  const currentStore = await readStore();

  if (!currentStore[key]) {
    return;
  }

  await removePendingMediaFile(currentStore[key]?.profilePhoto);
  await removePendingMediaFile(currentStore[key]?.coverPhoto);
  delete currentStore[key];
  await writeStore(currentStore);
}
