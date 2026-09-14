import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PersistedMapScreenState } from '@/mobile/app/contracts/mapScreenState';
import { purgeAuthenticatedUserState } from '@/mobile/app/app-shell/auth/session/authUserStatePurge';
import {
  getPersistedListEditorDraft,
  savePersistedListEditorDraft,
} from '@/mobile/app/platform/storage/listEditorDraft';
import {
  getPersistedMapScreenState,
  savePersistedMapScreenState,
} from '@/mobile/app/platform/storage/mapScreenState';
import {
  getPersistedNavigationState,
  savePersistedNavigationState,
} from '@/mobile/app/platform/storage/navigationState';

vi.mock('@/mobile/app/data/query/queryClient', () => ({
  queryClient: {
    cancelQueries: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
  },
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: { removeAllChannels: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/mobile/app/platform/supabase/media', () => ({
  purgePrivateSignedReadUrlState: vi.fn(),
}));

vi.mock('@/mobile/app/data/cache/startupQueryCache', () => ({
  cancelAndDrainStartupQueryCacheWork: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/mobile/app/data/cache/screenIndexStorage', () => ({
  clearScreenIndexesForUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/mobile/app/data/cache/visibleDataSnapshotCache', () => ({
  clearPersistedVisibleDataSnapshot: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/mobile/app/data/cache/entityCacheStorage', () => ({
  clearEntityCacheForUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/mobile/app/data/outbox/outboxStorage', () => ({
  clearOutboxForUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: { error: vi.fn() },
}));

const nowMs = Date.parse('2026-09-14T10:00:00.000Z');

function buildMapState(note: string): PersistedMapScreenState {
  return {
    editorData: null,
    editorDraft: {
      address: '',
      atmosphere: [],
      bestTimes: [],
      features: [],
      media: [{ type: 'photo', url: `file:///documents/picked-media/${note}.jpg` }],
      menuUrl: '',
      name: note,
      newListCoverImage: '',
      newListDescription: '',
      newListName: '',
      newListPublic: false,
      notes: note,
      photos: [],
      priceMax: '',
      priceMin: '',
      rating: 0,
      selectedCategories: [],
      selectedLists: [],
      showNewListForm: false,
      step: 1,
      studentFriendly: false,
      title: '',
    },
    manualViewport: null,
    markerFilter: 'all',
    minimizedEditor: null,
    minimizedExistingPlace: null,
    selectedExistingPlace: null,
    selectedSearchResult: null,
    userViewport: null,
  };
}

describe('authenticated draft privacy purge', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(nowMs);
  });

  it('prevents user A logout/account-deletion state from leaking to user B', async () => {
    const listDraftA = {
      coverImage: 'file:///documents/picked-media/a-cover.jpg',
      description: 'A private description',
      isPublic: false,
      listId: 'same-list-id',
      name: 'A private name',
    };
    const listDraftB = {
      description: 'B private description',
      isPublic: false,
      listId: 'same-list-id',
      name: 'B private name',
    };
    const mapStateA = buildMapState('user-a-draft');
    const mapStateB = buildMapState('user-b-draft');
    const navigationStateA = {
      index: 0,
      routes: [{ name: 'ListDetail', params: { listId: 'list-a' } }],
    };
    const navigationStateB = {
      index: 0,
      routes: [{ name: 'ListDetail', params: { listId: 'list-b' } }],
    };

    await savePersistedListEditorDraft('user-a', listDraftA);
    await savePersistedListEditorDraft('user-b', listDraftB);
    await savePersistedMapScreenState('user-a', mapStateA);
    await savePersistedMapScreenState('user-b', mapStateB);
    await savePersistedNavigationState('user-a', navigationStateA);
    await savePersistedNavigationState('user-b', navigationStateB);

    await purgeAuthenticatedUserState('user-a');

    await expect(getPersistedListEditorDraft('user-a', 'same-list-id')).resolves.toBeNull();
    await expect(getPersistedMapScreenState('user-a')).resolves.toBeNull();
    await expect(getPersistedNavigationState('user-a')).resolves.toBeUndefined();
    await expect(getPersistedListEditorDraft('user-b', 'same-list-id')).resolves.toEqual(
      listDraftB,
    );
    await expect(getPersistedMapScreenState('user-b')).resolves.toEqual(mapStateB);
    await expect(getPersistedNavigationState('user-b')).resolves.toEqual(navigationStateB);
    expect(JSON.stringify(await getPersistedListEditorDraft('user-b', 'same-list-id'))).not.toContain(
      'A private',
    );
    expect(JSON.stringify(await getPersistedMapScreenState('user-b'))).not.toContain(
      'user-a-draft',
    );
  });
});
