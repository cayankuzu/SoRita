import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useAuthMock = vi.fn();
const useHomeFeedScreenStateMock = vi.fn();
const navigateMock = vi.fn();
const openStackScreenMock = vi.fn();
const buildAdaptiveFlatListPropsMock = vi.fn(() => ({}));
const prefetchAppImagesMock = vi.fn().mockResolvedValue(true);

vi.mock('@/mobile/app/app-shell/startup/startupDataWarmup', () => ({
  warmListDetailData: vi.fn(),
  warmUserProfileData: vi.fn(),
}));

vi.mock('@/mobile/app/data/query/queryClient', () => ({
  queryClient: {},
}));

vi.mock('@react-navigation/native', () => ({
  useScrollToTop: vi.fn(),
}));

vi.mock('lucide-react-native', () => ({
  MapPin: () => null,
  Users: () => null,
}));

vi.mock('@/mobile/app/app-shell/auth/AuthSessionProvider', () => ({
  useAuth: useAuthMock,
}));

vi.mock('@/mobile/app/app-shell/navigation/navigation', () => ({
  openStackScreen: openStackScreenMock,
  useAppNavigation: () => ({
    navigate: navigateMock,
  }),
}));

vi.mock('@/mobile/app/features/home/application/useHomeFeedScreenState', () => ({
  useHomeFeedScreenState: useHomeFeedScreenStateMock,
}));

vi.mock('@/mobile/app/features/places/public/components', () => ({
  PlaceCard: () => null,
}));

vi.mock('@/mobile/app/shared/components/ui/EmptyState', () => ({
  EmptyState: () => null,
}));

vi.mock('@/mobile/app/shared/components/ui/AppImage', () => ({
  AppImage: () => null,
  prefetchAppImages: prefetchAppImagesMock,
}));

vi.mock('@/mobile/app/shared/components/ui/InlineNotice', () => ({
  InlineNotice: (props: Record<string, unknown>) =>
    React.createElement('InlineNotice', props),
}));

vi.mock('@/mobile/app/shared/components/ui/Screen', () => ({
  Screen: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/mobile/app/shared/i18n/tr', () => ({
  tr: {
    common: {
      loading: 'Yukleniyor',
      loadingMore: 'Daha fazlasi yukleniyor',
      retry: 'Tekrar dene',
    },
    categories: {
      other: 'Diger',
    },
    home: {
      exploreCta: 'Kesfet',
      noFeedDescription: 'Desc',
      noFeedTitle: 'Title',
      noFollowingDescription: 'Desc',
      noFollowingTitle: 'Title',
      partialDataDescription: 'Kayitli akis gosteriliyor',
      partialDataRetry: 'Simdi dene',
      partialDataTitle: 'Bazi guncellemeler tamamlanamadi',
    },
  },
}));

vi.mock('@/mobile/app/shared/utils/flatList', () => ({
  buildAdaptiveFlatListProps: buildAdaptiveFlatListPropsMock,
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    useHomeFeedScreenStateMock.mockReset();
    buildAdaptiveFlatListPropsMock.mockClear();
    navigateMock.mockReset();
    openStackScreenMock.mockReset();
    prefetchAppImagesMock.mockClear();
  });

  it('shows a loading state instead of a blank screen while auth context settles', async () => {
    useAuthMock.mockReturnValue({ user: null });
    useHomeFeedScreenStateMock.mockReturnValue({
      errorMessage: null,
      fetchNextPage: undefined,
      feedItems: [],
      followingCount: 0,
      hasNextPage: false,
      hasPartialDataError: false,
      isInitialLoading: false,
      isFetchingNextPage: false,
      onRefresh: vi.fn(),
      refreshing: false,
      retry: vi.fn(),
    });

    const { HomeScreen } = await import('@/mobile/app/features/home/ui/screens/HomeScreen');
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<HomeScreen />);
    });

    expect(
      renderer.root.findAll(
        (node) =>
          String(node.type) === 'View' &&
          node.props.accessibilityRole === 'progressbar' &&
          node.props.accessibilityState?.busy === true,
      ).length,
    ).toBeGreaterThan(0);
  });

  it('keeps hook order stable when loading resolves on rerender', async () => {
    const retryMock = vi.fn().mockResolvedValue(undefined);
    const onRefreshMock = vi.fn();
    const user = {
      id: 'viewer-1',
      email: 'viewer@example.com',
      name: 'Viewer',
      username: 'viewer',
    };
    const loadingState = {
      errorMessage: null,
      fetchNextPage: undefined,
      feedItems: [],
      followingCount: 0,
      hasNextPage: false,
      hasPartialDataError: false,
      isInitialLoading: true,
      isFetchingNextPage: false,
      onRefresh: onRefreshMock,
      refreshing: false,
      retry: retryMock,
    };
    const loadedState = {
      ...loadingState,
      feedItems: [{
        key: 'item-1',
        listCoverImage: 'https://cdn.example/list.jpg',
        owner: { profilePhoto: 'https://cdn.example/avatar.jpg' },
        place: {
          media: [
            { type: 'photo', thumbnailUrl: 'https://cdn.example/thumb.jpg', url: 'https://cdn.example/photo.jpg' },
          ],
        },
      }],
      isInitialLoading: false,
    };
    let isLoaded = false;

    useAuthMock.mockReturnValue({ user });
    useHomeFeedScreenStateMock.mockImplementation(() => (isLoaded ? loadedState : loadingState));

    const { HomeScreen } = await import('@/mobile/app/features/home/ui/screens/HomeScreen');
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<HomeScreen />);
    });

    expect(buildAdaptiveFlatListPropsMock).toHaveBeenCalledTimes(1);

    isLoaded = true;

    expect(() => {
      act(() => {
        renderer.update(<HomeScreen />);
      });
    }).not.toThrow();

    expect(buildAdaptiveFlatListPropsMock).toHaveBeenCalledTimes(2);
    expect(prefetchAppImagesMock).not.toHaveBeenCalled();
  });

  it('shows cached-data recovery and announces pagination progress', async () => {
    const retryMock = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      user: {
        id: 'viewer-1',
        email: 'viewer@example.com',
        name: 'Viewer',
        username: 'viewer',
      },
    });
    useHomeFeedScreenStateMock.mockReturnValue({
      errorMessage: 'network error',
      fetchNextPage: vi.fn(),
      feedItems: [{
        key: 'item-1',
        listCoverImage: undefined,
        owner: null,
        place: { id: 'place-1', media: [] },
      }],
      followingCount: 1,
      hasNextPage: true,
      hasPartialDataError: true,
      isInitialLoading: false,
      isFetchingNextPage: true,
      isShowingStartupCache: true,
      onRefresh: vi.fn(),
      refreshing: false,
      retry: retryMock,
    });

    const { HomeScreen } = await import('@/mobile/app/features/home/ui/screens/HomeScreen');
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<HomeScreen />);
    });

    const list = renderer.root.find(
      (node) => String(node.type) === 'FlatList',
    );
    const notice = list.props.ListHeaderComponent.props.children;
    expect(notice.props.onAction).toBe(retryMock);
    expect(list.props.accessibilityState).toEqual({ busy: true });
    expect(list.props.ListFooterComponent.props.accessibilityLiveRegion).toBe('polite');
    expect(list.props.ListFooterComponent.props.accessibilityState).toEqual({ busy: true });
  });
});
