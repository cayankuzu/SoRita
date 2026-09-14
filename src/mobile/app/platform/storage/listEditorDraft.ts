import AsyncStorage from '@react-native-async-storage/async-storage';

const LIST_EDITOR_DRAFT_STORAGE_VERSION = 2;
const LIST_EDITOR_DRAFT_TTL_MS = 1000 * 60 * 60 * 24;
const LIST_EDITOR_DRAFT_STORAGE_PREFIX = `sorita.list-editor.draft.v${LIST_EDITOR_DRAFT_STORAGE_VERSION}`;
const LEGACY_LIST_EDITOR_DRAFT_STORAGE_PREFIX = 'sorita.list-editor.draft.v1';

export type PersistedListEditorDraft = {
  coverImage?: string;
  description: string;
  isPublic: boolean;
  listId: string;
  name: string;
};

type PersistedListEditorDraftEnvelope = {
  draft: PersistedListEditorDraft;
  ownerUserId: string;
  savedAt: number;
  version: typeof LIST_EDITOR_DRAFT_STORAGE_VERSION;
};

function buildStorageKey(ownerUserId: string, listId: string) {
  return `${LIST_EDITOR_DRAFT_STORAGE_PREFIX}:${ownerUserId}:${listId}`;
}

function buildOwnerStoragePrefix(ownerUserId: string) {
  return `${LIST_EDITOR_DRAFT_STORAGE_PREFIX}:${ownerUserId}:`;
}

function buildLegacyStorageKey(listId: string) {
  return `${LEGACY_LIST_EDITOR_DRAFT_STORAGE_PREFIX}:${listId}`;
}

function isPersistedListEditorDraft(value: unknown): value is PersistedListEditorDraft {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PersistedListEditorDraft>;

  return (
    typeof candidate.listId === 'string' &&
    candidate.listId.length > 0 &&
    typeof candidate.name === 'string' &&
    typeof candidate.description === 'string' &&
    typeof candidate.isPublic === 'boolean' &&
    (candidate.coverImage == null || typeof candidate.coverImage === 'string')
  );
}

function isFresh(savedAt: number) {
  const ageMs = Date.now() - savedAt;
  return Number.isFinite(savedAt) && ageMs >= 0 && ageMs <= LIST_EDITOR_DRAFT_TTL_MS;
}

function isPersistedListEditorDraftEnvelope(
  value: unknown,
  ownerUserId: string,
  listId: string,
): value is PersistedListEditorDraftEnvelope {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PersistedListEditorDraftEnvelope>;

  return (
    candidate.version === LIST_EDITOR_DRAFT_STORAGE_VERSION &&
    candidate.ownerUserId === ownerUserId &&
    typeof candidate.savedAt === 'number' &&
    isFresh(candidate.savedAt) &&
    isPersistedListEditorDraft(candidate.draft) &&
    candidate.draft.listId === listId
  );
}

export async function getPersistedListEditorDraft(ownerUserId: string, listId: string) {
  const storageKey = buildStorageKey(ownerUserId, listId);

  // V1 had no owner identity. Claiming it for the currently signed-in user could expose
  // another person's draft on a shared device, so migration is intentionally destructive.
  await AsyncStorage.removeItem(buildLegacyStorageKey(listId));
  const rawValue = await AsyncStorage.getItem(storageKey);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!isPersistedListEditorDraftEnvelope(parsed, ownerUserId, listId)) {
      await AsyncStorage.removeItem(storageKey);
      return null;
    }

    return parsed.draft;
  } catch {
    await AsyncStorage.removeItem(storageKey);
    return null;
  }
}

export async function savePersistedListEditorDraft(
  ownerUserId: string,
  draft: PersistedListEditorDraft,
) {
  const payload: PersistedListEditorDraftEnvelope = {
    draft,
    ownerUserId,
    savedAt: Date.now(),
    version: LIST_EDITOR_DRAFT_STORAGE_VERSION,
  };

  await AsyncStorage.removeItem(buildLegacyStorageKey(draft.listId));
  await AsyncStorage.setItem(
    buildStorageKey(ownerUserId, draft.listId),
    JSON.stringify(payload),
  );
}

export async function clearPersistedListEditorDraft(ownerUserId: string, listId: string) {
  await AsyncStorage.multiRemove([
    buildStorageKey(ownerUserId, listId),
    buildLegacyStorageKey(listId),
  ]);
}

export async function clearPersistedListEditorDraftsForOwner(
  ownerUserId?: string | null,
) {
  const keys = await AsyncStorage.getAllKeys();
  const ownerPrefix = ownerUserId ? buildOwnerStoragePrefix(ownerUserId) : null;
  const legacyPrefix = `${LEGACY_LIST_EDITOR_DRAFT_STORAGE_PREFIX}:`;
  const matchingKeys = keys.filter(
    (key) => key.startsWith(legacyPrefix) || Boolean(ownerPrefix && key.startsWith(ownerPrefix)),
  );

  if (matchingKeys.length > 0) {
    await AsyncStorage.multiRemove(matchingKeys);
  }
}

export const listEditorDraftStorageInternals = {
  legacyStoragePrefix: LEGACY_LIST_EDITOR_DRAFT_STORAGE_PREFIX,
  storagePrefix: LIST_EDITOR_DRAFT_STORAGE_PREFIX,
  ttlMs: LIST_EDITOR_DRAFT_TTL_MS,
};
