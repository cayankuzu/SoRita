import { describe, expect, it } from 'vitest';

import { PLACE_DIETARY_OPTIONS } from '@/mobile/app/catalog/placeOptions';
import {
  buildPlaceEditorDraft,
  buildPlaceSavePayload,
  buildPreviewBestTimes,
  buildPreviewCategories,
  buildPreviewDietaryOptions,
  buildPreviewGeneralFeatures,
  buildPreviewPlace,
  buildPreviewPriceLabel,
} from '@/mobile/app/features/map/application/placeEditorPreview';

describe('placeEditorPreview', () => {
  it('builds a preview place and save payload from editor input', () => {
    const dietaryOption = PLACE_DIETARY_OPTIONS[0] ?? 'Vegan secenek';
    const previewPlace = buildPreviewPlace({
      lat: 1,
      lng: 2,
      name: ' Cafe ',
      title: 'Brunch',
      menuUrl: 'menu.example.com/ankara',
      address: ' Address ',
      notes: ' Nice ',
      rating: 4,
      selectedCategories: ['coffee'],
      studentFriendly: true,
      priceMin: '120',
      priceMax: '180',
      bestTimes: ['morning'],
      atmosphere: ['cozy'],
      features: [dietaryOption, 'WiFi'],
      photos: ['photo-1'],
      placeName: 'Fallback',
    });

    expect(previewPlace.name).toBe('Cafe');
    expect(previewPlace.menuUrl).toBe('https://menu.example.com/ankara');
    expect(buildPreviewCategories(previewPlace)).toEqual(['coffee']);
    expect(buildPreviewBestTimes(previewPlace)).toEqual(['morning']);
    expect(buildPreviewDietaryOptions(previewPlace)).toEqual([dietaryOption]);
    expect(buildPreviewGeneralFeatures(previewPlace)).toEqual(['WiFi']);
    expect(buildPreviewPriceLabel(previewPlace)).toContain('120');

    expect(
      buildPlaceSavePayload({
        lat: 1,
        lng: 2,
        name: ' Cafe ',
        title: 'Brunch',
        menuUrl: 'menu.example.com/ankara',
        address: ' Address ',
        notes: ' Nice ',
        rating: 4,
        selectedCategories: ['coffee'],
        studentFriendly: true,
        priceMin: '120',
        priceMax: '180',
        bestTimes: ['morning'],
        atmosphere: ['cozy'],
        features: [dietaryOption, 'WiFi'],
        photos: ['photo-1'],
      }),
    ).toMatchObject({
      name: 'Cafe',
      title: 'Brunch',
      menuUrl: 'https://menu.example.com/ankara',
      address: 'Address',
      notes: 'Nice',
      priceMin: 120,
      priceMax: 180,
      studentDiscount: true,
    });
  });

  it('builds a serializable editor draft snapshot', () => {
    expect(
      buildPlaceEditorDraft({
        step: 2,
        name: 'Cafe',
        title: '',
        menuUrl: '',
        address: '',
        notes: '',
        selectedCategories: ['coffee'],
        rating: 5,
        studentFriendly: false,
        priceMin: '',
        priceMax: '',
        selectedLists: ['list-1'],
        photos: [],
        bestTimes: [],
        atmosphere: [],
        features: [],
        newListName: '',
        newListDescription: '',
        newListCoverImage: '',
        newListPublic: true,
        showNewListForm: false,
      }),
    ).toMatchObject({
      step: 2,
      name: 'Cafe',
      selectedLists: ['list-1'],
    });
  });

  it('preserves embedded line breaks for title and notes while trimming outer whitespace', () => {
    const previewPlace = buildPreviewPlace({
      lat: 1,
      lng: 2,
      name: 'Cafe',
      title: '  Kat 1\r\nKat 2  ',
      address: 'Address',
      notes: '\r\nA\r\nV\r\nB\r\n',
      rating: 4,
      selectedCategories: ['coffee'],
      studentFriendly: false,
      priceMin: '',
      priceMax: '',
      bestTimes: [],
      atmosphere: [],
      features: [],
      photos: [],
      placeName: 'Fallback',
    });

    expect(previewPlace.title).toBe('Kat 1\nKat 2');
    expect(previewPlace.notes).toBe('A\nV\nB');

    expect(
      buildPlaceSavePayload({
        lat: 1,
        lng: 2,
        name: 'Cafe',
        title: '  Kat 1\r\nKat 2  ',
        address: 'Address',
        notes: '\r\nA\r\nV\r\nB\r\n',
        rating: 4,
        selectedCategories: ['coffee'],
        studentFriendly: false,
        priceMin: '',
        priceMax: '',
        bestTimes: [],
        atmosphere: [],
        features: [],
        photos: [],
      }),
    ).toMatchObject({
      title: 'Kat 1\nKat 2',
      notes: 'A\nV\nB',
    });
  });

  it('uses deterministic fallbacks for sparse previews and optional save fields', () => {
    const base = {
      lat: 1,
      lng: 2,
      name: '',
      title: '',
      address: '',
      notes: '',
      rating: 0,
      selectedCategories: [] as string[],
      studentFriendly: false,
      priceMin: '',
      priceMax: '',
      bestTimes: [] as string[],
      atmosphere: [] as string[],
      features: [] as string[],
    };

    expect(buildPreviewPlace({ ...base, placeName: ' Known place ' }).name).toBe('Known place');
    expect(buildPreviewPlace({ ...base, address: ' Draft address ' }).name).toBe('Draft address');
    expect(buildPreviewPlace({ ...base, placeAddress: ' Existing address ' }).name).toBe(
      'Existing address',
    );

    const sparsePreview = buildPreviewPlace(base);
    expect(sparsePreview.name).toBeTruthy();
    expect(sparsePreview).toMatchObject({
      title: undefined,
      menuUrl: undefined,
      address: undefined,
      notes: undefined,
      category: undefined,
      priceRange: undefined,
      priceMin: undefined,
      priceMax: undefined,
    });
    expect(buildPreviewCategories(sparsePreview)).toEqual([]);
    expect(buildPreviewBestTimes(sparsePreview)).toEqual([]);
    expect(buildPreviewDietaryOptions(sparsePreview)).toEqual([]);
    expect(buildPreviewGeneralFeatures(sparsePreview)).toEqual([]);

    expect(buildPreviewCategories({ ...sparsePreview, category: 'cafe' })).toEqual(['cafe']);
    expect(buildPreviewBestTimes({ ...sparsePreview, bestTime: 'evening' })).toEqual(['evening']);

    const dietaryOption = PLACE_DIETARY_OPTIONS[0] ?? 'Vegan secenek';
    const duplicateFeatures = {
      ...sparsePreview,
      specialFeatures: [dietaryOption, dietaryOption, 'WiFi', 'WiFi'],
    };
    expect(buildPreviewDietaryOptions(duplicateFeatures)).toEqual([dietaryOption]);
    expect(buildPreviewGeneralFeatures(duplicateFeatures)).toEqual(['WiFi']);

    expect(buildPreviewPlace({ ...base, priceMax: '250' })).toMatchObject({
      priceRange: 2,
      priceMin: undefined,
      priceMax: 250,
    });
    expect(buildPreviewPlace({ ...base, priceMin: '100' })).toMatchObject({
      priceRange: 2,
      priceMin: 100,
      priceMax: undefined,
    });

    expect(buildPlaceSavePayload(base)).toMatchObject({
      title: undefined,
      menuUrl: undefined,
      address: undefined,
      notes: undefined,
      category: undefined,
      priceRange: undefined,
      priceMin: undefined,
      priceMax: undefined,
      addedBy: undefined,
      sourceAttribution: undefined,
    });
  });

  it('preserves existing metadata and legacy photos while editing', () => {
    const existingPlace = buildPreviewPlace({
      lat: 1,
      lng: 2,
      name: 'Existing',
      title: '',
      address: '',
      notes: '',
      rating: 4,
      selectedCategories: [],
      studentFriendly: false,
      priceMin: '',
      priceMax: '',
      bestTimes: [],
      atmosphere: [],
      features: [],
      photos: ['https://example.com/existing.jpg'],
    });
    existingPlace.id = 'place-1';
    existingPlace.addedAt = '2026-01-01T00:00:00.000Z';
    existingPlace.addedBy = { userId: 'user-1', userName: 'Test User' };

    const edited = buildPreviewPlace({
      lat: 3,
      lng: 4,
      name: 'Edited',
      title: '',
      address: '',
      placeAddress: 'Stored address',
      notes: '',
      rating: 5,
      selectedCategories: [],
      studentFriendly: false,
      priceMin: '',
      priceMax: '',
      bestTimes: [],
      atmosphere: [],
      features: [],
      existingPlace,
    });

    expect(edited).toMatchObject({
      id: 'place-1',
      addedAt: '2026-01-01T00:00:00.000Z',
      addedBy: { userId: 'user-1', userName: 'Test User' },
      address: 'Stored address',
      photos: ['https://example.com/existing.jpg'],
    });

    expect(
      buildPlaceSavePayload({
        lat: 3,
        lng: 4,
        name: 'Edited',
        title: '',
        address: '',
        notes: '',
        rating: 5,
        selectedCategories: [],
        studentFriendly: false,
        priceMin: '',
        priceMax: '',
        bestTimes: [],
        atmosphere: [],
        features: [],
        existingPlace,
      }),
    ).toMatchObject({
      addedBy: { userId: 'user-1', userName: 'Test User' },
      photos: ['https://example.com/existing.jpg'],
    });
  });
});
