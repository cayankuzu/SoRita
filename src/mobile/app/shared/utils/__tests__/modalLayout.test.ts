import { describe, expect, it } from 'vitest';

import { getModalSafeAreaPadding } from '@/mobile/app/shared/utils/modalLayout';

describe('getModalSafeAreaPadding', () => {
  it('adds base spacing on top of safe-area insets', () => {
    expect(
      getModalSafeAreaPadding({
        topInset: 24,
        bottomInset: 12,
        topSpacing: 20,
        bottomSpacing: 12,
      }),
    ).toEqual({
      paddingTop: 44,
      paddingBottom: 24,
    });
  });

  it('honors minimum top and bottom paddings', () => {
    expect(
      getModalSafeAreaPadding({
        topInset: 0,
        bottomInset: 0,
        topSpacing: 12,
        bottomSpacing: 8,
        minTopPadding: 20,
        minBottomPadding: 28,
      }),
    ).toEqual({
      paddingTop: 20,
      paddingBottom: 28,
    });
  });
});
