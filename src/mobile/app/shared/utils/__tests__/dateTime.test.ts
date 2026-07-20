import { describe, expect, it } from 'vitest';

import { getCreatedUpdatedLabels } from '@/mobile/app/shared/utils/dateTime';

describe('getCreatedUpdatedLabels', () => {
  it('shows creation and meaningful edit information together', () => {
    const labels = getCreatedUpdatedLabels(
      '2026-07-13T14:08:00.000Z',
      '2026-07-13T14:11:00.000Z',
    );

    expect(labels).toHaveLength(2);
    expect(labels[0]).toMatch(/^Oluşturma:/);
    expect(labels[1]).toMatch(/^Düzenleme:/);
  });

  it('shows only creation when there is no meaningful edit', () => {
    const createdAt = '2026-07-13T14:08:00.000Z';

    expect(getCreatedUpdatedLabels(createdAt, createdAt)).toEqual([
      expect.stringMatching(/^Oluşturma:/),
    ]);
  });
});
