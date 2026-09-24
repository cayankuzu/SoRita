import { describe, expect, it } from 'vitest';

import { normalizeMapLabelName } from '@/mobile/app/shared/utils/mapLabelName';

describe('normalizeMapLabelName', () => {
  it('keeps the words of a two-line map label apart', () => {
    expect(normalizeMapLabelName('Chobani Stadyumu\nFenerbahçe Şükrü…')).toBe(
      'Chobani Stadyumu Fenerbahçe Şükrü…',
    );
    expect(normalizeMapLabelName('  Kloft \r\n  Kadıköy ')).toBe('Kloft Kadıköy');
  });

  it('leaves a one-line name as it is', () => {
    expect(normalizeMapLabelName('Zeyn Coffee')).toBe('Zeyn Coffee');
  });
});
