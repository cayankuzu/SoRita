import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

const setQueryDataMock = vi.fn();
const removeQueriesMock = vi.fn();
const clearMock = vi.fn();
const refreshNotificationsMock = vi.fn();
const fetchUserByIdIncludingBlockedMock = vi.fn();
const updateUserMock = vi.fn();
const fetchVisibleDataContextMock = vi.fn();
const getPersistedAuthSessionMock = vi.fn();
const savePersistedAuthSessionMock = vi.fn();
const savePersistedAuthUserMock = vi.fn();
const clearPersistedAuthSessionMock = vi.fn();
const getPendingSignupMediaMock = vi.fn();
const clearPendingSignupMediaMock = vi.fn();
const getSessionMock = vi.fn();
const getUserMock = vi.fn();
const setSessionMock = vi.fn();
const maybeSingleMock = vi.fn();
const insertMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/mobile/app/data/query/queryClient', () => ({
  queryClient: {
    clear: clearMock,
    removeQueries: removeQueriesMock,
    setQueryData: setQueryDataMock,
  },
}));

vi.mock('@/mobile/app/data/repositories/notificationRepository', () => ({
  refreshNotifications: refreshNotificationsMock,
}));

vi.mock('@/mobile/app/data/repositories/usersRepository', () => ({
  fetchUserByIdIncludingBlocked: fetchUserByIdIncludingBlockedMock,
  updateUser: updateUserMock,
}));

vi.mock('@/mobile/app/data/repositories/visibleDataRepository', () => ({
  fetchVisibleDataContext: fetchVisibleDataContextMock,
}));

vi.mock('@/mobile/app/platform/storage/authSession', () => ({
  clearPersistedAuthSession: clearPersistedAuthSessionMock,
  getPersistedAuthSession: getPersistedAuthSessionMock,
  savePersistedAuthSession: savePersistedAuthSessionMock,
  savePersistedAuthUser: savePersistedAuthUserMock,
}));

vi.mock('@/mobile/app/platform/storage/pendingSignupMedia', () => ({
  clearPendingSignupMedia: clearPendingSignupMediaMock,
  getPendingSignupMedia: getPendingSignupMediaMock,
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      getUser: getUserMock,
      setSession: setSessionMock,
    },
    from: fromMock,
  },
}));

function createProfilesQuery() {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: maybeSingleMock,
      })),
    })),
    insert: insertMock,
  };
}

describe('authSessionSupport', () => {
  beforeEach(() => {
    setQueryDataMock.mockReset();
    removeQueriesMock.mockReset();
    clearMock.mockReset();
    refreshNotificationsMock.mockReset();
    fetchUserByIdIncludingBlockedMock.mockReset();
    updateUserMock.mockReset();
    fetchVisibleDataContextMock.mockReset();
    getPersistedAuthSessionMock.mockReset();
    savePersistedAuthSessionMock.mockReset();
    savePersistedAuthUserMock.mockReset();
    clearPersistedAuthSessionMock.mockReset();
    getPendingSignupMediaMock.mockReset();
    clearPendingSignupMediaMock.mockReset();
    getSessionMock.mockReset();
    getUserMock.mockReset();
    setSessionMock.mockReset();
    maybeSingleMock.mockReset();
    insertMock.mockReset();
    fromMock.mockReset();
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'user@example.com',
        },
      },
      error: null,
    });

    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return createProfilesQuery();
      }

      return {};
    });
  });

  it('restores and persists sessions through storage helpers', async () => {
    const session = { access_token: 'token', refresh_token: 'refresh' };
    getPersistedAuthSessionMock.mockResolvedValueOnce(null).mockResolvedValueOnce(session);
    setSessionMock.mockResolvedValueOnce({ data: { session: null }, error: new Error('invalid') });
    getSessionMock.mockResolvedValueOnce({ data: { session } }).mockResolvedValueOnce({ data: { session: null } });

    const support = await import('@/mobile/app/app-shell/auth/session/authSessionSupport');

    await expect(support.restorePersistedSession()).resolves.toBeNull();
    await expect(support.restorePersistedSession()).resolves.toBeNull();
    expect(clearPersistedAuthSessionMock).toHaveBeenCalled();

    await support.persistAuthSession(session as never);
    await support.persistAuthSession(null);
    expect(savePersistedAuthSessionMock).toHaveBeenCalledWith(session);
    expect(clearPersistedAuthSessionMock).toHaveBeenCalled();

    await expect(support.getActiveOrPersistedSession()).resolves.toEqual(session);
    expect(savePersistedAuthSessionMock).toHaveBeenCalledWith(session);
  });

  it('ensures profiles exist and maps auth users', async () => {
    maybeSingleMock
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: 'user-1' }, error: null });
    insertMock.mockResolvedValue({ error: null });
    const support = await import('@/mobile/app/app-shell/auth/session/authSessionSupport');
    const authUser = {
      id: 'user-1',
      email: 'user@example.com',
      user_metadata: {
        name: 'Ada',
        username: 'ada',
        interests: ['coffee'],
        profile_photo_url: 'profile.jpg',
        cover_photo_url: 'cover.jpg',
      },
    };

    await support.ensureProfileExists(authUser as never);
    await support.ensureProfileExists(authUser as never);

    expect(insertMock).toHaveBeenCalled();
    expect(support.createUserFromAuthUser(authUser as never)).toMatchObject({
      id: 'user-1',
      username: 'ada',
      interests: ['coffee'],
    });
    expect(support.resolveImmediateAuthUser(authUser as never).name).toBe('Ada');
  });

  it('syncs pending media and hydrates cached auth state', async () => {
    const support = await import('@/mobile/app/app-shell/auth/session/authSessionSupport');
    const currentUser = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Ada',
      username: 'ada',
      profilePhoto: undefined,
      coverPhoto: undefined,
    };
    const context = {
      currentUser,
      users: [currentUser],
      allUsers: [currentUser],
      blockRows: [],
    };

    getPendingSignupMediaMock.mockResolvedValue({ profilePhoto: 'profile.jpg', coverPhoto: 'cover.jpg' });
    fetchUserByIdIncludingBlockedMock.mockResolvedValue(currentUser);
    updateUserMock.mockResolvedValue(undefined);
    fetchVisibleDataContextMock.mockResolvedValue(context);
    refreshNotificationsMock.mockResolvedValue([{ id: 'notification-1' }]);

    await support.syncPendingProfileMedia({
      id: 'user-1',
      email: 'user@example.com',
      user_metadata: {},
    } as never);

    expect(updateUserMock).toHaveBeenCalledWith({
      ...currentUser,
      profilePhoto: 'profile.jpg',
      coverPhoto: 'cover.jpg',
    });
    expect(clearPendingSignupMediaMock).toHaveBeenCalledWith('user@example.com');

    await expect(support.resolveCurrentUser('user-1')).resolves.toEqual(currentUser);
    await expect(support.hydratePersistedAuthState('user-1')).resolves.toEqual(currentUser);
    await Promise.resolve();
    expect(setQueryDataMock).toHaveBeenCalled();
    expect(setQueryDataMock).toHaveBeenCalledWith(
      queryKeys.notifications.list('user-1'),
      {
        pageParams: [0],
        pages: [[{ id: 'notification-1' }]],
      },
    );

    support.clearCurrentUserState();
    expect(clearMock).toHaveBeenCalled();
  });

  it('syncs authenticated users and maps auth error codes', async () => {
    const support = await import('@/mobile/app/app-shell/auth/session/authSessionSupport');
    const authUser = {
      id: 'user-1',
      email: 'user@example.com',
      user_metadata: { name: 'Ada', username: 'ada' },
    };
    const context = {
      currentUser: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Ada',
        username: 'ada',
      },
      users: [],
      allUsers: [],
      blockRows: [],
    };

    maybeSingleMock.mockResolvedValue({ data: { id: 'user-1' }, error: null });
    getPendingSignupMediaMock.mockResolvedValue(null);
    fetchVisibleDataContextMock.mockResolvedValue(context);
    refreshNotificationsMock.mockResolvedValue([]);

    await expect(support.syncAuthenticatedUser(authUser as never)).resolves.toEqual(context.currentUser);
    await Promise.resolve();
    expect(setQueryDataMock).toHaveBeenCalledWith(
      queryKeys.notifications.list('user-1'),
      {
        pageParams: [0],
        pages: [[]],
      },
    );

    expect(support.getAuthErrorCode('Email not confirmed')).toBe('email_not_confirmed');
    expect(support.getAuthErrorCode('Invalid login credentials')).toBe('invalid_credentials');
    expect(support.getAuthErrorCode('profiles_email_key')).toBe('duplicate_email');
    expect(support.getAuthErrorCode('profiles_username_key')).toBe('duplicate_username');
    expect(support.getAuthErrorCode('other')).toBe('unexpected');
  });

  it('verifies auth users against the auth service and detects missing accounts', async () => {
    const support = await import('@/mobile/app/app-shell/auth/session/authSessionSupport');
    const session = { access_token: 'token', refresh_token: 'refresh' };
    const authUser = { id: 'user-1', email: 'user@example.com' };

    getUserMock.mockResolvedValueOnce({
      data: { user: authUser },
      error: null,
    });

    await expect(support.getVerifiedAuthUser(session as never)).resolves.toEqual(authUser);
    await expect(support.getVerifiedAuthUser(null)).resolves.toBeNull();

    getUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    await expect(support.getVerifiedAuthUser(session as never)).rejects.toThrow(
      'Authenticated account no longer exists.',
    );
    expect(
      support.isMissingAuthenticatedAccountError(new support.MissingAuthenticatedAccountError()),
    ).toBe(true);
  });

  it('treats missing current users as deleted accounts during sync', async () => {
    const support = await import('@/mobile/app/app-shell/auth/session/authSessionSupport');
    const authUser = {
      id: 'user-1',
      email: 'user@example.com',
      user_metadata: { name: 'Ada', username: 'ada' },
    };

    maybeSingleMock.mockResolvedValue({ data: { id: 'user-1' }, error: null });
    getPendingSignupMediaMock.mockResolvedValue(null);
    fetchVisibleDataContextMock.mockResolvedValue({
      currentUser: null,
      users: [],
      allUsers: [],
      blockRows: [],
    });
    refreshNotificationsMock.mockResolvedValue([]);

    await expect(support.syncAuthenticatedUser(authUser as never)).rejects.toThrow(
      'Authenticated account no longer exists.',
    );
  });
});
