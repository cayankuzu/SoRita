import { describe, expect, it } from 'vitest';

import { hasTruncatedPersonalDataCollection } from '@/mobile/app/data/repositories/personalDataExportMetadata';

describe('personal data export metadata', () => {
  it('detects nested truncation flags without treating false metadata as partial', () => {
    expect(hasTruncatedPersonalDataCollection(undefined)).toBe(false);
    expect(hasTruncatedPersonalDataCollection({ lists: false, follows: { followers: false } }))
      .toBe(false);
    expect(hasTruncatedPersonalDataCollection({ lists: false, follows: { followers: true } }))
      .toBe(true);
  });
});
