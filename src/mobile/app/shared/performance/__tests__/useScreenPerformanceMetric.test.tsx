import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook } from '@/mobile/app/test/hookTestUtils';

const trackEventMock = vi.fn();

vi.mock('@/mobile/app/platform/analytics/analyticsEvents', () => ({
  trackEvent: trackEventMock,
}));

vi.mock('@/mobile/app/shared/utils/interaction', () => ({
  runAfterNextPaint: (callback: () => void) => {
    callback();
    return vi.fn();
  },
}));

describe('useScreenPerformanceMetric', () => {
  beforeEach(() => {
    trackEventMock.mockReset();
  });

  it('records one terminal state and one interactive marker', async () => {
    let isLoading = true;
    const { useScreenPerformanceMetric } = await import('../useScreenPerformanceMetric');
    const hook = renderHook(() => useScreenPerformanceMetric({
      hasContent: true,
      hasError: true,
      isLoading,
      screen: 'profile',
    }));

    expect(trackEventMock).not.toHaveBeenCalled();
    isLoading = false;
    hook.rerender();
    hook.rerender();

    expect(trackEventMock).toHaveBeenCalledTimes(2);
    expect(trackEventMock).toHaveBeenNthCalledWith(1, {
      name: 'screen_first_content',
      params: expect.objectContaining({
        screen: 'profile',
        terminalState: 'degraded',
      }),
    });
    expect(trackEventMock).toHaveBeenNthCalledWith(2, {
      name: 'screen_interactive',
      params: expect.objectContaining({ screen: 'profile' }),
    });
  });
});
