import { describe, expect, it } from 'vitest';

import { colors } from '@/mobile/app/shared/theme/tokens';
import {
  getMarkerColorForMemberships,
  getMarkerColorForPlaceAcrossLists,
} from '@/mobile/app/shared/utils/format';

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
