import { describe, expect, it } from 'vitest';

import { QUIET_BASEMAP_RULES, quietBasemapStaticParams } from '@/mobile/app/shared/utils/quietBasemap';

describe('quiet basemap', () => {
  it('turns every native rule into one Static Maps style parameter', () => {
    expect(quietBasemapStaticParams()).toEqual([
      'feature:poi.business|visibility:off',
      'feature:transit|element:labels.icon|visibility:off',
    ]);
    expect(quietBasemapStaticParams()).toHaveLength(QUIET_BASEMAP_RULES.length);
  });

  it('keeps roads, parks and place names', () => {
    const hidden = QUIET_BASEMAP_RULES.map((rule) => rule.featureType);

    expect(hidden).not.toContain('road');
    expect(hidden).not.toContain('poi.park');
    expect(hidden).not.toContain('administrative');
  });
});
