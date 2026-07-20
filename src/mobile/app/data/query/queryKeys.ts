export const queryKeys = {
  accountAvailability: {
    all: ['accountAvailability'] as const,
    email: (email: string, excludeUserId?: string | null) =>
      [...queryKeys.accountAvailability.all, 'email', email, excludeUserId || null] as const,
    username: (username: string, excludeUserId?: string | null) =>
      [...queryKeys.accountAvailability.all, 'username', username, excludeUserId || null] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (userId: string) => [...queryKeys.notifications.all, 'list', userId] as const,
    page: (viewerId: string, category = 'all') =>
      [...queryKeys.notifications.all, 'page', viewerId, category] as const,
    unreadCount: (viewerId: string) =>
      [...queryKeys.notifications.all, 'unread-count', viewerId] as const,
  },
  feed: {
    all: ['feed'] as const,
    page: (viewerId: string, algorithmVersion = 'server-v1') =>
      [...queryKeys.feed.all, 'page', viewerId, algorithmVersion] as const,
  },
  explore: {
    all: ['explore'] as const,
    page: (
      viewerId: string,
      kind: string,
      normalizedQuery: string,
      filters?: Record<string, string | number | boolean | null | undefined>,
    ) =>
      [
        ...queryKeys.explore.all,
        'page',
        viewerId,
        kind,
        normalizedQuery,
        filters ? JSON.stringify(filters) : null,
      ] as const,
  },
  profile: {
    all: ['profile'] as const,
    summary: (viewerId: string, targetUserId: string) =>
      [...queryKeys.profile.all, 'summary', viewerId, targetUserId] as const,
    content: (viewerId: string, targetUserId: string, tab: string) =>
      [...queryKeys.profile.all, 'content', viewerId, targetUserId, tab] as const,
  },
  list: {
    all: ['list'] as const,
    header: (viewerId: string, listId: string) =>
      [...queryKeys.list.all, 'header', viewerId, listId] as const,
    places: (viewerId: string, listId: string) =>
      [...queryKeys.list.all, 'places', viewerId, listId] as const,
  },
  map: {
    all: ['map'] as const,
    markers: (viewerId: string) =>
      [...queryKeys.map.all, 'markers', viewerId] as const,
  },
  placeComments: {
    all: ['placeComments'] as const,
    list: (placeId: string, viewerId: string) =>
      [...queryKeys.placeComments.all, 'list', placeId, viewerId] as const,
  },
  visibleData: {
    all: ['visibleData'] as const,
    context: (viewerId: string) => [...queryKeys.visibleData.all, 'context', viewerId] as const,
    lists: (
      viewerId: string,
      filters?: {
        includePlaceComments?: boolean | null;
        listId?: string | null;
        ownerId?: string | null;
        publicOnly?: boolean;
        pageSize?: number | null;
        scope?: string | null;
      },
    ) =>
      [
        ...queryKeys.visibleData.all,
        'lists',
        viewerId,
        filters?.ownerId || null,
        filters?.listId || null,
        filters?.publicOnly ?? false,
        filters?.includePlaceComments ?? false,
        filters?.pageSize || null,
        filters?.scope || null,
      ] as const,
    snapshot: (viewerId: string) => [...queryKeys.visibleData.all, 'snapshot', viewerId] as const,
  },
};
