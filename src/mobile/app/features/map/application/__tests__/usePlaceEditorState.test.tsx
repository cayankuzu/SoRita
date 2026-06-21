import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';

const showToastMock = vi.fn();
const pickPlaceMediaFromPromptMock = vi.fn();
const pickSingleImageMock = vi.fn();
const beginProgressMock = vi.fn(() => ({
  setProgress: vi.fn(),
  complete: vi.fn(),
  end: vi.fn(),
}));

vi.mock('@/mobile/app/platform/feedback/toast', () => ({
  showToast: showToastMock,
}));

vi.mock('@/mobile/app/platform/media/images', () => ({
  pickPlaceMediaFromPrompt: pickPlaceMediaFromPromptMock,
  pickSingleImageFromPrompt: pickSingleImageMock,
  pickSingleImage: pickSingleImageMock,
}));

vi.mock('@/mobile/app/app-shell/feedback/AppProgressBanner', () => ({
  useAppProgressBanner: () => ({
    beginProgress: beginProgressMock,
  }),
}));

vi.mock('@/shared/utils/id', () => ({
  createUuid: () => 'generated-id',
}));

describe('usePlaceEditorState', () => {
  beforeEach(() => {
    showToastMock.mockReset();
    pickPlaceMediaFromPromptMock.mockReset();
    pickSingleImageMock.mockReset();
    beginProgressMock.mockClear();
  });

  it('drives photo/list interactions and saves a place payload', async () => {
    pickPlaceMediaFromPromptMock
      .mockResolvedValueOnce({
        items: [{ type: 'photo', url: 'file://photo-1.jpg' }],
        rejectedVideoCount: 0,
      })
      .mockResolvedValueOnce({
        items: [{ type: 'photo', url: 'file://photo-2.jpg' }],
        rejectedVideoCount: 0,
      });
    pickSingleImageMock.mockResolvedValueOnce('file://cover.jpg');
    const onSaveMock = vi.fn().mockResolvedValue(undefined);
    const onCreateListMock = vi.fn().mockResolvedValue(undefined);
    const lists = [
      {
        id: 'list-1',
        userId: 'viewer',
        name: 'Favorites',
        places: [],
        isPublic: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ];
    const hooks = await import('@/mobile/app/features/map/application/usePlaceEditorState');
    const hook = renderHook(() =>
      hooks.usePlaceEditorState({
        visible: true,
        lat: 39.9334,
        lng: 32.8597,
        placeName: 'Kahve',
        placeAddress: 'Ankara',
        lists,
        onSave: onSaveMock,
        onCreateList: onCreateListMock,
      }),
    );

    expect(hook.result.current.selectedLists).toEqual([]);

    act(() => {
      hook.result.current.setName('Kahve Dunyasi');
      hook.result.current.toggleCategory('coffee');
      hook.result.current.toggleBestTime('morning');
      hook.result.current.toggleAtmosphere('cozy');
      hook.result.current.toggleFeature('WiFi');
    });

    await act(async () => {
      await hook.result.current.handleAddPhoto();
    });

    await act(async () => {
      await hook.result.current.handleAddPhoto();
      await hook.result.current.handlePickListCover();
    });

    expect(hook.result.current.photos).toEqual(['file://photo-1.jpg', 'file://photo-2.jpg']);
    expect(hook.result.current.newListCoverImage).toBe('file://cover.jpg');
    expect(hook.result.current.selectedPhotoIndex).toBe(0);

    act(() => {
      hook.result.current.handlePhotoPress(0);
    });

    expect(hook.result.current.selectedPhotoIndex).toBeNull();

    act(() => {
      hook.result.current.handlePhotoPress(0);
    });

    expect(hook.result.current.selectedPhotoIndex).toBe(0);

    act(() => {
      hook.result.current.handlePhotoPress(1);
    });

    expect(hook.result.current.selectedPhotoIndex).toBeNull();
    expect(hook.result.current.photos).toEqual(['file://photo-2.jpg', 'file://photo-1.jpg']);

    act(() => {
      hook.result.current.setShowNewListForm(true);
      hook.result.current.setNewListName('Weekend');
      hook.result.current.setNewListDescription('Brunch spots');
      hook.result.current.setNewListPublic(false);
    });

    await act(async () => {
      await hook.result.current.handleCreateList();
    });

    act(() => {
      hook.result.current.toggleList('list-1');
    });

    expect(onCreateListMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'generated-id',
        name: 'Weekend',
        description: 'Brunch spots',
        isPublic: false,
      }),
    );

    await act(async () => {
      await hook.result.current.handleSave();
    });

    expect(beginProgressMock).toHaveBeenCalledTimes(1);
    expect(onSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Kahve Dunyasi',
        lat: 39.9334,
        lng: 32.8597,
        address: 'Ankara',
        category: 'coffee',
        categories: ['coffee'],
        bestTimes: ['morning'],
        atmosphere: ['cozy'],
        specialFeatures: ['WiFi'],
        photos: ['file://photo-2.jpg', 'file://photo-1.jpg'],
      }),
      expect.arrayContaining(['list-1']),
      expect.objectContaining({ onProgress: expect.any(Function) }),
    );

    hook.unmount();
  });

  it('allows saving without optional place details but still requires an explicit list selection', async () => {
    let lists: Array<{
      id: string;
      userId: string;
      name: string;
      places: never[];
      isPublic: boolean;
      createdAt: string;
      updatedAt: string;
    }> = [];
    const onSaveMock = vi.fn().mockResolvedValue(undefined);
    const onCreateListMock = vi.fn().mockImplementation(async (list) => {
      lists = [...lists, list];
    });
    const hooks = await import('@/mobile/app/features/map/application/usePlaceEditorState');
    const { tr } = await import('@/mobile/app/shared/i18n/tr');
    const hook = renderHook(() =>
      hooks.usePlaceEditorState({
        visible: true,
        lat: 39.9334,
        lng: 32.8597,
        lists,
        onSave: onSaveMock,
        onCreateList: onCreateListMock,
      }),
    );

    expect(hook.result.current.canContinue).toBe(true);

    act(() => {
      hook.result.current.goToNextStep();
    });
    expect(hook.result.current.step).toBe(1);
    expect(hook.result.current.canContinue).toBe(true);

    act(() => {
      hook.result.current.goToNextStep();
    });
    expect(hook.result.current.step).toBe(2);
    expect(hook.result.current.canContinue).toBe(false);

    act(() => {
      hook.result.current.setShowNewListForm(true);
      hook.result.current.setNewListName('Yeni Liste');
    });
    expect(hook.result.current.canContinue).toBe(false);

    await act(async () => {
      await hook.result.current.handleCreateList();
    });

    hook.rerender();

    await waitFor(() => {
      expect(hook.result.current.selectedLists).toContain('generated-id');
      expect(hook.result.current.canContinue).toBe(true);
    });

    await act(async () => {
      await hook.result.current.handleSave();
    });

    expect(beginProgressMock).toHaveBeenCalledTimes(1);
    expect(onSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: tr.placeEditor.placeNamePlaceholder,
        categories: [],
        bestTimes: [],
        atmosphere: [],
        specialFeatures: [],
      }),
      ['generated-id'],
      expect.objectContaining({ onProgress: expect.any(Function) }),
    );

    hook.unmount();
  });

  it('surfaces validation feedback and duplicate list protection', async () => {
    const hooks = await import('@/mobile/app/features/map/application/usePlaceEditorState');
    const lists = [
      {
        id: 'list-1',
        userId: 'viewer',
        name: 'Favorites',
        places: [
          {
            id: 'place-1',
            name: 'Cafe',
            lat: 1,
            lng: 1,
            addedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        isPublic: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ];
    const hook = renderHook(() =>
      hooks.usePlaceEditorState({
        visible: true,
        lat: 1,
        lng: 1,
        lists,
        placeName: 'Cafe',
        onSave: vi.fn().mockResolvedValue(undefined),
      }),
    );

    act(() => {
      hook.result.current.toggleList('list-1', { blocked: true, listName: 'Favorites' });
      hook.result.current.goToNextStep();
      hook.result.current.goToNextStep();
    });

    await act(async () => {
      await hook.result.current.handleSave();
    });

    expect(hook.result.current.listSelectionNotice).toBeTruthy();
    expect(hook.result.current.canContinue).toBe(false);

    hook.unmount();
  });

  it('limits new target list selections to three at a time', async () => {
    const hooks = await import('@/mobile/app/features/map/application/usePlaceEditorState');
    const lists = Array.from({ length: 4 }, (_, index) => ({
      id: `list-${index + 1}`,
      userId: 'viewer',
      name: `List ${index + 1}`,
      places: [],
      isPublic: index % 2 === 0,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    }));
    const hook = renderHook(() =>
      hooks.usePlaceEditorState({
        visible: true,
        lat: 41,
        lng: 29,
        lists,
        onSave: vi.fn().mockResolvedValue(undefined),
      }),
    );

    act(() => {
      hook.result.current.toggleList('list-1');
      hook.result.current.toggleList('list-2');
      hook.result.current.toggleList('list-3');
      hook.result.current.toggleList('list-4');
    });

    expect(hook.result.current.selectedLists).toEqual(['list-1', 'list-2', 'list-3']);

    hook.unmount();
  });

  it('keeps selected photos when async place details update for the same location', async () => {
    pickPlaceMediaFromPromptMock.mockResolvedValue({
      items: [{ type: 'photo', url: 'file://photo-1.jpg' }],
      rejectedVideoCount: 0,
    });
    const hooks = await import('@/mobile/app/features/map/application/usePlaceEditorState');
    const params = {
      visible: true,
      lat: 39.9334,
      lng: 32.8597,
      placeName: 'Cafe',
      placeAddress: 'Adres cozuluyor...',
      lists: [],
      onSave: vi.fn().mockResolvedValue(undefined),
    };

    const hook = renderHook(() => hooks.usePlaceEditorState(params));

    await act(async () => {
      await hook.result.current.handleAddPhoto();
    });

    expect(hook.result.current.photos).toEqual(['file://photo-1.jpg']);
    expect(hook.result.current.address).toBe('Adres cozuluyor...');

    params.placeAddress = 'Marmara Universitesi, Istanbul';
    hook.rerender();

    expect(hook.result.current.photos).toEqual(['file://photo-1.jpg']);
    expect(hook.result.current.address).toBe('Marmara Universitesi, Istanbul');

    act(() => {
      hook.result.current.setAddress('Kullanici tarafindan duzenlenen adres');
    });

    params.placeAddress = 'Guncel ama kullaniciya yazdirilmamali';
    hook.rerender();

    expect(hook.result.current.photos).toEqual(['file://photo-1.jpg']);
    expect(hook.result.current.address).toBe('Kullanici tarafindan duzenlenen adres');

    hook.unmount();
  });
});
