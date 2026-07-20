import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setCurrentConnectionStatus } from '@/mobile/app/platform/network/connectivityStatus';

const mocks = vi.hoisted(() => ({
  fetchExplorePage: vi.fn(),
  fetchHomeFeedPage: vi.fn(),
  fetchListDetailHeader: vi.fn(),
  fetchListPlacesPage: vi.fn(),
  fetchOwnedMapMarkers: vi.fn(),
  fetchProfileContentPage: vi.fn(),
  fetchProfileSummary: vi.fn(),
  fetchVisibleDataContext: vi.fn(),
  fetchVisibleListsPage: vi.fn(),
  getNotificationCount: vi.fn(),
  getNotificationsCursorPage: vi.fn(),
  prefetchAppImages: vi.fn(),
}));

vi.mock('@/mobile/app/data/repositories/exploreRepository', () => ({
  fetchExplorePage: mocks.fetchExplorePage,
}));

vi.mock('@/mobile/app/data/repositories/homeFeedRepository', () => ({
  fetchHomeFeedPage: mocks.fetchHomeFeedPage,
}));

vi.mock('@/mobile/app/data/repositories/listDetailRepository', () => ({
  fetchListDetailHeader: mocks.fetchListDetailHeader,
  fetchListPlacesPage: mocks.fetchListPlacesPage,
}));

vi.mock('@/mobile/app/data/repositories/mapMarkersRepository', () => ({
  fetchOwnedMapMarkers: mocks.fetchOwnedMapMarkers,
}));

vi.mock('@/mobile/app/data/repositories/profileRepository', () => ({
  fetchProfileContentPage: mocks.fetchProfileContentPage,
  fetchProfileSummary: mocks.fetchProfileSummary,
}));

vi.mock('@/mobile/app/data/repositories/visibleDataRepository', () => ({
  fetchVisibleDataContext: mocks.fetchVisibleDataContext,
  fetchVisibleListsPage: mocks.fetchVisibleListsPage,
}));

vi.mock('@/mobile/app/data/repositories/notificationRepository', () => ({
  getNotificationCount: mocks.getNotificationCount,
  getNotificationsCursorPage: mocks.getNotificationsCursorPage,
}));

vi.mock('@/mobile/app/shared/components/ui/AppImage', () => ({
  prefetchAppImages: mocks.prefetchAppImages,
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: { debug: vi.fn() },
}));

describe('startupDataWarmup', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mocks.fetchHomeFeedPage.mockResolvedValue({ items: [] });
    mocks.fetchListDetailHeader.mockResolvedValue({
      list: { id: 'list-1', name: 'List' },
      owner: { id: 'user-1', name: 'User' },
      placeCount: 1,
    });
    mocks.fetchListPlacesPage.mockResolvedValue({
      items: [{ id: 'place-1', media: [{ type: 'photo', url: 'photo.jpg' }] }],
    });
    mocks.fetchOwnedMapMarkers.mockResolvedValue([]);
    mocks.fetchExplorePage.mockResolvedValue({
      listItems: [],
      placeItems: [],
      userItems: [],
    });
    mocks.fetchProfileSummary.mockResolvedValue({
      canViewContent: true,
      followerCount: 0,
      followingCount: 0,
      isBlockedByViewer: false,
      isBlockingViewer: false,
      listCount: 0,
      placeCount: 0,
      user: {
        email: '',
        id: 'user-1',
        name: 'User',
        username: 'user',
      },
      viewerHasFollowed: false,
      viewerHasPendingFollowRequest: false,
    });
    mocks.fetchProfileContentPage.mockResolvedValue({ lists: [], places: [] });
    mocks.fetchVisibleDataContext.mockResolvedValue({
      allUsers: [],
      blockRows: [],
      currentUser: null,
      users: [],
    });
    mocks.fetchVisibleListsPage.mockResolvedValue([]);
    mocks.getNotificationsCursorPage.mockResolvedValue([]);
    mocks.getNotificationCount.mockResolvedValue(0);
    mocks.prefetchAppImages.mockResolvedValue(true);
    setCurrentConnectionStatus('online');
  });

  it('warms only the visible startup surface', async () => {
    const { startStartupDataWarmup } = await import('../startupDataWarmup');

    await startStartupDataWarmup({ queryClient, userId: 'user-1' });

    expect(mocks.fetchHomeFeedPage).toHaveBeenCalledOnce();
    expect(mocks.fetchExplorePage).not.toHaveBeenCalled();
    expect(mocks.fetchProfileSummary).not.toHaveBeenCalled();
    expect(mocks.fetchVisibleDataContext).not.toHaveBeenCalled();
    expect(mocks.getNotificationsCursorPage).not.toHaveBeenCalled();
  });

  it('warms a requested surface immediately after user intent', async () => {
    const {
      prioritizeStartupWarmupStage,
      startStartupDataWarmup,
    } = await import('../startupDataWarmup');

    await startStartupDataWarmup({ queryClient, userId: 'user-1' });
    prioritizeStartupWarmupStage('profile');

    await vi.waitFor(() => {
      expect(mocks.fetchProfileSummary).toHaveBeenCalledOnce();
      expect(mocks.fetchProfileContentPage).toHaveBeenCalledOnce();
    });
  });

  it('does not let a slow image block visible data preparation', async () => {
    mocks.prefetchAppImages.mockReturnValue(new Promise(() => undefined));
    const { startStartupDataWarmup } = await import('../startupDataWarmup');

    await startStartupDataWarmup({ queryClient, userId: 'user-1' });

    expect(mocks.fetchHomeFeedPage).toHaveBeenCalledOnce();
    expect(mocks.fetchExplorePage).not.toHaveBeenCalled();
  });

  it('promotes a requested screen independently of the background queue', async () => {
    const { warmScreenData } = await import('../startupDataWarmup');

    await warmScreenData({
      queryClient,
      stage: 'notifications',
      userId: 'user-1',
    });

    expect(mocks.getNotificationsCursorPage).toHaveBeenCalledOnce();
    expect(mocks.getNotificationCount).toHaveBeenCalledOnce();
    expect(mocks.fetchHomeFeedPage).not.toHaveBeenCalled();
    expect(mocks.fetchExplorePage).not.toHaveBeenCalled();
  });

  it('stops adding lower-priority work after cancellation', async () => {
    const { startStartupDataWarmup } = await import('../startupDataWarmup');
    await startStartupDataWarmup({
      isCancelled: () => true,
      queryClient,
      userId: 'user-1',
    });

    expect(mocks.fetchHomeFeedPage).not.toHaveBeenCalled();
    expect(mocks.fetchExplorePage).not.toHaveBeenCalled();
  });

  it('predicts only a repeated high-confidence transition', async () => {
    const {
      recordStartupWarmupTransition,
      startupDataWarmupInternals,
    } = await import('../startupDataWarmup');

    startupDataWarmupInternals.transitionCounts.clear();
    recordStartupWarmupTransition('home', 'map');
    expect(startupDataWarmupInternals.getPredictedStage('home')).toBeNull();

    recordStartupWarmupTransition('home', 'map');
    expect(startupDataWarmupInternals.getPredictedStage('home')).toBe('map');

    recordStartupWarmupTransition('home', 'profile');
    recordStartupWarmupTransition('home', 'profile');
    expect(startupDataWarmupInternals.getPredictedStage('home')).toBeNull();
  });

  it('starts list detail data before navigation and deduplicates repeated intent', async () => {
    const { warmListDetailData } = await import('../startupDataWarmup');
    const params = {
      listId: 'list-1',
      queryClient,
      viewerId: 'user-1',
    };

    const firstWarmup = warmListDetailData(params);
    const repeatedWarmup = warmListDetailData(params);

    expect(repeatedWarmup).toBe(firstWarmup);
    await firstWarmup;
    expect(mocks.fetchListDetailHeader).toHaveBeenCalledOnce();
    expect(mocks.fetchListPlacesPage).toHaveBeenCalledOnce();
    expect(mocks.prefetchAppImages).toHaveBeenCalledWith(
      [undefined, undefined, 'photo.jpg'],
      { priority: 'low' },
    );
  });
});
