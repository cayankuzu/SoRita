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
});
