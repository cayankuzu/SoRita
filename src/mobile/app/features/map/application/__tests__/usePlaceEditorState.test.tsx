import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import { act, renderHook, waitFor } from '@/mobile/app/test/hookTestUtils';

const showToastMock = vi.fn();
const pickPlaceMediaFromPromptMock = vi.fn();
const pickSingleImageMock = vi.fn();
const findFirstOversizedPlaceMediaMock = vi.fn();
const setProgressMock = vi.fn();
const completeProgressMock = vi.fn();
const failProgressMock = vi.fn();
const endProgressMock = vi.fn();
const beginProgressMock = vi.fn(() => ({
  setProgress: setProgressMock,
  complete: completeProgressMock,
  fail: failProgressMock,
  end: endProgressMock,
}));

vi.mock('@/mobile/app/platform/feedback/toast', () => ({
  showToast: showToastMock,
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/mobile/app/platform/media/images', () => ({
  pickPlaceMediaFromPrompt: pickPlaceMediaFromPromptMock,
  pickSingleImageFromPrompt: pickSingleImageMock,
  pickSingleImage: pickSingleImageMock,
}));

vi.mock('@/mobile/app/platform/media/placeMediaSize', () => ({
  findFirstOversizedPlaceMedia: findFirstOversizedPlaceMediaMock,
  PLACE_MEDIA_MAX_FILE_SIZE_MB: 47,
}));

vi.mock('@/mobile/app/platform/media/mediaPickerTransition', () => ({
  waitForMediaPickerTransition: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/mobile/app/features/map/application/usePreparedPlaceMediaUploads', () => ({
  usePreparedPlaceMediaUploads: vi.fn(),
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
    findFirstOversizedPlaceMediaMock.mockReset();
    findFirstOversizedPlaceMediaMock.mockResolvedValue(null);
    beginProgressMock.mockClear();
    setProgressMock.mockReset();
    completeProgressMock.mockReset();
    failProgressMock.mockReset();
    endProgressMock.mockReset();
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
    let lists: PlaceList[] = [
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
    const onCreateListMock = vi.fn().mockImplementation(async (list: PlaceList) => {
      lists = [...lists, list];
    });
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
      hook.result.current.setMenuUrl('menu.example.com/kahve');
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
    expect(hook.result.current.selectedPhotoIndex).toBeNull();

    act(() => {
      hook.result.current.handlePhotoPress(0);
    });

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

    hook.rerender();

    expect(onCreateListMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'generated-id',
        name: 'Weekend',
        description: 'Brunch spots',
        isPublic: false,
      }),
    );
    await waitFor(() => {
      expect(hook.result.current.selectedLists).toEqual(['generated-id']);
    });

    await act(async () => {
      await hook.result.current.handleSave();
    });

    expect(beginProgressMock).toHaveBeenCalledTimes(1);
    expect(onSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Kahve Dunyasi',
        menuUrl: 'https://menu.example.com/kahve',
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
      ['generated-id'],
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

  it('blocks save when the menu URL is not a safe public https link', async () => {
    const onSaveMock = vi.fn().mockResolvedValue(undefined);
    const hooks = await import('@/mobile/app/features/map/application/usePlaceEditorState');
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
    const hook = renderHook(() =>
      hooks.usePlaceEditorState({
        visible: true,
        lat: 41,
        lng: 29,
        lists,
        onSave: onSaveMock,
      }),
    );

    act(() => {
      hook.result.current.setMenuUrl('http://localhost/menu');
      hook.result.current.toggleList('list-1');
    });

    await act(async () => {
      await hook.result.current.handleSave();
    });

    expect(onSaveMock).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith('Geçerli ve güvenli bir menü URL bağlantısı gir.', 'error');

    hook.unmount();
  });

  it('keeps the editor open and shows a blocking notice when selected media exceeds the 720p upload budget', async () => {
    pickPlaceMediaFromPromptMock.mockResolvedValue({
      items: [{ type: 'photo', url: 'file://photo-1.jpg' }],
      rejectedOversizeCount: 0,
      rejectedVideoCount: 0,
    });
    findFirstOversizedPlaceMediaMock.mockResolvedValue({
      fileSizeBytes: 48_512_751,
      index: 0,
      item: { type: 'photo', url: 'file://photo-1.jpg' },
    });

    const onSaveMock = vi.fn().mockResolvedValue(undefined);
    const onSaveStartMock = vi.fn();
    const hooks = await import('@/mobile/app/features/map/application/usePlaceEditorState');
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
    const hook = renderHook(() =>
      hooks.usePlaceEditorState({
        visible: true,
        lat: 41,
        lng: 29,
        lists,
        onSave: onSaveMock,
        onSaveStart: onSaveStartMock,
      }),
    );

    await act(async () => {
      await hook.result.current.handleAddPhoto();
    });

    act(() => {
      hook.result.current.toggleList('list-1');
    });

    await act(async () => {
      await hook.result.current.handleSave();
    });

    expect(onSaveStartMock).not.toHaveBeenCalled();
    expect(onSaveMock).not.toHaveBeenCalled();
    expect(beginProgressMock).not.toHaveBeenCalled();
    expect(hook.result.current.blockingNotice).toEqual(
      expect.objectContaining({
        title: expect.any(String),
      }),
    );

    hook.unmount();
  });

  it('keeps the new list form open when list creation fails', async () => {
    const hooks = await import('@/mobile/app/features/map/application/usePlaceEditorState');
    const onCreateListMock = vi.fn(() => {
      throw new Error('Liste kaydedilemedi');
    });
    const onSaveMock = vi.fn().mockResolvedValue(undefined);
    const lists: PlaceList[] = [];
    const hook = renderHook(() =>
      hooks.usePlaceEditorState({
        visible: true,
        lat: 41,
        lng: 29,
        lists,
        onSave: onSaveMock,
        onCreateList: onCreateListMock,
      }),
    );

    act(() => {
      hook.result.current.setShowNewListForm(true);
      hook.result.current.setNewListName('Yeni Liste');
    });

    await act(async () => {
      await hook.result.current.handleCreateList();
    });

    expect(hook.result.current.showNewListForm).toBe(true);
    expect(hook.result.current.selectedLists).toEqual([]);
    expect(showToastMock).toHaveBeenCalledWith('Liste kaydedilemedi', 'error');
    expect(showToastMock).not.toHaveBeenCalledWith(
      expect.stringContaining('Yeni liste oluşturuldu'),
      'success',
    );

    hook.unmount();
  });

  it('limits new target list selections to one at a time', async () => {
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

    expect(hook.result.current.selectedLists).toEqual(['list-1']);

    hook.unmount();
  });

  it('keeps selected photos when async place details update for the same location', async () => {
    pickPlaceMediaFromPromptMock.mockResolvedValue({
      items: [{ type: 'photo', url: 'file://photo-1.jpg' }],
      rejectedVideoCount: 0,
    });
    const hooks = await import('@/mobile/app/features/map/application/usePlaceEditorState');
    const params: Parameters<typeof hooks.usePlaceEditorState>[0] = {
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

  it('hydrates complete existing-place and draft state, then resets cleanly across visibility/source changes', async () => {
    const hooks = await import('@/mobile/app/features/map/application/usePlaceEditorState');
    const { PLACE_DIETARY_OPTIONS } = await import('@/mobile/app/catalog/placeOptions');
    const lists: PlaceList[] = [{
      id: 'list-1', userId: 'viewer', name: 'Favorites', isPublic: true,
      createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
      places: [{
        id: 'place-1', name: 'Existing', title: 'Title', menuUrl: 'https://example.com/menu',
        lat: 41, lng: 29, address: 'Address', notes: 'Notes', rating: 4.5,
        categories: ['coffee', 'dessert'], studentDiscount: true, priceMin: 10, priceMax: 20,
        bestTimes: ['morning'], atmosphere: ['cozy'], specialFeatures: ['WiFi', PLACE_DIETARY_OPTIONS[0]],
        media: [
          { type: 'photo', url: 'file://one.jpg' },
          { type: 'video', url: 'file://one.mp4', thumbnailUrl: 'file://thumb.jpg', thumbnailTimeMs: 1000 },
        ],
        addedAt: '2025-01-01T00:00:00.000Z',
      }],
    }];
    const params: Parameters<typeof hooks.usePlaceEditorState>[0] = {
      visible: true,
      lat: 41,
      lng: 29,
      placeName: 'Incoming',
      placeAddress: 'Incoming address',
      lists,
      existingPlace: lists[0].places[0],
      draft: null,
      onSave: vi.fn().mockResolvedValue(undefined),
    };
    const hook = renderHook(() => hooks.usePlaceEditorState(params));

    expect(hook.result.current).toMatchObject({
      name: 'Incoming', title: 'Title', menuUrl: 'https://example.com/menu',
      address: 'Incoming address', notes: 'Notes', rating: 4.5, studentFriendly: true,
      priceMin: '10', priceMax: '20', selectedCategories: ['coffee', 'dessert'],
      selectedLists: ['list-1'], bestTimes: ['morning'], atmosphere: ['cozy'],
    });
    expect(hook.result.current.dietarySelections).toEqual([PLACE_DIETARY_OPTIONS[0]]);
    expect(hook.result.current.generalFeatureOptions).not.toContain(PLACE_DIETARY_OPTIONS[0]);

    act(() => {
      hook.result.current.setTitle('Draft title');
      hook.result.current.setMenuUrl('example.com/draft');
      hook.result.current.setNotes('Draft notes');
      hook.result.current.setPriceMin('12tl');
      hook.result.current.setPriceMax('34.50');
      hook.result.current.setRating(3.5);
      hook.result.current.setStudentFriendly(false);
      hook.result.current.setShowNewListForm(true);
      hook.result.current.setNewListName('Draft list');
      hook.result.current.setNewListDescription('Draft description');
      hook.result.current.setNewListCoverImage('file://cover.jpg');
      hook.result.current.setNewListPublic(false);
      hook.result.current.goToNextStep();
      hook.result.current.toggleCategory('dessert');
      hook.result.current.toggleBestTime('morning');
      hook.result.current.toggleAtmosphere('cozy');
      hook.result.current.toggleFeature('WiFi');
    });
    expect(hook.result.current.priceMin).toBe('12');
    expect(hook.result.current.priceMax).toBe('3450');
    const draft = hook.result.current.buildDraft();
    expect(draft).toMatchObject({ title: 'Draft title', step: 1, newListPublic: false });

    params.draft = draft;
    hook.rerender();
    expect(hook.result.current).toMatchObject({
      title: 'Draft title', priceMin: '12', priceMax: '3450', step: 1,
      showNewListForm: true, newListName: 'Draft list', newListPublic: false,
    });

    params.draft = null;
    params.visible = false;
    hook.rerender();
    expect(hook.result.current.blockingNotice).toBeNull();

    params.visible = true;
    params.lat = 40;
    params.lng = 30;
    params.placeName = '';
    params.placeAddress = '';
    params.existingPlace = undefined;
    hook.rerender();
    expect(hook.result.current).toMatchObject({
      step: 0, name: '', title: '', menuUrl: '', address: '', notes: '', rating: 0,
      studentFriendly: false, priceMin: '', priceMax: '', selectedLists: [], media: [],
    });
    hook.unmount();
  });

  it('enforces media composition limits and supports edit, remove, reorder, and video thumbnails', async () => {
    const hooks = await import('@/mobile/app/features/map/application/usePlaceEditorState');
    const lists: PlaceList[] = [];
    const onSave = vi.fn();
    const hook = renderHook(() => hooks.usePlaceEditorState({
      visible: true, lat: 41, lng: 29, lists, onSave,
    }));
    pickPlaceMediaFromPromptMock.mockResolvedValueOnce({
      items: [
        ...Array.from({ length: 7 }, (_, index) => ({ type: 'photo' as const, url: `file://p${index}.jpg` })),
        { type: 'video', url: 'file://v1.mp4' },
      ],
      rejectedVideoCount: 0,
      rejectedOversizeCount: 0,
    });
    await act(async () => {
      await hook.result.current.handleAddMedia();
    });
    expect(hook.result.current.media).toHaveLength(6);
    expect(showToastMock).toHaveBeenCalled();

    await act(async () => {
      await hook.result.current.handleAddMedia();
    });
    expect(pickPlaceMediaFromPromptMock).toHaveBeenCalledTimes(1);

    act(() => {
      hook.result.current.handleMediaPress(0);
      hook.result.current.handleRemoveMedia(5);
      hook.result.current.handleRemoveMedia(0);
      hook.result.current.handleRemoveMedia(-1);
    });
    expect(hook.result.current.selectedMediaIndex).toBeNull();

    pickPlaceMediaFromPromptMock.mockResolvedValueOnce({
      items: [{ type: 'video', url: 'file://v1.mp4' }], rejectedVideoCount: 0, rejectedOversizeCount: 0,
    });
    await act(async () => {
      await hook.result.current.handleEditMedia(0);
    });
    expect(hook.result.current.editingVideoThumbnailIndex).toBe(0);
    act(() => {
      hook.result.current.openVideoThumbnailEditor(-1);
      hook.result.current.openVideoThumbnailEditor(1);
      hook.result.current.openVideoThumbnailEditor(0);
      hook.result.current.applyVideoThumbnail({ thumbnailTimeMs: 2500, thumbnailUrl: '' });
    });
    expect(hook.result.current.media[0]).toMatchObject({
      type: 'video', thumbnailTimeMs: 2500, thumbnailUrl: undefined,
    });
    expect(hook.result.current.editingVideoThumbnailIndex).toBeNull();

    pickPlaceMediaFromPromptMock.mockResolvedValueOnce({
      items: [], rejectedVideoCount: 1, rejectedOversizeCount: 0,
    });
    await act(async () => {
      await hook.result.current.handleEditMedia(0);
    });
    expect(showToastMock).toHaveBeenCalled();
    act(() => hook.result.current.closeVideoThumbnailEditor());
    hook.unmount();
  });

  it('prioritizes oversize/duration feedback and exposes save progress, retry, abort, and fallback errors', async () => {
    const hooks = await import('@/mobile/app/features/map/application/usePlaceEditorState');
    const lists: PlaceList[] = [{
      id: 'list-1', userId: 'viewer', name: 'Favorites', places: [], isPublic: true,
      createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
    }];
    pickPlaceMediaFromPromptMock
      .mockResolvedValueOnce({ items: [], rejectedVideoCount: 0, rejectedOversizeCount: 1 })
      .mockResolvedValueOnce({ items: [], rejectedVideoCount: 1, rejectedOversizeCount: 0 });
    const onSaveError = vi.fn();
    const onBannerCancel = vi.fn();
    const onBannerOpen = vi.fn();
    const onBannerRetry = vi.fn();
    const abortController = new AbortController();
    const onSave = vi.fn().mockRejectedValueOnce(new Error('write failed'));
    const hook = renderHook(() => hooks.usePlaceEditorState({
      visible: true, lat: 41, lng: 29, lists, onSave, onSaveError,
      onSaveStart: () => ({
        abortSignal: abortController.signal, onBannerCancel, onBannerOpen, onBannerRetry,
      }),
    }));

    await act(async () => hook.result.current.handleAddMedia());
    expect(hook.result.current.blockingNotice).not.toBeNull();
    act(() => hook.result.current.clearBlockingNotice());
    expect(hook.result.current.blockingNotice).toBeNull();
    await act(async () => hook.result.current.handleAddMedia());
    expect(showToastMock).toHaveBeenCalled();

    act(() => hook.result.current.toggleList('list-1'));
    await act(async () => hook.result.current.handleSave());
    expect(onSaveError).toHaveBeenCalledWith(expect.objectContaining({ selectedLists: ['list-1'] }));
    expect(beginProgressMock).toHaveBeenCalledWith({ onCancel: onBannerCancel, onOpen: onBannerOpen });
    expect(failProgressMock).toHaveBeenCalledWith({
      onCancel: onBannerCancel, onOpen: onBannerOpen, onRetry: onBannerRetry,
    });
    expect(endProgressMock).toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith('write failed', 'error');

    const abortError = new Error('cancelled');
    abortError.name = 'AbortError';
    onSave.mockRejectedValueOnce(abortError);
    onSaveError.mockClear();
    failProgressMock.mockClear();
    await act(async () => hook.result.current.handleSave());
    expect(onSaveError).not.toHaveBeenCalled();
    expect(failProgressMock).not.toHaveBeenCalled();
    expect(endProgressMock).toHaveBeenCalledTimes(2);

    onSave.mockRejectedValueOnce('unknown');
    await act(async () => hook.result.current.handleSave());
    expect(showToastMock).toHaveBeenCalledWith(expect.any(String), 'error');
    hook.unmount();
  });

  it('enforces media quotas and replacement bounds at the pure editor boundary', async () => {
    const { placeEditorInternals } = await import(
      '@/mobile/app/features/map/application/usePlaceEditorState'
    );
    const photos = Array.from({ length: 6 }, (_, index) => ({
      type: 'photo' as const, url: `file://photo-${index}.jpg`,
    }));
    const video = { type: 'video' as const, url: 'file://video.mp4' };

    expect(placeEditorInternals.appendPlaceMediaWithinLimits(photos, [
      { type: 'photo', url: 'file://overflow.jpg' },
    ])).toMatchObject({ issues: { rejectedPhotos: 1 }, nextMedia: photos });
    const secondVideo = { type: 'video' as const, url: 'file://second-current.mp4' };
    expect(placeEditorInternals.appendPlaceMediaWithinLimits([video, secondVideo], [
      { type: 'video', url: 'file://second.mp4' },
    ])).toMatchObject({ issues: { rejectedVideos: 1 }, nextMedia: [video, secondVideo] });
    expect(placeEditorInternals.appendPlaceMediaWithinLimits([...photos.slice(0, 5), video], [
      { type: 'photo', url: 'file://total-overflow.jpg' },
    ])).toMatchObject({ issues: { rejectedTotal: 1 } });

    expect(placeEditorInternals.replacePlaceMediaWithinLimits(photos, -1, video)).toMatchObject({
      replaced: false, nextMedia: photos,
    });
    expect(placeEditorInternals.replacePlaceMediaWithinLimits(photos, 9, video)).toMatchObject({
      replaced: false,
    });
    expect(placeEditorInternals.replacePlaceMediaWithinLimits(
      [video, secondVideo, photos[0]!], 2, { type: 'video', url: 'file://replacement.mp4' },
    )).toMatchObject({ replaced: false, issues: { rejectedVideos: 1 } });
    expect(placeEditorInternals.replacePlaceMediaWithinLimits(
      photos, 4, { type: 'video', url: 'file://replacement.mp4' },
    )).toMatchObject({ replaced: true, nextMedia: [
      ...photos.slice(0, 4), { type: 'video', url: 'file://replacement.mp4' }, photos[5],
    ] });
    expect(placeEditorInternals.sanitizeNumericInput('12a-3')).toBe('123');
    expect(placeEditorInternals.getErrorMessage(new Error('specific'), 'fallback')).toBe('specific');
    expect(placeEditorInternals.getErrorMessage(new Error('  '), 'fallback')).toBe('fallback');
    expect(placeEditorInternals.getErrorMessage('failure', 'fallback')).toBe('fallback');
  });
});
