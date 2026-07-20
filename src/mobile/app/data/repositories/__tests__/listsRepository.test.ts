import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();
const getSessionMock = vi.fn();
const rpcMock = vi.fn();
const uploadImageAssetMock = vi.fn();
const uploadPlaceMediaAssetMock = vi.fn();
const deleteStorageAssetsByUrlsMock = vi.fn();
const fetchVisibleDataContextMock = vi.fn();
const fetchVisibleListsPageMock = vi.fn();
const generateVideoThumbnailUriMock = vi.fn();
const submitModerationReportMock = vi.fn();

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
    from: fromMock,
    rpc: rpcMock,
  },
}));

vi.mock('@/mobile/app/platform/supabase/media', () => ({
  deleteStorageAssetsByUrls: deleteStorageAssetsByUrlsMock,
  uploadImageAsset: uploadImageAssetMock,
  uploadPlaceMediaAsset: uploadPlaceMediaAssetMock,
}));

vi.mock('@/mobile/app/platform/media/videoThumbnails', () => ({
  generateVideoThumbnailUri: generateVideoThumbnailUriMock,
}));

vi.mock('@/mobile/app/data/repositories/visibleDataRepository', () => ({
  fetchVisibleDataContext: fetchVisibleDataContextMock,
  fetchVisibleListsPage: fetchVisibleListsPageMock,
}));

vi.mock('@/mobile/app/data/repositories/moderationReports', () => ({
  submitModerationReport: submitModerationReportMock,
}));

function createDeleteInChain(result: { error: unknown }) {
  const chain: Record<string, unknown> = {};

  Object.assign(chain, {
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  });

  return chain as {
    delete: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    then: Promise<typeof result>['then'];
  };
}

describe('listsRepository', () => {
  beforeEach(() => {
    fromMock.mockReset();
    getSessionMock.mockReset();
    rpcMock.mockReset();
    uploadImageAssetMock.mockReset();
    uploadPlaceMediaAssetMock.mockReset();
    deleteStorageAssetsByUrlsMock.mockReset();
    fetchVisibleDataContextMock.mockReset();
    fetchVisibleListsPageMock.mockReset();
    generateVideoThumbnailUriMock.mockReset();
    submitModerationReportMock.mockReset();
    deleteStorageAssetsByUrlsMock.mockResolvedValue(undefined);
    rpcMock.mockResolvedValue({ error: null });
    generateVideoThumbnailUriMock.mockResolvedValue(undefined);
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-1',
          },
        },
      },
      error: null,
    });
  });

  it('creates a list with uploaded cover media and place photos', async () => {
    const { createList } = await import('@/mobile/app/data/repositories/listsRepository');
    const listsInsertMock = vi.fn().mockResolvedValue({ error: null });

    uploadImageAssetMock.mockResolvedValueOnce('https://cdn.example/list-cover.jpg');
    uploadPlaceMediaAssetMock
      .mockResolvedValueOnce('sorita-storage://place-media-private/user-1/list-1/place-1/0.jpg')
      .mockResolvedValueOnce('sorita-storage://place-media-private/user-1/list-1/place-1/1.jpg');
    fromMock.mockReturnValueOnce({ insert: listsInsertMock });

    await createList({
      id: 'list-1',
      userId: 'user-1',
      name: 'Saved spots',
      description: 'My shortlist',
      emoji: '*',
      coverImage: 'file:///tmp/cover.jpg',
      places: [
        {
          id: 'place-1',
          addedAt: '2026-04-16T10:00:00.000Z',
          address: '',
          atmosphere: ['quiet', 'quiet'],
          bestTimes: ['morning', 'morning'],
          categories: ['coffee', 'coffee'],
          lat: 10,
          lng: 20,
          menuUrl: 'menu.example.com/cafe',
          name: 'Cafe',
          photos: ['file:///tmp/one.jpg', 'file:///tmp/two.jpg'],
          specialFeatures: ['wifi', 'wifi'],
        },
      ],
      isPublic: true,
      likes: 0,
      likedBy: [],
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:00:00.000Z',
    });

    expect(uploadImageAssetMock).toHaveBeenNthCalledWith(1, {
      bucket: 'place-media',
      prefix: 'list-1/cover',
      uri: 'file:///tmp/cover.jpg',
      userId: 'user-1',
    });
    expect(rpcMock).toHaveBeenCalledWith('upsert_list_place_with_media', {
      p_media: [
        expect.objectContaining({
          type: 'photo',
          url: 'sorita-storage://place-media-private/user-1/list-1/place-1/0.jpg',
        }),
        expect.objectContaining({
          type: 'photo',
          url: 'sorita-storage://place-media-private/user-1/list-1/place-1/1.jpg',
        }),
      ],
      p_place: expect.objectContaining({
        atmosphere: ['quiet'],
        best_times: ['morning'],
        categories: ['coffee'],
        created_by: 'user-1',
        menu_url: 'https://menu.example.com/cafe',
        special_features: ['wifi'],
      }),
    });
  });

  it('uploads a video and its thumbnail in parallel', async () => {
    const { createList } = await import('@/mobile/app/data/repositories/listsRepository');
    const resolvers: Array<(value: string) => void> = [];
    uploadImageAssetMock.mockResolvedValue(undefined);
    uploadPlaceMediaAssetMock.mockImplementation(() => new Promise<string>((resolve) => {
      resolvers.push(resolve);
    }));
    fromMock.mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({ error: null }) });

    const save = createList({
      id: 'list-video',
      userId: 'user-1',
      name: 'Videos',
      places: [{
        id: 'place-video',
        name: 'Cinema',
        lat: 10,
        lng: 20,
        media: [{
          durationMs: 60_000,
          thumbnailUrl: 'file:///tmp/video-thumb.jpg',
          type: 'video',
          url: 'file:///tmp/video.mp4',
        }],
        addedAt: '2026-04-16T10:00:00.000Z',
      }],
      isPublic: true,
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:00:00.000Z',
    });

    await vi.waitFor(() => expect(uploadPlaceMediaAssetMock).toHaveBeenCalledTimes(2));
    resolvers[0]?.('sorita-storage://place-media-private/user-1/video.mp4');
    resolvers[1]?.('sorita-storage://place-media-private/user-1/video-thumb.jpg');
    await expect(save).resolves.toBeUndefined();
  });

  it('encodes multiline list and place text before persistence', async () => {
    const { createList } = await import('@/mobile/app/data/repositories/listsRepository');
    const listsInsertMock = vi.fn().mockResolvedValue({ error: null });

    uploadImageAssetMock.mockResolvedValue(undefined);
    fromMock.mockReturnValueOnce({ insert: listsInsertMock });

    await createList({
      id: 'list-multiline',
      userId: 'user-1',
      name: 'Saved spots',
      description: 'Kat 1\nKat 2',
      places: [
        {
          id: 'place-ml',
          addedAt: '2026-04-16T10:00:00.000Z',
          lat: 1,
          lng: 2,
          name: 'Cafe',
          title: 'A\nV\nB',
          notes: 'X\nF\nF',
          photos: [],
        },
      ],
      isPublic: true,
      likes: 0,
      likedBy: [],
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:00:00.000Z',
    });

    expect(listsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Kat 1\u2028Kat 2',
      }),
    );
    expect(rpcMock).toHaveBeenCalledWith('upsert_list_place_with_media', {
      p_media: [],
      p_place: expect.objectContaining({
        title: 'A\u2028V\u2028B',
        notes: 'X\u2028F\u2028F',
      }),
    });
  });

  it('throws when list persistence fails', async () => {
    const { createList } = await import('@/mobile/app/data/repositories/listsRepository');
    const expectedError = new Error('lists insert failed');

    uploadImageAssetMock.mockResolvedValue(undefined);
    fromMock.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: expectedError }),
    });

    await expect(createList({
      id: 'list-1',
      userId: 'user-1',
      name: 'Saved spots',
      places: [],
      isPublic: true,
      likes: 0,
      likedBy: [],
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:00:00.000Z',
    })).rejects.toThrow('lists insert failed');
  });

  it('rejects objectionable list and place text before persistence', async () => {
    const { createList } = await import('@/mobile/app/data/repositories/listsRepository');

    await expect(createList({
      id: 'list-1',
      userId: 'user-1',
      name: 'porno rota',
      places: [],
      isPublic: true,
      likes: 0,
      likedBy: [],
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:00:00.000Z',
    })).rejects.toThrow('Liste adı topluluk kurallarına aykırı ifade içeriyor.');

    uploadImageAssetMock.mockResolvedValue(undefined);
    fromMock.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    await expect(createList({
      id: 'list-2',
      userId: 'user-1',
      name: 'Hafta sonu',
      places: [
        {
          id: 'place-1',
          addedAt: '2026-04-16T10:00:00.000Z',
          lat: 1,
          lng: 2,
          name: 'amk kafe',
          photos: [],
        },
      ],
      isPublic: true,
      likes: 0,
      likedBy: [],
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:00:00.000Z',
    })).rejects.toThrow('Mekân adı topluluk kurallarına aykırı ifade içeriyor.');

    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(uploadImageAssetMock).toHaveBeenCalledTimes(1);
  });

  it('throws when place persistence fails', async () => {
    const { createList } = await import('@/mobile/app/data/repositories/listsRepository');
    const listsInsertMock = vi.fn().mockResolvedValue({ error: null });

    uploadImageAssetMock.mockResolvedValue(undefined);
    rpcMock.mockResolvedValueOnce({ error: new Error('place upsert failed') });
    fromMock.mockReturnValueOnce({ insert: listsInsertMock });

    await expect(createList({
      id: 'list-1',
      userId: 'user-1',
      name: 'Saved spots',
      places: [
        {
          id: 'place-1',
          addedAt: '2026-04-16T10:00:00.000Z',
          lat: 1,
          lng: 2,
          name: 'Cafe',
          photos: [],
        },
      ],
      isPublic: true,
      likes: 0,
      likedBy: [],
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:00:00.000Z',
    })).rejects.toThrow('place upsert failed');
  });

  it('uses the authenticated session owner when creating a list', async () => {
    const { createList } = await import('@/mobile/app/data/repositories/listsRepository');
    const listsInsertMock = vi.fn().mockResolvedValue({ error: null });

    getSessionMock.mockResolvedValueOnce({
      data: {
        session: {
          user: {
            id: 'auth-user',
          },
        },
      },
      error: null,
    });
    uploadImageAssetMock.mockResolvedValue(undefined);
    fromMock.mockReturnValueOnce({ insert: listsInsertMock });

    await createList({
      id: 'list-auth',
      userId: '',
      name: 'Saved spots',
      places: [],
      isPublic: true,
      likes: 0,
      likedBy: [],
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:00:00.000Z',
    });

    expect(uploadImageAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'auth-user',
      }),
    );
    expect(listsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_id: 'auth-user',
      }),
    );
  });

  it('persists empty array fields and a fallback name when optional place details are omitted', async () => {
    const { createList } = await import('@/mobile/app/data/repositories/listsRepository');
    const listsInsertMock = vi.fn().mockResolvedValue({ error: null });

    uploadImageAssetMock.mockResolvedValue(undefined);
    fromMock.mockReturnValueOnce({ insert: listsInsertMock });

    await createList({
      id: 'list-1',
      userId: 'user-1',
      name: 'Kayit Testi',
      places: [
        {
          id: 'place-1',
          addedAt: '2026-04-16T10:00:00.000Z',
          lat: 1,
          lng: 2,
          name: '',
          photos: [],
        },
      ],
      isPublic: true,
      likes: 0,
      likedBy: [],
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:00:00.000Z',
    });

    expect(rpcMock).toHaveBeenCalledWith('upsert_list_place_with_media', {
      p_media: [],
      p_place: expect.objectContaining({
        name: 'Kaydedilen Mekân',
        categories: [],
        best_times: [],
        atmosphere: [],
        special_features: [],
      }),
    });
  });

  it('throws when atomic place-media persistence fails', async () => {
    const { createList } = await import('@/mobile/app/data/repositories/listsRepository');
    const listsInsertMock = vi.fn().mockResolvedValue({ error: null });

    uploadImageAssetMock.mockResolvedValue(undefined);
    rpcMock.mockResolvedValueOnce({ error: new Error('atomic place media failed') });
    fromMock.mockReturnValueOnce({ insert: listsInsertMock });

    await expect(createList({
      id: 'list-1',
      userId: 'user-1',
      name: 'Saved spots',
      places: [
        {
          id: 'place-1',
          addedAt: '2026-04-16T10:00:00.000Z',
          lat: 1,
          lng: 2,
          name: 'Cafe',
          photos: [],
        },
      ],
      isPublic: true,
      likes: 0,
      likedBy: [],
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:00:00.000Z',
    })).rejects.toThrow('atomic place media failed');
  });

  it('cleans up uploaded media when atomic place-media persistence fails', async () => {
    const { createList } = await import('@/mobile/app/data/repositories/listsRepository');
    const listsInsertMock = vi.fn().mockResolvedValue({ error: null });

    uploadImageAssetMock.mockResolvedValueOnce(undefined);
    uploadPlaceMediaAssetMock.mockResolvedValueOnce(
      'sorita-storage://place-media-private/user-1/list-1/place-1/0.jpg',
    );
    rpcMock.mockResolvedValueOnce({ error: new Error('atomic media insert failed') });
    fromMock.mockReturnValueOnce({ insert: listsInsertMock });

    await expect(createList({
      id: 'list-1',
      userId: 'user-1',
      name: 'Saved spots',
      places: [
        {
          id: 'place-1',
          addedAt: '2026-04-16T10:00:00.000Z',
          lat: 1,
          lng: 2,
          name: 'Cafe',
          photos: ['file:///tmp/one.jpg'],
        },
      ],
      isPublic: true,
      likes: 0,
      likedBy: [],
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:00:00.000Z',
    })).rejects.toThrow('atomic media insert failed');
    expect(deleteStorageAssetsByUrlsMock).toHaveBeenCalledWith({
      bucket: 'place-media',
      urls: ['sorita-storage://place-media-private/user-1/list-1/place-1/0.jpg'],
    });
  });

  it('updates a list, removes deleted places, and deletes stale cover media', async () => {
    const { updateList } = await import('@/mobile/app/data/repositories/listsRepository');
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const deletePlacesChain = createDeleteInChain({ error: null });

    fetchVisibleDataContextMock.mockResolvedValue({ allUsers: [], blockRows: [] });
    fetchVisibleListsPageMock.mockResolvedValue([
      {
        id: 'list-1',
        userId: 'user-1',
        name: 'Saved spots',
        coverImage: 'https://cdn.example/old-cover.jpg',
        places: [
          {
            id: 'place-old',
            name: 'Old cafe',
            lat: 1,
            lng: 1,
            photos: ['https://cdn.example/old-place.jpg'],
            media: [{ type: 'photo', url: 'https://cdn.example/old-place.jpg' }],
            addedAt: '2026-04-16T10:00:00.000Z',
          },
        ],
        isPublic: true,
        createdAt: '2026-04-16T10:00:00.000Z',
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
    ]);
    uploadImageAssetMock.mockResolvedValue('https://cdn.example/new-cover.jpg');
    fromMock
      .mockReturnValueOnce({ upsert: upsertMock })
      .mockReturnValueOnce(deletePlacesChain);

    await updateList({
      id: 'list-1',
      userId: 'user-1',
      name: 'Saved spots',
      coverImage: 'file:///tmp/new-cover.jpg',
      places: [],
      isPublic: true,
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:00:00.000Z',
    });

    expect(deletePlacesChain.in).toHaveBeenCalledWith('id', ['place-old']);
    expect(deleteStorageAssetsByUrlsMock).toHaveBeenCalledWith({
      bucket: 'place-media',
      urls: ['https://cdn.example/old-place.jpg'],
    });
    expect(deleteStorageAssetsByUrlsMock).toHaveBeenCalledWith({
      bucket: 'place-media',
      urls: ['https://cdn.example/old-cover.jpg'],
    });
  });

  it('throws when removing deleted places fails during update', async () => {
    const { updateList } = await import('@/mobile/app/data/repositories/listsRepository');
    const deletePlacesChain = createDeleteInChain({ error: new Error('remove places failed') });

    fetchVisibleDataContextMock.mockResolvedValue({ allUsers: [], blockRows: [] });
    fetchVisibleListsPageMock.mockResolvedValue([
      {
        id: 'list-1',
        userId: 'user-1',
        name: 'Saved spots',
        places: [
          {
            id: 'place-old',
            addedAt: '2026-04-16T10:00:00.000Z',
            lat: 1,
            lng: 1,
            name: 'Old cafe',
            photos: [],
          },
        ],
        isPublic: true,
        createdAt: '2026-04-16T10:00:00.000Z',
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
    ]);
    uploadImageAssetMock.mockResolvedValue(undefined);
    fromMock.mockReturnValueOnce(deletePlacesChain);

    await expect(updateList({
      id: 'list-1',
      userId: 'user-1',
      name: 'Saved spots',
      places: [],
      isPublic: true,
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:00:00.000Z',
    })).rejects.toThrow('remove places failed');
  });

  it('updates multiple lists in sequence with a shared visible-data context', async () => {
    const { updateLists } = await import('@/mobile/app/data/repositories/listsRepository');
    const upsertMock = vi.fn().mockResolvedValue({ error: null });

    fetchVisibleDataContextMock.mockResolvedValue({ allUsers: [], blockRows: [] });
    fetchVisibleListsPageMock.mockResolvedValue([]);
    uploadImageAssetMock.mockResolvedValue(undefined);
    fromMock
      .mockReturnValueOnce({ upsert: upsertMock })
      .mockReturnValueOnce({ upsert: upsertMock });

    await updateLists([
      {
        id: 'list-1',
        userId: 'user-1',
        name: 'One',
        places: [],
        isPublic: true,
        createdAt: '2026-04-16T10:00:00.000Z',
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      {
        id: 'list-2',
        userId: 'user-1',
        name: 'Two',
        places: [],
        isPublic: false,
        createdAt: '2026-04-16T10:00:00.000Z',
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
    ]);

    expect(fetchVisibleDataContextMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledTimes(2);
  });

  it('uses the caller snapshot instead of refetching the full list context', async () => {
    const { updateLists } = await import('@/mobile/app/data/repositories/listsRepository');
    const previousList = {
      id: 'list-fast',
      userId: 'user-1',
      name: 'Fast saves',
      places: [],
      isPublic: true,
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:00:00.000Z',
    };
    uploadImageAssetMock.mockResolvedValue(undefined);

    await updateLists([previousList], undefined, undefined, [previousList]);

    expect(fetchVisibleDataContextMock).not.toHaveBeenCalled();
    expect(fetchVisibleListsPageMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('does not rewrite the list row when only a place card changes', async () => {
    const { updateList } = await import('@/mobile/app/data/repositories/listsRepository');

    fetchVisibleDataContextMock.mockResolvedValue({ allUsers: [], blockRows: [] });
    fetchVisibleListsPageMock.mockResolvedValue([
      {
        id: 'list-1',
        userId: 'user-1',
        name: 'Saved spots',
        places: [
          {
            id: 'place-1',
            name: 'Cafe',
            title: 'Old title',
            lat: 1,
            lng: 1,
            photos: [],
            media: [],
            addedAt: '2026-04-16T10:00:00.000Z',
            updatedAt: '2026-04-16T10:00:00.000Z',
          },
        ],
        isPublic: true,
        createdAt: '2026-04-16T10:00:00.000Z',
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
    ]);
    uploadImageAssetMock.mockResolvedValue(undefined);
    fromMock.mockImplementation((table: string) => {
      throw new Error(`Unexpected table write: ${table}`);
    });

    await updateList({
      id: 'list-1',
      userId: 'user-1',
      name: 'Saved spots',
      places: [
        {
          id: 'place-1',
          name: 'Cafe',
          title: 'New title',
          lat: 1,
          lng: 1,
          photos: [],
          media: [],
          addedAt: '2026-04-16T10:00:00.000Z',
          updatedAt: '2026-04-16T10:30:00.000Z',
        },
      ],
      isPublic: true,
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:00:00.000Z',
    });

    expect(rpcMock).toHaveBeenCalledWith('upsert_list_place_with_media', {
      p_media: [],
      p_place: expect.objectContaining({
        id: 'place-1',
        title: 'New title',
        updated_at: '2026-04-16T10:30:00.000Z',
      }),
    });
    expect(fromMock).not.toHaveBeenCalledWith('lists');
  });

  it('deletes lists and associated storage assets', async () => {
    const { deleteList, reportList } = await import('@/mobile/app/data/repositories/listsRepository');
    const listSelectChain = {
      select: vi.fn(() => listSelectChain),
      eq: vi.fn().mockResolvedValue({
        data: [{ cover_image_url: 'https://cdn.example/cover.jpg', owner_id: 'viewer-1' }],
        error: null,
      }),
    };
    const placeSelectChain = {
      select: vi.fn(() => placeSelectChain),
      eq: vi.fn().mockResolvedValue({
        data: [
          {
            list_place_photos: [{ url: 'https://cdn.example/place.jpg' }],
          },
        ],
        error: null,
      }),
    };
    const deleteChain = {
      delete: vi.fn(() => deleteChain),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    submitModerationReportMock.mockResolvedValue(undefined);

    fromMock
      .mockReturnValueOnce(listSelectChain)
      .mockReturnValueOnce(placeSelectChain)
      .mockReturnValueOnce(deleteChain);

    await deleteList('list-1');
    await reportList('viewer-1', 'list-1', 'spam');

    expect(deleteStorageAssetsByUrlsMock).toHaveBeenCalledWith({
      bucket: 'place-media',
      urls: ['https://cdn.example/cover.jpg', 'https://cdn.example/place.jpg'],
    });
    expect(submitModerationReportMock).toHaveBeenCalledWith({
      targetType: 'list',
      reporterUserId: 'viewer-1',
      listId: 'list-1',
      reason: 'spam',
      details: undefined,
    });
  });

  it('propagates delete list read and write failures', async () => {
    const { deleteList } = await import('@/mobile/app/data/repositories/listsRepository');
    const listSelectChain = {
      select: vi.fn(() => listSelectChain),
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('list select failed'),
      }),
    };
    const unusedPlaceSelectChain = {
      select: vi.fn(() => unusedPlaceSelectChain),
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    fromMock
      .mockReturnValueOnce(listSelectChain)
      .mockReturnValueOnce(unusedPlaceSelectChain);
    await expect(deleteList('list-1')).rejects.toThrow('list select failed');

    const okListSelectChain = {
      select: vi.fn(() => okListSelectChain),
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };
    const placeSelectChain = {
      select: vi.fn(() => placeSelectChain),
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('place select failed'),
      }),
    };

    fromMock
      .mockReturnValueOnce(okListSelectChain)
      .mockReturnValueOnce(placeSelectChain);
    await expect(deleteList('list-1')).rejects.toThrow('place select failed');

    const okPlaceSelectChain = {
      select: vi.fn(() => okPlaceSelectChain),
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };
    const deleteChain = {
      delete: vi.fn(() => deleteChain),
      eq: vi.fn().mockResolvedValue({ error: new Error('delete failed') }),
    };

    fromMock
      .mockReturnValueOnce(okListSelectChain)
      .mockReturnValueOnce(okPlaceSelectChain)
      .mockReturnValueOnce(deleteChain);
    await expect(deleteList('list-1')).rejects.toThrow('delete failed');
  });

  it('propagates report errors', async () => {
    const { reportList } = await import('@/mobile/app/data/repositories/listsRepository');
    submitModerationReportMock.mockRejectedValue(new Error('report failed'));
    await expect(reportList('viewer-1', 'list-1', 'spam')).rejects.toThrow('report failed');
  });
});
