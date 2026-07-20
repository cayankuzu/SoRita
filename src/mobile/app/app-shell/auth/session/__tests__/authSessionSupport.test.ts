import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/mobile/app/data/query/queryKeys';

const setQueryDataMock = vi.fn();
const getQueryDataMock = vi.fn();
const removeQueriesMock = vi.fn();
const clearMock = vi.fn();
const refreshNotificationsMock = vi.fn();
const fetchUserByIdIncludingBlockedMock = vi.fn();
const updateUserMock = vi.fn();
const fetchVisibleDataContextMock = vi.fn();
const getPersistedAuthSessionMock = vi.fn();
const getPersistedAuthUserMock = vi.fn();
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
const getPersistedVisibleDataSnapshotMock = vi.fn();

vi.mock('@/mobile/app/data/cache/visibleDataSnapshotCache', () => ({
  getPersistedVisibleDataSnapshot: getPersistedVisibleDataSnapshotMock,
}));

vi.mock('@/mobile/app/data/query/queryClient', () => ({
  queryClient: {
    clear: clearMock,
    getQueryData: getQueryDataMock,
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
  getPersistedAuthUser: getPersistedAuthUserMock,
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
    getQueryDataMock.mockReset();
    removeQueriesMock.mockReset();
    clearMock.mockReset();
    refreshNotificationsMock.mockReset();
    fetchUserByIdIncludingBlockedMock.mockReset();
    updateUserMock.mockReset();
    fetchVisibleDataContextMock.mockReset();
    getPersistedAuthSessionMock.mockReset();
    getPersistedAuthUserMock.mockReset();
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
    getPersistedVisibleDataSnapshotMock.mockReset();
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
    getQueryDataMock.mockReturnValue(undefined);
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
      email_confirmed_at: '2026-06-29T10:00:00.000Z',
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

  it('skips profile creation for accounts whose email is not confirmed yet', async () => {
    const support = await import('@/mobile/app/app-shell/auth/session/authSessionSupport');
    const authUser = {
      id: 'user-1',
      email: 'user@example.com',
      email_confirmed_at: null,
      user_metadata: {
        name: 'Ada',
        username: 'ada',
      },
    };

    await support.ensureProfileExists(authUser as never);

    expect(maybeSingleMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
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
    getQueryDataMock.mockImplementation((queryKey) => (
      JSON.stringify(queryKey) === JSON.stringify(queryKeys.visibleData.snapshot('user-1'))
        ? { ...context, lists: [{ id: 'list-1' }] }
        : undefined
    ));

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
      queryKeys.visibleData.snapshot('user-1'),
      {
        ...context,
        lists: [{ id: 'list-1' }],
      },
    );
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
      email_confirmed_at: '2026-06-29T10:00:00.000Z',
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
    expect(
      support.getAuthErrorCode(
        'Password is known to be weak and easy to guess, please choose a different one.',
      ),
    ).toBe('weak_password');
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
      email_confirmed_at: '2026-06-29T10:00:00.000Z',
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

  it('restores valid persisted sessions and falls back when there is no active session', async () => {
    const support = await import('@/mobile/app/app-shell/auth/session/authSessionSupport');
    const persisted = { access_token: 'persisted-token', refresh_token: 'persisted-refresh' };
    const refreshed = { access_token: 'fresh-token', refresh_token: 'fresh-refresh' };
    getPersistedAuthSessionMock.mockResolvedValue(persisted);
    setSessionMock.mockResolvedValue({ data: { session: refreshed }, error: null });

    await expect(support.restorePersistedSession()).resolves.toEqual(refreshed);
    expect(savePersistedAuthSessionMock).toHaveBeenCalledWith(refreshed);

    getSessionMock.mockResolvedValue({ data: { session: null } });
    await expect(support.getActiveOrPersistedSession()).resolves.toEqual(refreshed);
    expect(setSessionMock).toHaveBeenCalledWith(persisted);
  });

  it('restores persisted visible data into context, list, and snapshot caches', async () => {
    const support = await import('@/mobile/app/app-shell/auth/session/authSessionSupport');
    getPersistedVisibleDataSnapshotMock.mockResolvedValueOnce(null);
    await expect(support.restorePersistedVisibleDataSnapshot('user-1')).resolves.toBeNull();

    const snapshot = {
      currentUser: { id: 'user-1', email: '', name: 'Ada', username: 'ada' },
      users: [], allUsers: [], blockRows: [],
      lists: Array.from({ length: 25 }, (_, index) => ({ id: `list-${index}` })),
    };
    getPersistedVisibleDataSnapshotMock.mockResolvedValueOnce(snapshot);
    await expect(support.restorePersistedVisibleDataSnapshot('user-1')).resolves.toEqual(snapshot);
    expect(setQueryDataMock).toHaveBeenCalledWith(
      queryKeys.visibleData.lists('user-1', { pageSize: 20 }),
      { pageParams: [0], pages: [snapshot.lists.slice(0, 20)] },
    );
    await support.persistResolvedAuthUser(snapshot.currentUser);
    expect(savePersistedAuthUserMock).toHaveBeenCalledWith(snapshot.currentUser);
    await expect(support.getPersistedAuthUserSnapshot()).resolves.toBeUndefined();
  });

  it('fails closed on profile lookup/insert errors and maps sparse auth metadata defaults', async () => {
    const support = await import('@/mobile/app/app-shell/auth/session/authSessionSupport');
    const authUser = {
      id: 'abcdefgh1234', email: 'local@example.com', email_confirmed_at: '2026-07-18T00:00:00Z',
      user_metadata: {},
    };
    const lookupError = new Error('lookup failed');
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: lookupError });
    await expect(support.ensureProfileExists(authUser as never)).rejects.toThrow(lookupError);

    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    const insertError = new Error('insert failed');
    insertMock.mockResolvedValueOnce({ error: insertError });
    await expect(support.ensureProfileExists(authUser as never)).rejects.toThrow(insertError);

    expect(support.createUserFromAuthUser(authUser as never)).toEqual({
      id: 'abcdefgh1234', email: 'local@example.com', name: 'local', username: 'user_abcdefgh',
      isPublicAccount: true, bio: undefined, interests: undefined,
      profilePhoto: undefined, coverPhoto: undefined,
    });
    expect(support.createUserFromAuthUser({
      id: 'short', email: null,
      user_metadata: {
        full_name: 'Full Name', username: 'UPPER', bio: 123, interests: 'coffee',
        profile_photo_url: 123, cover_photo_url: 123,
      },
    } as never)).toMatchObject({
      email: '', name: 'Full Name', username: 'upper', bio: undefined, interests: undefined,
    });
  });

  it('covers pending signup media no-op paths and preserves existing images', async () => {
    const support = await import('@/mobile/app/app-shell/auth/session/authSessionSupport');
    const authUser = { id: 'user-1', email: 'user@example.com', user_metadata: {} };
    getPendingSignupMediaMock.mockResolvedValueOnce(null);
    await support.syncPendingProfileMedia(authUser as never);
    expect(fetchUserByIdIncludingBlockedMock).not.toHaveBeenCalled();

    getPendingSignupMediaMock.mockResolvedValueOnce({ profilePhoto: 'new.jpg', coverPhoto: 'new-cover.jpg' });
    fetchUserByIdIncludingBlockedMock.mockResolvedValueOnce(null);
    await support.syncPendingProfileMedia(authUser as never);
    expect(updateUserMock).not.toHaveBeenCalled();

    getPendingSignupMediaMock.mockResolvedValueOnce({ profilePhoto: 'new.jpg', coverPhoto: 'new-cover.jpg' });
    fetchUserByIdIncludingBlockedMock.mockResolvedValueOnce({
      id: 'user-1', email: 'user@example.com', name: 'Ada', username: 'ada',
      profilePhoto: 'existing.jpg', coverPhoto: 'existing-cover.jpg',
    });
    await support.syncPendingProfileMedia(authUser as never);
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(clearPendingSignupMediaMock).toHaveBeenCalledWith('user@example.com');
  });

  it('hydrates missing emails from the active auth session and tolerates session/notification failures', async () => {
    const support = await import('@/mobile/app/app-shell/auth/session/authSessionSupport');
    const currentUser = { id: 'user-1', email: '', name: 'Ada', username: 'ada' };
    fetchVisibleDataContextMock.mockResolvedValue({
      currentUser, users: [currentUser, { id: 'other', email: '', name: 'Other', username: 'other' }],
      allUsers: [currentUser], blockRows: [],
    });
    getSessionMock.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'resolved@example.com' } } }, error: null,
    });
    await expect(support.resolveCurrentUser('user-1')).resolves.toMatchObject({ email: 'resolved@example.com' });
    expect(setQueryDataMock).toHaveBeenCalledWith(
      queryKeys.visibleData.context('user-1'),
      expect.objectContaining({ currentUser: expect.objectContaining({ email: 'resolved@example.com' }) }),
    );
    await expect(support.resolveCurrentUser(null)).resolves.toBeNull();

    getSessionMock.mockRejectedValueOnce(new Error('session offline'));
    refreshNotificationsMock.mockRejectedValueOnce(new Error('notification offline'));
    await expect(support.hydratePersistedAuthState('user-1')).resolves.toMatchObject({ email: '' });
    await Promise.resolve();
  });

  it('detects missing-account error variants and exhaustively maps provider messages', async () => {
    const support = await import('@/mobile/app/app-shell/auth/session/authSessionSupport');
    const { AuthApiError, AuthSessionMissingError } = await import('@supabase/supabase-js');
    expect(support.isMissingAuthenticatedAccountError(new AuthSessionMissingError())).toBe(true);
    expect(support.isMissingAuthenticatedAccountError(new AuthApiError('missing', 404, 'not_found'))).toBe(true);
    expect(support.isMissingAuthenticatedAccountError(new AuthApiError('bad', 400, 'bad_request'))).toBe(false);
    expect(support.isMissingAuthenticatedAccountError(new Error('other'))).toBe(false);

    const cases = [
      ['weak and easy to guess', 'weak_password'],
      ['weak password', 'weak_password'],
      ['user already registered', 'duplicate_email'],
      ['already registered', 'duplicate_email'],
      ['already exists', 'duplicate_email'],
      ['email_address_not_authorized', 'duplicate_email'],
      ['users_email_key', 'duplicate_email'],
      ['username already', 'duplicate_username'],
      ['username duplicate', 'duplicate_username'],
      [undefined, 'unexpected'],
    ] as const;
    for (const [message, code] of cases) {
      expect(support.getAuthErrorCode(message)).toBe(code);
    }
  });

  it('propagates authenticated user verification errors and rejects sessions without access tokens', async () => {
    const support = await import('@/mobile/app/app-shell/auth/session/authSessionSupport');
    await expect(support.getVerifiedAuthUser({ refresh_token: 'refresh' } as never)).resolves.toBeNull();
    const error = new Error('auth unavailable');
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error });
    await expect(support.getVerifiedAuthUser({ access_token: 'token' } as never)).rejects.toThrow(error);
  });
});
