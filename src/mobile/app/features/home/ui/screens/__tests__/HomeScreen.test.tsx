import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useAuthMock = vi.fn();
const useHomeFeedScreenStateMock = vi.fn();
const navigateMock = vi.fn();
const openStackScreenMock = vi.fn();
const buildAdaptiveFlatListPropsMock = vi.fn(() => ({}));

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

vi.mock('@/mobile/app/shared/components/ui/InlineNotice', () => ({
  InlineNotice: () => null,
}));

vi.mock('@/mobile/app/shared/components/ui/Screen', () => ({
  Screen: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/mobile/app/shared/i18n/tr', () => ({
  tr: {
    home: {
      exploreCta: 'Kesfet',
      noFeedDescription: 'Desc',
      noFeedTitle: 'Title',
      noFollowingDescription: 'Desc',
      noFollowingTitle: 'Title',
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
      feedItems: [{ key: 'item-1' }],
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
  });
});
