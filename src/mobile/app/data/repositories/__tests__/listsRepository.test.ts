import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();
const uploadImageAssetMock = vi.fn();
const uploadPlaceMediaAssetMock = vi.fn();
const deleteStorageAssetsByUrlsMock = vi.fn();
const fetchVisibleDataContextMock = vi.fn();
const fetchVisibleListsPageMock = vi.fn();

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock('@/mobile/app/platform/supabase/media', () => ({
  deleteStorageAssetsByUrls: deleteStorageAssetsByUrlsMock,
  uploadImageAsset: uploadImageAssetMock,
  uploadPlaceMediaAsset: uploadPlaceMediaAssetMock,
}));

vi.mock('@/mobile/app/data/repositories/visibleDataRepository', () => ({
  fetchVisibleDataContext: fetchVisibleDataContextMock,
  fetchVisibleListsPage: fetchVisibleListsPageMock,
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
    uploadImageAssetMock.mockReset();
    uploadPlaceMediaAssetMock.mockReset();
    deleteStorageAssetsByUrlsMock.mockReset();
    fetchVisibleDataContextMock.mockReset();
    fetchVisibleListsPageMock.mockReset();
    deleteStorageAssetsByUrlsMock.mockResolvedValue(undefined);
  });

  it('creates a list with uploaded cover media and place photos', async () => {
    const { createList } = await import('@/mobile/app/data/repositories/listsRepository');
    const listsUpsertMock = vi.fn().mockResolvedValue({ error: null });
    const placesUpsertMock = vi.fn().mockResolvedValue({ error: null });
    const deletePhotoRowsChain = {
      delete: vi.fn(() => deletePhotoRowsChain),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    const insertPhotoRowsMock = vi.fn().mockResolvedValue({ error: null });

    uploadImageAssetMock.mockResolvedValueOnce('https://cdn.example/list-cover.jpg');
    uploadPlaceMediaAssetMock
      .mockResolvedValueOnce('https://cdn.example/place-0.jpg')
      .mockResolvedValueOnce('https://cdn.example/place-1.jpg');
    fromMock
      .mockReturnValueOnce({ upsert: listsUpsertMock })
      .mockReturnValueOnce({ upsert: placesUpsertMock })
      .mockReturnValueOnce(deletePhotoRowsChain)
      .mockReturnValueOnce({ insert: insertPhotoRowsMock });

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
    expect(placesUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        atmosphere: ['quiet'],
        best_times: ['morning'],
        categories: ['coffee'],
        created_by: 'user-1',
        special_features: ['wifi'],
      }),
    );
    expect(insertPhotoRowsMock).toHaveBeenCalledWith([
      expect.objectContaining({
        list_place_id: 'place-1',
        media_type: 'photo',
        sort_order: 0,
        url: 'https://cdn.example/place-0.jpg',
      }),
      expect.objectContaining({
        list_place_id: 'place-1',
        media_type: 'photo',
        sort_order: 1,
        url: 'https://cdn.example/place-1.jpg',
      }),
    ]);
  });

  it('throws when list persistence fails', async () => {
    const { createList } = await import('@/mobile/app/data/repositories/listsRepository');
    const expectedError = new Error('lists upsert failed');

    uploadImageAssetMock.mockResolvedValue(undefined);
    fromMock.mockReturnValueOnce({
      upsert: vi.fn().mockResolvedValue({ error: expectedError }),
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
    })).rejects.toThrow('lists upsert failed');
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
      upsert: vi.fn().mockResolvedValue({ error: null }),
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
    const listsUpsertMock = vi.fn().mockResolvedValue({ error: null });
    const placesUpsertMock = vi.fn().mockResolvedValue({ error: new Error('place upsert failed') });

    uploadImageAssetMock.mockResolvedValue(undefined);
    fromMock
      .mockReturnValueOnce({ upsert: listsUpsertMock })
      .mockReturnValueOnce({ upsert: placesUpsertMock });

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

  it('persists empty array fields and a fallback name when optional place details are omitted', async () => {
    const { createList } = await import('@/mobile/app/data/repositories/listsRepository');
    const listsUpsertMock = vi.fn().mockResolvedValue({ error: null });
    const placesUpsertMock = vi.fn().mockResolvedValue({ error: null });
    const deletePhotoRowsChain = {
      delete: vi.fn(() => deletePhotoRowsChain),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    uploadImageAssetMock.mockResolvedValue(undefined);
    fromMock
      .mockReturnValueOnce({ upsert: listsUpsertMock })
      .mockReturnValueOnce({ upsert: placesUpsertMock })
      .mockReturnValueOnce(deletePhotoRowsChain);

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

    expect(placesUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Kaydedilen Mekân',
        categories: [],
        best_times: [],
        atmosphere: [],
        special_features: [],
      }),
    );
  });

  it('throws when old place photo rows cannot be deleted', async () => {
    const { createList } = await import('@/mobile/app/data/repositories/listsRepository');
    const listsUpsertMock = vi.fn().mockResolvedValue({ error: null });
    const placesUpsertMock = vi.fn().mockResolvedValue({ error: null });
    const deletePhotoRowsChain = {
      delete: vi.fn(() => deletePhotoRowsChain),
      eq: vi.fn().mockResolvedValue({ error: new Error('delete photo rows failed') }),
    };

    uploadImageAssetMock.mockResolvedValue(undefined);
    fromMock
      .mockReturnValueOnce({ upsert: listsUpsertMock })
      .mockReturnValueOnce({ upsert: placesUpsertMock })
      .mockReturnValueOnce(deletePhotoRowsChain);

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
    })).rejects.toThrow('delete photo rows failed');
  });

  it('throws when new place photo rows cannot be inserted', async () => {
    const { createList } = await import('@/mobile/app/data/repositories/listsRepository');
    const listsUpsertMock = vi.fn().mockResolvedValue({ error: null });
    const placesUpsertMock = vi.fn().mockResolvedValue({ error: null });
    const deletePhotoRowsChain = {
      delete: vi.fn(() => deletePhotoRowsChain),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    const insertPhotoRowsMock = vi.fn().mockResolvedValue({ error: new Error('insert photo rows failed') });

    uploadImageAssetMock.mockResolvedValueOnce(undefined);
    uploadPlaceMediaAssetMock.mockResolvedValueOnce('https://cdn.example/place-0.jpg');
    fromMock
      .mockReturnValueOnce({ upsert: listsUpsertMock })
      .mockReturnValueOnce({ upsert: placesUpsertMock })
      .mockReturnValueOnce(deletePhotoRowsChain)
      .mockReturnValueOnce({ insert: insertPhotoRowsMock });

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
    })).rejects.toThrow('insert photo rows failed');
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
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
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
    fromMock
      .mockReturnValueOnce({ upsert: upsertMock })
      .mockReturnValueOnce(deletePlacesChain);

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

  it('updates multiple lists in sequence', async () => {
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

    expect(fetchVisibleDataContextMock).toHaveBeenCalledTimes(2);
    expect(upsertMock).toHaveBeenCalledTimes(2);
  });

  it('deletes lists and associated storage assets', async () => {
    const { deleteList, reportList } = await import('@/mobile/app/data/repositories/listsRepository');
    const listSelectChain = {
      select: vi.fn(() => listSelectChain),
      eq: vi.fn().mockResolvedValue({
        data: [{ cover_image_url: 'https://cdn.example/cover.jpg' }],
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
    const reportUpsertMock = vi.fn().mockResolvedValue({ error: null });

    fromMock
      .mockReturnValueOnce(listSelectChain)
      .mockReturnValueOnce(placeSelectChain)
      .mockReturnValueOnce(deleteChain)
      .mockReturnValueOnce({ upsert: reportUpsertMock });

    await deleteList('list-1');
    await reportList('viewer-1', 'list-1', 'spam');

    expect(deleteStorageAssetsByUrlsMock).toHaveBeenCalledWith({
      bucket: 'place-media',
      urls: ['https://cdn.example/cover.jpg', 'https://cdn.example/place.jpg'],
    });
    expect(reportUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        list_id: 'list-1',
        reporter_user_id: 'viewer-1',
        reason: 'spam',
      }),
      { onConflict: 'list_id,reporter_user_id' },
    );
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
    const reportUpsertMock = vi.fn().mockResolvedValue({ error: new Error('report failed') });

    fromMock.mockReturnValueOnce({ upsert: reportUpsertMock });
    await expect(reportList('viewer-1', 'list-1', 'spam')).rejects.toThrow('report failed');
  });
});
