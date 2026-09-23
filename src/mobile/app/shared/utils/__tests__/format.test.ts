import { describe, expect, it } from 'vitest';

import { colors } from '@/mobile/app/shared/theme/tokens';
import {
  formatPlaceCardLocation,
  getMarkerColorForMemberships,
  getMarkerColorForPlaceAcrossLists,
} from '@/mobile/app/shared/utils/format';

describe('place card location formatter', () => {
  it('formats the city and district from a full address', () => {
    expect(formatPlaceCardLocation('Moda Cd. 12, Kadıköy, İstanbul')).toBe(
      'İstanbul · Kadıköy',
    );
  });

  it('removes a trailing country and postal code', () => {
    expect(formatPlaceCardLocation('Caferağa, 34710 Kadıköy, İstanbul, Türkiye')).toBe(
      'İstanbul · Kadıköy',
    );
  });

  it('keeps only district and city when street details follow a slash location', () => {
    expect(
      formatPlaceCardLocation('34710 Kadıköy/İstanbul, Hacı Şükrü Sk. No:9'),
    ).toBe('İstanbul · Kadıköy');
    expect(
      formatPlaceCardLocation('Kadıköy/İstanbul · Hacı Şükrü Sk. No:9'),
    ).toBe('İstanbul · Kadıköy');
  });

  it('does not mistake a door number with a slash for district and city', () => {
    expect(
      formatPlaceCardLocation('Eskibağlar, Gençlik Mrk. Sk. No:2/27, 26000 Tepebaşı/Eskişehir, Türkiye'),
    ).toBe('Eskişehir · Tepebaşı');
    expect(
      formatPlaceCardLocation('Karacaoğlan, Kemalpaşa Cd. 285/3H, 35070 Bornova/İzmir, Türkiye'),
    ).toBe('İzmir · Bornova');
    expect(
      formatPlaceCardLocation(
        'Caferağa, Nail Bey Sk. No: 15/A, 34710 Kadıköy, Caferağa, 34710 Kadıköy/İstanbul, Türkiye',
      ),
    ).toBe('İstanbul · Kadıköy');
  });

  it('shows the neighbourhood, never the street, when an address has no city', () => {
    expect(formatPlaceCardLocation('Kadife Sokak No:18, Caferağa')).toBe('Caferağa');
    expect(formatPlaceCardLocation('Bağdat Caddesi, Kadıköy')).toBe('Kadıköy');
    expect(formatPlaceCardLocation('Lara Cd. No:78')).toBeNull();
  });

  it('returns a single available location and hides empty values', () => {
    expect(formatPlaceCardLocation('Ankara')).toBe('Ankara');
    expect(formatPlaceCardLocation()).toBeNull();
  });
});

describe('format marker helpers', () => {
  it('returns public, private, and mixed marker colors from memberships', () => {
    expect(getMarkerColorForMemberships([{ listIsPublic: true }], true)).toBe(colors.visibilityPublic);
    expect(getMarkerColorForMemberships([{ listIsPublic: false }], true)).toBe(colors.visibilityPrivate);
    expect(
      getMarkerColorForMemberships(
        [{ listIsPublic: true }, { listIsPublic: false }],
        true,
      ),
    ).toBe(colors.visibilityMixed);
  });

  it('resolves a mixed marker color when the same place exists in public and private lists', () => {
    const targetPlace = {
      name: 'Salt Fried Chicken Kadikoy',
      lat: 40.99,
      lng: 29.02,
    };

    expect(
      getMarkerColorForPlaceAcrossLists(targetPlace, [
        {
          isPublic: true,
          places: [{ ...targetPlace }],
        },
        {
          isPublic: false,
          places: [{ ...targetPlace, name: '  salt fried chicken kadikoy  ' }],
        },
      ]),
    ).toBe(colors.visibilityMixed);
  });
});
