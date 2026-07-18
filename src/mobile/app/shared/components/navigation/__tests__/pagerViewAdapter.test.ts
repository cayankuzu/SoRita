import {
  hasNativePagerView,
  loadNativePagerView,
} from '@/mobile/app/shared/components/navigation/pagerViewAdapter';

describe('pagerViewAdapter', () => {
  it('does not load react-native-pager-view when the native manager is unavailable', () => {
    const loadModule = vi.fn(() => ({ default: vi.fn() }));

    expect(loadNativePagerView(loadModule, { getViewManagerConfig: () => null })).toBeNull();
    expect(loadModule).not.toHaveBeenCalled();
  });

  it('detects either native pager view manager name', () => {
    expect(
      hasNativePagerView({
        getViewManagerConfig: (name) => (name === 'RNCViewPager' ? { NativeProps: {} } : null),
      }),
    ).toBe(true);

    expect(
      hasNativePagerView({
        getViewManagerConfig: (name) => (name === 'RCTRNCViewPager' ? { NativeProps: {} } : null),
      }),
    ).toBe(true);
  });

  it('loads the pager module only after native manager detection passes', () => {
    const PagerComponent = vi.fn();
    const loadModule = vi.fn(() => ({ default: PagerComponent }));

    expect(
      loadNativePagerView(loadModule, {
        getViewManagerConfig: (name) => (name === 'RNCViewPager' ? { NativeProps: {} } : null),
      }),
    ).toBe(PagerComponent);
    expect(loadModule).toHaveBeenCalledTimes(1);
  });

  it('falls back safely if native manager lookup throws', () => {
    expect(
      hasNativePagerView({
        getViewManagerConfig: () => {
          throw new Error('ViewManagerRegistry unavailable');
        },
      }),
    ).toBe(false);
  });
});
