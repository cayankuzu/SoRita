import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useExploreScreenStateMock = vi.fn();

vi.mock('@react-navigation/native', () => ({
  useScrollToTop: vi.fn(),
}));

vi.mock('lucide-react-native', () => ({
  Camera: () => null,
  List: () => null,
  MapPin: () => null,
  Search: () => null,
  Users: () => null,
  X: () => null,
}));

vi.mock('@/mobile/app/app-shell/auth/AuthSessionProvider', () => ({
  useAuth: () => ({ user: { id: 'viewer', name: 'Viewer' } }),
}));

vi.mock('@/mobile/app/app-shell/navigation/navigation', () => ({
  openStackScreen: vi.fn(),
  useAppNavigation: () => ({}),
}));

vi.mock('@/mobile/app/app-shell/startup/startupDataWarmup', () => ({
  warmListDetailData: vi.fn(),
  warmUserProfileData: vi.fn(),
}));

vi.mock('@/mobile/app/data/query/queryClient', () => ({ queryClient: {} }));

vi.mock('@/mobile/app/features/explore/application/useExploreScreenState', () => ({
  useExploreScreenState: useExploreScreenStateMock,
}));

vi.mock('@/mobile/app/features/explore/ui/components/ExploreFeedView', () => ({
  ExploreFeedView: () => null,
}));

vi.mock('@/mobile/app/features/explore/ui/components/ExploreResultsPage', () => ({
  ExploreResultsPage: () => null,
}));

vi.mock('@/mobile/app/shared/components/navigation/SwipeableTabPager', () => ({
  SwipeableTabPager: (props: Record<string, unknown>) =>
    React.createElement('SwipeableTabPager', props),
}));

vi.mock('@/mobile/app/shared/components/ui/InlineNotice', () => ({
  InlineNotice: () => null,
}));

vi.mock('@/mobile/app/shared/components/ui/InstantPressable', () => ({
  InstantPressable: (props: Record<string, unknown>) =>
    React.createElement('InstantPressable', props),
}));

vi.mock('@/mobile/app/shared/components/ui/Screen', () => ({
  Screen: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/mobile/app/shared/components/ui/SkeletonPlaceholder', () => ({
  ListGridTileSkeleton: () => null,
  SkeletonGroup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/mobile/app/shared/hooks/useAppLayout', () => ({
  useAppLayout: () => ({ screenPadding: 12 }),
}));

vi.mock('@/mobile/app/shared/hooks/useTabScrollMemory', () => ({
  useTabScrollMemory: () => ({
    getTabScrollRef: vi.fn(() => null),
    getTabScrollRefCallback: vi.fn(() => vi.fn()),
    notifyTabContentReady: vi.fn(),
    recordTabScrollOffset: vi.fn(),
    restoreTabScrollOffset: vi.fn(),
  }),
}));

vi.mock('@/mobile/app/shared/performance/useScreenPerformanceMetric', () => ({
  useScreenPerformanceMetric: vi.fn(),
}));

describe('ExploreScreen swipe result context', () => {
  beforeEach(() => {
    useExploreScreenStateMock.mockReset();
    useExploreScreenStateMock.mockImplementation(
      ({ activeTab }: { activeTab: string }) => ({
        debouncedSearchQuery: 'kahve',
        errorMessage: null,
        filteredListItems: [
          { list: { id: 'list-1' } },
          { list: { id: 'list-2' } },
        ],
        filteredPhotos: [],
        filteredPlaces: [],
        filteredUsers: activeTab === 'people' ? [{ id: 'person-1' }] : [],
        followUser: vi.fn(),
        following: [],
        hasPartialDataError: false,
        isInitialLoading: false,
        onRefresh: vi.fn(),
        pendingFollowRequests: [],
        queryStateByTab: {
          lists: { hasNextPage: false, isFetchingNextPage: false },
          people: { hasNextPage: false, isFetchingNextPage: false },
          photos: { hasNextPage: false, isFetchingNextPage: false },
          places: { hasNextPage: false, isFetchingNextPage: false },
        },
        refreshing: false,
        retry: vi.fn(),
      }),
    );
  });

  it('suppresses preview results and announces the settled tab count', async () => {
    const { ExploreScreen } = await import(
      '@/mobile/app/features/explore/ui/screens/ExploreScreen'
    );
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<ExploreScreen />);
    });
    act(() => {
      renderer.root.find(
        (node) => String(node.type) === 'TextInput',
      ).props.onChangeText('kahve');
    });

    expect(String(renderer.root.find(
      (node) => node.props.accessibilityLiveRegion === 'polite',
    ).props.children)).toContain('2');

    act(() => {
      renderer.root.find(
        (node) => String(node.type) === 'SwipeableTabPager',
      ).props.onPreviewTabChange('people');
    });

    const previewTabs = renderer.root.findAll(
      (node) =>
        String(node.type) === 'InstantPressable' &&
        node.props.accessibilityRole === 'tab',
    );
    expect(
      previewTabs.findIndex(
        (node) => node.props.accessibilityState?.selected === true,
      ),
    ).toBe(3);
    expect(renderer.root.findAll(
      (node) => node.props.accessibilityLiveRegion === 'polite',
    )).toHaveLength(0);
    expect(renderer.root.find(
      (node) => String(node.type) === 'TextInput',
    ).props.accessibilityState).toEqual({ busy: true });

    act(() => {
      renderer.root.find(
        (node) => String(node.type) === 'SwipeableTabPager',
      ).props.onChange('people');
    });

    expect(String(renderer.root.find(
      (node) => node.props.accessibilityLiveRegion === 'polite',
    ).props.children)).toContain('1');
    expect(renderer.root.find(
      (node) => String(node.type) === 'TextInput',
    ).props.accessibilityState).toEqual({ busy: false });
  });
});
