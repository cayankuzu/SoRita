import AsyncStorage from '@react-native-async-storage/async-storage';

const LIST_EDITOR_DRAFT_STORAGE_PREFIX = 'sorita.list-editor.draft.v1';

export type PersistedListEditorDraft = {
  coverImage?: string;
  description: string;
  isPublic: boolean;
  listId: string;
  name: string;
};

function buildStorageKey(listId: string) {
  return `${LIST_EDITOR_DRAFT_STORAGE_PREFIX}:${listId}`;
}

function isPersistedListEditorDraft(value: unknown): value is PersistedListEditorDraft {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as PersistedListEditorDraft).listId === 'string' &&
      typeof (value as PersistedListEditorDraft).name === 'string' &&
      typeof (value as PersistedListEditorDraft).description === 'string' &&
      typeof (value as PersistedListEditorDraft).isPublic === 'boolean',
  );
}

export async function getPersistedListEditorDraft(listId: string) {
  const rawValue = await AsyncStorage.getItem(buildStorageKey(listId));

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!isPersistedListEditorDraft(parsed)) {
      await clearPersistedListEditorDraft(listId);
      return null;
    }

    return parsed;
  } catch {
    await clearPersistedListEditorDraft(listId);
    return null;
  }
}

export async function savePersistedListEditorDraft(draft: PersistedListEditorDraft) {
  await AsyncStorage.setItem(buildStorageKey(draft.listId), JSON.stringify(draft));
}

export async function clearPersistedListEditorDraft(listId: string) {
  await AsyncStorage.removeItem(buildStorageKey(listId));
}
