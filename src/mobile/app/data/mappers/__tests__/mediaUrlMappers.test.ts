import { describe, expect, it } from 'vitest';

import {
  arePlacePhotosEqual,
  areStringArraysEqual,
  deepClone,
  isLocalMediaUri,
  isSamePlaceContent,
  normalizeListCoverUrl,
  normalizeStoredMediaUrl,
  uniqueStrings,
} from '@/mobile/app/data/mappers/mediaUrlMappers';

describe('mediaUrlMappers', () => {
  it('normalizes media urls and local uri detection', () => {
    expect(normalizeStoredMediaUrl(' https://cdn.example.com/a.jpg ')).toBe('https://cdn.example.com/a.jpg');
    expect(normalizeStoredMediaUrl('file://local.jpg')).toBeUndefined();
    expect(normalizeListCoverUrl('  ')).toBeUndefined();
    expect(isLocalMediaUri('content://image')).toBe(true);
  });

  it('compares arrays and place content safely', () => {
    expect(uniqueStrings(['wifi', 'wifi', 'coffee'])).toEqual(['wifi', 'coffee']);
    expect(deepClone({ value: 1 })).toEqual({ value: 1 });
    expect(areStringArraysEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(arePlacePhotosEqual(['https://a'], ['https://a'])).toBe(true);
    expect(arePlacePhotosEqual(['file://a'], ['file://a'])).toBe(false);

    const place = {
      id: 'place-1',
      name: 'Cafe',
      lat: 1,
      lng: 2,
      address: 'Address',
      addedAt: '2025-01-01T00:00:00.000Z',
      categories: ['coffee'],
      photos: ['https://cdn.example.com/a.jpg'],
    };

    expect(isSamePlaceContent(place, { ...place })).toBe(true);
    expect(isSamePlaceContent(place, { ...place, name: 'Other' })).toBe(false);
  });
});
