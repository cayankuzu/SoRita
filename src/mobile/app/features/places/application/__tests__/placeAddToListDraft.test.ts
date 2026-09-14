import { describe, expect, it } from 'vitest';

import type { Place } from '@/mobile/app/data/contracts/entities';
import { buildPlaceAddToListDraft } from '@/mobile/app/features/places/application/placeAddToListDraft';

describe('buildPlaceAddToListDraft', () => {
  it('carries the source card metadata into a new-place draft at list selection', () => {
    const place: Place = {
      id: 'source-place',
      name: 'Kaynak Mekan',
      title: 'Kisa baslik',
      menuUrl: 'https://example.com/menu',
      lat: 41.01,
      lng: 29.02,
      address: 'Kadikoy, Istanbul',
      notes: 'Sessiz masa arka tarafta.',
      rating: 4.5,
      category: 'fallback-category',
      categories: ['coffee', 'dessert'],
      studentDiscount: true,
      priceMin: 120,
      priceMax: 240,
      bestTime: 'fallback-time',
      bestTimes: ['morning', 'afternoon'],
      atmosphere: ['cozy'],
      specialFeatures: ['WiFi', 'Outdoor seating'],
      media: [{ type: 'photo', url: 'sorita-storage://place-media-private/source/media.jpg' }],
      addedAt: '2026-01-01T00:00:00.000Z',
    };

    const draft = buildPlaceAddToListDraft(place);

    expect(draft).toMatchObject({
      step: 2,
      name: 'Kaynak Mekan',
      title: 'Kisa baslik',
      menuUrl: 'https://example.com/menu',
      address: 'Kadikoy, Istanbul',
      notes: 'Sessiz masa arka tarafta.',
      selectedCategories: ['coffee', 'dessert'],
      rating: 4.5,
      studentFriendly: true,
      priceMin: '120',
      priceMax: '240',
      selectedLists: [],
      bestTimes: ['morning', 'afternoon'],
      atmosphere: ['cozy'],
      features: ['WiFi', 'Outdoor seating'],
      newListName: '',
      newListDescription: '',
      newListCoverImage: '',
      newListPublic: false,
      showNewListForm: false,
    });
    expect(draft.media).toEqual([]);
    expect(draft.photos).toEqual([]);
  });

  it('uses legacy single-value metadata as fallbacks', () => {
    const draft = buildPlaceAddToListDraft({
      id: 'legacy-place',
      name: 'Legacy',
      lat: 40,
      lng: 30,
      category: 'coffee',
      bestTime: 'evening',
      addedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(draft.selectedCategories).toEqual(['coffee']);
    expect(draft.bestTimes).toEqual(['evening']);
  });
});
