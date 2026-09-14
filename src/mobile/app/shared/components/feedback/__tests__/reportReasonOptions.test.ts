import { describe, expect, it } from 'vitest';

import { getReportReasonsForTarget } from '@/mobile/app/shared/components/feedback/reportReasonOptions';

const reasons = ['Yanlış konum', 'Uygunsuz içerik', 'Spam', 'Diğer'] as const;

describe('getReportReasonsForTarget', () => {
  it('keeps the location reason only for place reports', () => {
    expect(getReportReasonsForTarget(reasons, 'place')).toEqual(reasons);

    for (const targetType of ['comment', 'list', 'profile'] as const) {
      expect(getReportReasonsForTarget(reasons, targetType)).toEqual([
        'Uygunsuz içerik',
        'Spam',
        'Diğer',
      ]);
    }
  });

  it('returns a new array without mutating the shared translation list', () => {
    const result = getReportReasonsForTarget(reasons, 'place');

    expect(result).not.toBe(reasons);
    expect(reasons).toEqual(['Yanlış konum', 'Uygunsuz içerik', 'Spam', 'Diğer']);
  });
});
