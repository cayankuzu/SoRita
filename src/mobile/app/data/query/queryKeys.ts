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
        listId?: string | null;
        ownerId?: string | null;
        publicOnly?: boolean;
        pageSize?: number | null;
      },
    ) =>
      [
        ...queryKeys.visibleData.all,
        'lists',
        viewerId,
        filters?.ownerId || null,
        filters?.listId || null,
        filters?.publicOnly ?? false,
        filters?.pageSize || null,
      ] as const,
    snapshot: (viewerId: string) => [...queryKeys.visibleData.all, 'snapshot', viewerId] as const,
  },
};
