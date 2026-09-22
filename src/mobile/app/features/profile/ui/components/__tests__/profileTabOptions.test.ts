import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  Image: 'Image',
  List: 'List',
  MapPin: 'MapPin',
}));

import {
  buildProfileTabOptions,
  resolveProfileTabCount,
} from '@/mobile/app/features/profile/ui/components/profileTabOptions';

describe('resolveProfileTabCount', () => {
  it('uses the server total while pages are still missing', () => {
    // A 24-item first page of a 60-place profile.
    expect(resolveProfileTabCount({ complete: false, loaded: 24, total: 60 })).toBe(60);
  });

  it('shows no number for an unvisited tab that has no server total', () => {
    expect(resolveProfileTabCount({ complete: false, loaded: 0 })).toBeUndefined();
  });

  it('trusts the loaded length once every page is in', () => {
    expect(resolveProfileTabCount({ complete: true, loaded: 7, total: 9 })).toBe(7);
  });
});

describe('buildProfileTabOptions', () => {
  it('keeps the tab order and passes each count through', () => {
    const tabs = buildProfileTabOptions({ gallery: undefined, lists: 7, places: 60 });

    expect(tabs.map((tab) => [tab.key, tab.count])).toEqual([
      ['lists', 7],
      ['places', 60],
      ['gallery', undefined],
    ]);
  });
});
