import { describe, expect, it } from 'vitest';

import {
  formatRelativeDateTime,
  getCreatedUpdatedLabels,
} from '@/mobile/app/shared/utils/dateTime';

const now = new Date('2026-07-13T14:08:00.000Z');
const minutesAgo = (count: number) =>
  new Date(now.getTime() - count * 60_000).toISOString();

describe('formatRelativeDateTime', () => {
  it('reads as elapsed time inside the last week', () => {
    expect(formatRelativeDateTime(minutesAgo(0.5), now)).toBe('Az önce');
    expect(formatRelativeDateTime(minutesAgo(7), now)).toBe('7 dk önce');
    expect(formatRelativeDateTime(minutesAgo(60 * 3), now)).toBe('3 saat önce');
    expect(formatRelativeDateTime(minutesAgo(60 * 24 * 6), now)).toBe('6 gün önce');
  });

  it('falls back to a calendar date once elapsed time stops being useful', () => {
    expect(formatRelativeDateTime(minutesAgo(60 * 24 * 7), now)).toBe('06.07.2026');
  });

  it('never renders a negative age when a device clock runs behind', () => {
    expect(formatRelativeDateTime(minutesAgo(-5), now)).toBe('Az önce');
  });

  it('stays empty for missing or invalid input', () => {
    expect(formatRelativeDateTime(null, now)).toBe('');
    expect(formatRelativeDateTime('not-a-date', now)).toBe('');
  });
});

describe('getCreatedUpdatedLabels', () => {
  it('shows creation and meaningful edit information together', () => {
    const labels = getCreatedUpdatedLabels(
      '2026-07-13T14:08:00.000Z',
      '2026-07-13T14:11:00.000Z',
    );

    expect(labels).toHaveLength(2);
    expect(labels[0]).not.toMatch(/^Oluşturma:/);
    // The label must not carry its own separator: the caller joins with " · ",
    // and two of them made the word read as a standalone metadata item.
    expect(labels[1]).toMatch(/^düzenlendi \d/u);
    expect(labels[1]).not.toContain('·');
  });

  it('shows only creation when there is no meaningful edit', () => {
    const createdAt = '2026-07-13T14:08:00.000Z';

    expect(getCreatedUpdatedLabels(createdAt, createdAt)).toHaveLength(1);
  });
});
