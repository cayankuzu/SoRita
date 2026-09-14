import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import { buildPlaceAddToListDraft } from '@/mobile/app/features/places/application/placeAddToListDraft';
import { act, renderHook } from '@/mobile/app/test/hookTestUtils';

const beginProgressMock = vi.fn(() => ({
  setProgress: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  end: vi.fn(),
}));

vi.mock('@/mobile/app/app-shell/feedback/AppProgressBanner', () => ({
  useAppProgressBanner: () => ({ beginProgress: beginProgressMock }),
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/mobile/app/platform/feedback/toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('@/mobile/app/platform/media/images', () => ({
  pickPlaceMediaFromPrompt: vi.fn(),
  pickSingleImageFromPrompt: vi.fn(),
}));

vi.mock('@/mobile/app/platform/media/mediaPickerTransition', () => ({
  waitForMediaPickerTransition: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/mobile/app/platform/media/placeMediaSize', () => ({
  findFirstOversizedPlaceMedia: vi.fn().mockResolvedValue(null),
  PLACE_MEDIA_MAX_FILE_SIZE_MB: 47,
}));

vi.mock('@/shared/utils/id', () => ({
  createUuid: () => 'generated-list',
}));

describe('place-card add-to-list editor flow', () => {
  beforeEach(() => {
    beginProgressMock.mockClear();
  });

  it('hydrates the quoted card, selects a target, and saves it as a new place', async () => {
    const sourcePlace: Place = {
      id: 'source-place',
      name: 'Kart Mekani',
      title: 'Kart basligi',
      menuUrl: 'https://example.com/menu',
      lat: 41,
      lng: 29,
      address: 'Kart adresi',
      notes: 'Kart notu',
      rating: 4.5,
      categories: ['coffee', 'dessert'],
      studentDiscount: true,
      priceMin: 100,
      priceMax: 200,
      bestTimes: ['morning'],
      atmosphere: ['quiet'],
      specialFeatures: ['WiFi'],
      media: [{ type: 'photo', url: 'sorita-storage://place-media-private/source/photo.jpg' }],
      addedAt: '2026-01-01T00:00:00.000Z',
      addedBy: { userId: 'source-owner', userName: 'Source Owner' },
    };
    const targetList: PlaceList = {
      id: 'target-list',
      userId: 'viewer',
      name: 'Favoriler',
      places: [],
      isPublic: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const onSave = vi.fn().mockResolvedValue(undefined);
    const initialDraft = buildPlaceAddToListDraft(sourcePlace);
    const { usePlaceEditorState } = await import(
      '@/mobile/app/features/map/application/usePlaceEditorState'
    );
    const hook = renderHook(() => usePlaceEditorState({
      visible: true,
      lat: sourcePlace.lat,
      lng: sourcePlace.lng,
      placeName: sourcePlace.name,
      placeAddress: sourcePlace.address,
      lists: [targetList],
      draft: initialDraft,
      onSave,
    }));

    expect(hook.result.current).toMatchObject({
      step: 2,
      name: 'Kart Mekani',
      title: 'Kart basligi',
      menuUrl: 'https://example.com/menu',
      address: 'Kart adresi',
      notes: 'Kart notu',
      rating: 4.5,
      selectedCategories: ['coffee', 'dessert'],
      selectedLists: [],
      media: [],
      bestTimes: ['morning'],
      atmosphere: ['quiet'],
      features: ['WiFi'],
    });

    act(() => {
      hook.result.current.toggleList(targetList.id);
    });
    await act(async () => {
      await hook.result.current.handleSave();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Kart Mekani',
        title: 'Kart basligi',
        menuUrl: 'https://example.com/menu',
        lat: 41,
        lng: 29,
        address: 'Kart adresi',
        notes: 'Kart notu',
        rating: 4.5,
        categories: ['coffee', 'dessert'],
        studentDiscount: true,
        priceMin: 100,
        priceMax: 200,
        bestTimes: ['morning'],
        atmosphere: ['quiet'],
        specialFeatures: ['WiFi'],
        media: [],
        photos: [],
        addedBy: undefined,
        sourceAttribution: undefined,
      }),
      ['target-list'],
      expect.objectContaining({ onProgress: expect.any(Function) }),
    );
    expect(beginProgressMock).toHaveBeenCalledOnce();

    hook.unmount();
  });

  it('keeps the prefilled place while creating and selecting a new target list', async () => {
    const sourcePlace: Place = {
      id: 'source-place',
      name: 'Yeni Liste Mekani',
      lat: 40,
      lng: 30,
      address: 'Ankara',
      categories: ['restaurant'],
      addedAt: '2026-01-01T00:00:00.000Z',
    };
    let lists: PlaceList[] = [];
    const onCreateList = vi.fn().mockImplementation(async (list: PlaceList) => {
      lists = [...lists, list];
    });
    const onSave = vi.fn().mockResolvedValue(undefined);
    const initialDraft = buildPlaceAddToListDraft(sourcePlace);
    const { usePlaceEditorState } = await import(
      '@/mobile/app/features/map/application/usePlaceEditorState'
    );
    const params: Parameters<typeof usePlaceEditorState>[0] = {
      visible: true,
      lat: sourcePlace.lat,
      lng: sourcePlace.lng,
      placeName: sourcePlace.name,
      placeAddress: sourcePlace.address,
      lists,
      draft: initialDraft,
      onCreateList,
      onSave,
    };
    const hook = renderHook(() => usePlaceEditorState(params));

    act(() => {
      hook.result.current.setShowNewListForm(true);
      hook.result.current.setNewListName('Hafta Sonu');
    });
    await act(async () => {
      await hook.result.current.handleCreateList();
    });

    expect(onCreateList).toHaveBeenCalledWith(expect.objectContaining({
      id: 'generated-list',
      name: 'Hafta Sonu',
      places: [],
      isPublic: false,
    }));
    params.lists = lists;
    hook.rerender();
    expect(hook.result.current.selectedLists).toEqual(['generated-list']);
    expect(hook.result.current.name).toBe('Yeni Liste Mekani');

    await act(async () => {
      await hook.result.current.handleSave();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Yeni Liste Mekani', address: 'Ankara' }),
      ['generated-list'],
      expect.any(Object),
    );
    hook.unmount();
  });

  it('keeps duplicate protection tied to the source card after a draft rename', async () => {
    const sourcePlace: Place = {
      id: 'source-place',
      name: 'Özgür Kafe',
      lat: 41,
      lng: 29,
      addedAt: '2026-01-01T00:00:00.000Z',
    };
    const duplicateList: PlaceList = {
      id: 'duplicate-list',
      userId: 'viewer',
      name: 'Favoriler',
      places: [{ ...sourcePlace, id: 'saved-copy' }],
      isPublic: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const renamedDraft = {
      ...buildPlaceAddToListDraft(sourcePlace),
      name: 'Taslakta değiştirilmiş ad',
    };
    const { usePlaceEditorState } = await import(
      '@/mobile/app/features/map/application/usePlaceEditorState'
    );
    const hook = renderHook(() => usePlaceEditorState({
      visible: true,
      lat: sourcePlace.lat,
      lng: sourcePlace.lng,
      placeName: sourcePlace.name,
      lists: [duplicateList],
      draft: renamedDraft,
      onSave: vi.fn(),
    }));

    expect([...hook.result.current.duplicateListIds]).toEqual(['duplicate-list']);
    expect(hook.result.current.name).toBe('Taslakta değiştirilmiş ad');

    hook.unmount();
  });
});
