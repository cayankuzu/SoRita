import AsyncStorage from '@react-native-async-storage/async-storage';
import type { InitialState } from '@react-navigation/native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PersistedMapScreenState } from '@/mobile/app/contracts/mapScreenState';
import {
  clearPersistedListEditorDraft,
  getPersistedListEditorDraft,
  listEditorDraftStorageInternals,
  savePersistedListEditorDraft,
} from '@/mobile/app/platform/storage/listEditorDraft';
import {
  clearPersistedMapScreenState,
  getPersistedMapScreenState,
  mapScreenStateStorageInternals,
  savePersistedMapScreenState,
} from '@/mobile/app/platform/storage/mapScreenState';
import {
  clearPersistedNavigationState,
  getPersistedNavigationState,
  navigationStateStorageInternals,
  savePersistedNavigationState,
} from '@/mobile/app/platform/storage/navigationState';

const nowMs = Date.parse('2026-09-14T10:00:00.000Z');

function buildMapState(latitude: number): PersistedMapScreenState {
  return {
    editorData: null,
    editorDraft: null,
    manualViewport: { latitude, longitude: 29 },
    markerFilter: 'all',
    minimizedEditor: null,
    minimizedExistingPlace: null,
    selectedExistingPlace: null,
    selectedSearchResult: null,
    userViewport: null,
  };
}

function buildNavigationState(listId: string): InitialState {
  return {
    index: 0,
    routes: [{ name: 'ListDetail', params: { listId } }],
  };
}

describe('owner-scoped persisted UI state', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(nowMs);
  });

  it('isolates list drafts by owner and retains another owner when one draft is cleared', async () => {
    const draftA = {
      coverImage: 'file:///documents/picked-media/user-a-cover.jpg',
      description: 'User A private draft',
      isPublic: false,
      listId: 'shared-list-id',
      name: 'A draft',
    };
    const draftB = {
      description: 'User B private draft',
      isPublic: true,
      listId: 'shared-list-id',
      name: 'B draft',
    };

    await savePersistedListEditorDraft('user-a', draftA);
    await expect(getPersistedListEditorDraft('user-b', draftA.listId)).resolves.toBeNull();
    await savePersistedListEditorDraft('user-b', draftB);
    await clearPersistedListEditorDraft('user-a', draftA.listId);

    await expect(getPersistedListEditorDraft('user-a', draftA.listId)).resolves.toBeNull();
    await expect(getPersistedListEditorDraft('user-b', draftB.listId)).resolves.toEqual(draftB);
  });

  it('expires list drafts and rejects ownerless v1 data instead of assigning it to a user', async () => {
    const draft = {
      description: 'Sensitive legacy draft',
      isPublic: false,
      listId: 'list-1',
      name: 'Legacy',
    };
    const legacyKey = `${listEditorDraftStorageInternals.legacyStoragePrefix}:${draft.listId}`;

    await AsyncStorage.setItem(legacyKey, JSON.stringify(draft));
    await expect(getPersistedListEditorDraft('user-b', draft.listId)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(legacyKey)).resolves.toBeNull();

    await savePersistedListEditorDraft('user-a', draft);
    vi.mocked(Date.now).mockReturnValue(nowMs + listEditorDraftStorageInternals.ttlMs + 1);
    await expect(getPersistedListEditorDraft('user-a', draft.listId)).resolves.toBeNull();
  });

  it('isolates, expires, and removes unbounded v1 map editor state', async () => {
    const stateA = buildMapState(41.01);
    const stateB = buildMapState(41.02);
    const legacyKey = `${mapScreenStateStorageInternals.legacyStoragePrefix}:user-a`;

    await AsyncStorage.setItem(legacyKey, JSON.stringify(stateA));
    await expect(getPersistedMapScreenState('user-a')).resolves.toBeNull();
    await expect(AsyncStorage.getItem(legacyKey)).resolves.toBeNull();

    await savePersistedMapScreenState('user-a', stateA);
    await savePersistedMapScreenState('user-b', stateB);
    await clearPersistedMapScreenState('user-a');
    await expect(getPersistedMapScreenState('user-a')).resolves.toBeNull();
    await expect(getPersistedMapScreenState('user-b')).resolves.toEqual(stateB);

    vi.mocked(Date.now).mockReturnValue(nowMs + mapScreenStateStorageInternals.ttlMs + 1);
    await expect(getPersistedMapScreenState('user-b')).resolves.toBeNull();
  });

  it('isolates navigation restore state by owner and enforces its retention bound', async () => {
    const stateA = buildNavigationState('list-a');
    const stateB = buildNavigationState('list-b');

    await AsyncStorage.setItem(
      navigationStateStorageInternals.legacyStorageKey,
      JSON.stringify(stateA),
    );
    await expect(getPersistedNavigationState('user-b')).resolves.toBeUndefined();
    await expect(
      AsyncStorage.getItem(navigationStateStorageInternals.legacyStorageKey),
    ).resolves.toBeNull();

    await savePersistedNavigationState('user-a', stateA);
    await savePersistedNavigationState('user-b', stateB);
    await clearPersistedNavigationState('user-a');
    await expect(getPersistedNavigationState('user-a')).resolves.toBeUndefined();
    await expect(getPersistedNavigationState('user-b')).resolves.toEqual(stateB);

    vi.mocked(Date.now).mockReturnValue(nowMs + navigationStateStorageInternals.ttlMs + 1);
    await expect(getPersistedNavigationState('user-b')).resolves.toBeUndefined();
  });
});
