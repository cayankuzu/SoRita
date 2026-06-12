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
});
