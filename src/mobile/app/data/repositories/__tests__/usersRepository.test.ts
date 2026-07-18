import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  USER_BIO_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
} from '@/mobile/app/shared/validation/contentLimits';

const fromMock = vi.fn();
const fetchBlockStateMock = vi.fn();
const fetchUserByIdIncludingBlockedMock = vi.fn();
const uploadImageAssetMock = vi.fn();
const deleteStorageAssetsByUrlsMock = vi.fn();
const getSessionMock = vi.fn();
const createSignedEdgeHeadersMock = vi.fn();
const loggerWarnMock = vi.fn();
const submitModerationReportMock = vi.fn();

vi.mock('@/mobile/app/platform/config/env', () => ({
  env: {
    supabaseDeleteUserFunctionName: 'delete-user',
    supabasePublishableKey: 'anon-key',
    supabaseUrl: 'https://example.supabase.co',
  },
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
    from: fromMock,
  },
}));

vi.mock('@/mobile/app/platform/security/requestSigning', () => ({
  createSignedEdgeHeaders: createSignedEdgeHeadersMock,
}));

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: {
    warn: loggerWarnMock,
  },
}));

vi.mock('@/mobile/app/data/repositories/moderationReports', () => ({
  submitModerationReport: submitModerationReportMock,
}));

vi.mock('@/mobile/app/data/repositories/visibleDataRepository', () => ({
  fetchBlockState: fetchBlockStateMock,
  fetchUserByIdIncludingBlocked: fetchUserByIdIncludingBlockedMock,
}));

vi.mock('@/mobile/app/platform/supabase/media', () => ({
  deleteStorageAssetsByUrls: deleteStorageAssetsByUrlsMock,
  uploadImageAsset: uploadImageAssetMock,
}));

function createMaybeSingleChain(result: { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {};

  Object.assign(chain, {
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    select: vi.fn(() => chain),
    then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  });

  return chain as {
    delete: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    then: Promise<{ data?: unknown; error?: unknown }>['then'];
  };
}

function createFetchResponse(params: {
  json?: () => Promise<unknown>;
  ok: boolean;
  status: number;
  statusText?: string;
  text?: () => Promise<string>;
}) {
  return {
    json: params.json ?? (async () => ({})),
    ok: params.ok,
    status: params.status,
    statusText: params.statusText ?? '',
    text: params.text ?? (async () => ''),
  } as Response;
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, reject, resolve };
}

describe('usersRepository.followUser', () => {
  beforeEach(() => {
    fromMock.mockReset();
    fetchBlockStateMock.mockReset();
    fetchUserByIdIncludingBlockedMock.mockReset();
    uploadImageAssetMock.mockReset();
    deleteStorageAssetsByUrlsMock.mockReset();
    getSessionMock.mockReset();
    createSignedEdgeHeadersMock.mockReset();
    loggerWarnMock.mockReset();
    submitModerationReportMock.mockReset();
    fetchBlockStateMock.mockResolvedValue({
      blockedByCurrent: false,
      blockedByTarget: false,
    });
    createSignedEdgeHeadersMock.mockResolvedValue({
      'x-device-id': 'device-1',
      'x-nonce': 'nonce-1',
      'x-signature': 'signature-1',
      'x-timestamp': '1234567890',
    });
  });

  it('follows a public user when no relationship exists', async () => {
    const { followUser } = await import('@/mobile/app/data/repositories/usersRepository');
    const existingFollowQuery = createMaybeSingleChain({ data: null, error: null });
    const existingRequestQuery = createMaybeSingleChain({ data: null, error: null });
    const profileQuery = createMaybeSingleChain({
      data: { is_public_account: true },
      error: null,
    });
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    fromMock
      .mockReturnValueOnce(existingFollowQuery)
      .mockReturnValueOnce(existingRequestQuery)
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce({
        insert: insertMock,
      });

    await expect(followUser('viewer-1', 'target-1')).resolves.toBe('following');
    expect(insertMock).toHaveBeenCalledWith({
      follower_id: 'viewer-1',
      following_id: 'target-1',
    });
  });

  it('rejects follow attempts when the current user already blocked the target', async () => {
    const { followUser } = await import('@/mobile/app/data/repositories/usersRepository');
    fetchBlockStateMock.mockResolvedValue({
      blockedByCurrent: true,
      blockedByTarget: false,
    });

    await expect(followUser('viewer-1', 'target-1')).rejects.toThrow(
      'Bu kullanıcıyı engelledin. Takip etmek için önce engeli kaldır.',
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects follow attempts when the target has blocked the current user', async () => {
    const { followUser } = await import('@/mobile/app/data/repositories/usersRepository');
    fetchBlockStateMock.mockResolvedValue({
      blockedByCurrent: false,
      blockedByTarget: true,
    });

      await expect(followUser('viewer-1', 'target-1')).rejects.toThrow(
        'Bu kullanıcı ile şu anda etkileşime geçemezsin.',
      );
      expect(fromMock).not.toHaveBeenCalled();
  });

  it('unfollows when a follow relationship already exists', async () => {
    const { followUser } = await import('@/mobile/app/data/repositories/usersRepository');
    const existingFollowQuery = createMaybeSingleChain({
      data: { follower_id: 'viewer-1' },
      error: null,
    });
    const deleteQuery = createMaybeSingleChain({ error: null });

    fromMock
      .mockReturnValueOnce(existingFollowQuery)
      .mockReturnValueOnce(deleteQuery);

    await expect(followUser('viewer-1', 'target-1')).resolves.toBe('unfollowed');
    expect(deleteQuery.delete).toHaveBeenCalled();
  });

  it('propagates unfollow delete errors', async () => {
    const { followUser } = await import('@/mobile/app/data/repositories/usersRepository');
    const existingFollowQuery = createMaybeSingleChain({
      data: { follower_id: 'viewer-1' },
      error: null,
    });
    const expectedError = new Error('delete failed');
    const deleteQuery = createMaybeSingleChain({ error: expectedError });

    fromMock
      .mockReturnValueOnce(existingFollowQuery)
      .mockReturnValueOnce(deleteQuery);

    await expect(followUser('viewer-1', 'target-1')).rejects.toThrow('delete failed');
  });

  it('returns requested when a follow request already exists', async () => {
    const { followUser } = await import('@/mobile/app/data/repositories/usersRepository');
    const existingFollowQuery = createMaybeSingleChain({ data: null, error: null });
    const existingRequestQuery = createMaybeSingleChain({
      data: { id: 'request-1' },
      error: null,
    });

    fromMock
      .mockReturnValueOnce(existingFollowQuery)
      .mockReturnValueOnce(existingRequestQuery);

    await expect(followUser('viewer-1', 'target-1')).resolves.toBe('requested');
  });

  it('propagates relation lookup errors', async () => {
    const { followUser } = await import('@/mobile/app/data/repositories/usersRepository');
    const expectedError = new Error('relation failed');
    const existingFollowQuery = createMaybeSingleChain({ data: null, error: expectedError });

    fromMock.mockReturnValueOnce(existingFollowQuery);

    await expect(followUser('viewer-1', 'target-1')).rejects.toThrow('relation failed');
  });

  it('creates a follow request for private accounts', async () => {
    const { followUser } = await import('@/mobile/app/data/repositories/usersRepository');
    const existingFollowQuery = createMaybeSingleChain({ data: null, error: null });
    const existingRequestQuery = createMaybeSingleChain({ data: null, error: null });
    const profileQuery = createMaybeSingleChain({
      data: { is_public_account: false },
      error: null,
    });
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    fromMock
      .mockReturnValueOnce(existingFollowQuery)
      .mockReturnValueOnce(existingRequestQuery)
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce({
        insert: insertMock,
      });

    await expect(followUser('viewer-1', 'target-1')).resolves.toBe('requested');
    expect(insertMock).toHaveBeenCalledWith({
      requester_id: 'viewer-1',
      status: 'pending',
      target_user_id: 'target-1',
    });
  });

  it('treats duplicate follow request inserts as requested', async () => {
    const { followUser } = await import('@/mobile/app/data/repositories/usersRepository');
    const existingFollowQuery = createMaybeSingleChain({ data: null, error: null });
    const existingRequestQuery = createMaybeSingleChain({ data: null, error: null });
    const profileQuery = createMaybeSingleChain({
      data: { is_public_account: false },
      error: null,
    });
    const insertMock = vi.fn().mockResolvedValue({ error: { code: '23505' } });

    fromMock
      .mockReturnValueOnce(existingFollowQuery)
      .mockReturnValueOnce(existingRequestQuery)
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce({
        insert: insertMock,
      });

    await expect(followUser('viewer-1', 'target-1')).resolves.toBe('requested');
  });

  it('propagates private follow request insert errors', async () => {
    const { followUser } = await import('@/mobile/app/data/repositories/usersRepository');
    const existingFollowQuery = createMaybeSingleChain({ data: null, error: null });
    const existingRequestQuery = createMaybeSingleChain({ data: null, error: null });
    const profileQuery = createMaybeSingleChain({
      data: { is_public_account: false },
      error: null,
    });
    const insertMock = vi.fn().mockResolvedValue({ error: new Error('request failed') });

    fromMock
      .mockReturnValueOnce(existingFollowQuery)
      .mockReturnValueOnce(existingRequestQuery)
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce({
        insert: insertMock,
      });

    await expect(followUser('viewer-1', 'target-1')).rejects.toThrow('request failed');
  });

  it('propagates public follow insert errors', async () => {
    const { followUser } = await import('@/mobile/app/data/repositories/usersRepository');
    const existingFollowQuery = createMaybeSingleChain({ data: null, error: null });
    const existingRequestQuery = createMaybeSingleChain({ data: null, error: null });
    const profileQuery = createMaybeSingleChain({
      data: { is_public_account: true },
      error: null,
    });
    const insertMock = vi.fn().mockResolvedValue({ error: new Error('follow failed') });

    fromMock
      .mockReturnValueOnce(existingFollowQuery)
      .mockReturnValueOnce(existingRequestQuery)
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce({
        insert: insertMock,
      });

    await expect(followUser('viewer-1', 'target-1')).rejects.toThrow('follow failed');
  });
});

describe('usersRepository profile mutations', () => {
  beforeEach(() => {
    fromMock.mockReset();
    fetchUserByIdIncludingBlockedMock.mockReset();
    uploadImageAssetMock.mockReset();
    deleteStorageAssetsByUrlsMock.mockReset();
    getSessionMock.mockReset();
    createSignedEdgeHeadersMock.mockReset();
    createSignedEdgeHeadersMock.mockResolvedValue({
      'x-device-id': 'device-1',
      'x-nonce': 'nonce-1',
      'x-signature': 'signature-1',
      'x-timestamp': '1234567890',
    });
  });

  it('forwards visible user reads to the repository helper', async () => {
    fetchUserByIdIncludingBlockedMock.mockResolvedValue({ id: 'viewer-1' });
    const { fetchVisibleUserById } = await import('@/mobile/app/data/repositories/usersRepository');

    await expect(fetchVisibleUserById('viewer-1')).resolves.toEqual({ id: 'viewer-1' });
    expect(fetchUserByIdIncludingBlockedMock).toHaveBeenCalledWith('viewer-1');
  });

  it('updates users, deduplicates interests, and falls back to the input user when the refresh is empty', async () => {
    const updateChain = {
      eq: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn(() => updateChain),
    };

    fetchUserByIdIncludingBlockedMock
      .mockResolvedValueOnce({
        id: 'viewer-1',
        profilePhoto: 'https://cdn.example/old-profile.jpg',
        coverPhoto: 'https://cdn.example/old-cover.jpg',
      })
      .mockResolvedValueOnce(null);
    uploadImageAssetMock.mockResolvedValueOnce(undefined).mockResolvedValueOnce('https://cdn.example/new-cover.jpg');
    fromMock.mockReturnValueOnce(updateChain);

    const repository = await import('@/mobile/app/data/repositories/usersRepository');
    const inputUser = {
      id: 'viewer-1',
      email: 'viewer@example.com',
      name: 'Ada',
      username: 'Ada',
      bio: '',
      interests: ['coffee', 'coffee', 'music'],
      isPublicAccount: undefined,
      profilePhoto: undefined,
      coverPhoto: 'file:///tmp/cover.jpg',
    };

    await expect(repository.updateUser(inputUser)).resolves.toEqual({
      ...inputUser,
      bio: undefined,
      coverPhoto: 'https://cdn.example/new-cover.jpg',
      interests: ['coffee', 'music'],
      isPublicAccount: true,
      profilePhoto: undefined,
      username: 'ada',
    });
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        bio: null,
        interests: ['coffee', 'music'],
        is_public_account: true,
        profile_photo_url: null,
      }),
    );
    expect(deleteStorageAssetsByUrlsMock).toHaveBeenCalledWith({
      bucket: 'profile-media',
      urls: ['https://cdn.example/old-profile.jpg', 'https://cdn.example/old-cover.jpg'],
    });
  });

  it('clamps profile fields before persisting them', async () => {
    const updateChain = {
      eq: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn(() => updateChain),
    };

    fetchUserByIdIncludingBlockedMock.mockResolvedValue(null);
    uploadImageAssetMock.mockResolvedValue(undefined);
    fromMock.mockReturnValueOnce(updateChain);

    const { updateUser } = await import('@/mobile/app/data/repositories/usersRepository');
    const result = await updateUser({
      id: 'viewer-1',
      email: 'viewer@example.com',
      name: 'A'.repeat(USER_NAME_MAX_LENGTH + 12),
      username: `User__${'X'.repeat(USERNAME_MAX_LENGTH + 12)}!!!`,
      bio: 'B'.repeat(USER_BIO_MAX_LENGTH + 20),
    });

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'A'.repeat(USER_NAME_MAX_LENGTH),
        username: 'user__xxxxxxxxxxxxxxxxxxxxxxxx',
        bio: 'B'.repeat(USER_BIO_MAX_LENGTH),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        name: 'A'.repeat(USER_NAME_MAX_LENGTH),
        username: 'user__xxxxxxxxxxxxxxxxxxxxxxxx',
        bio: 'B'.repeat(USER_BIO_MAX_LENGTH),
      }),
    );
  });

  it('starts both media uploads before waiting for either one to finish', async () => {
    const profileUpload = createDeferred<string | undefined>();
    const coverUpload = createDeferred<string | undefined>();
    const updateChain = {
      eq: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn(() => updateChain),
    };

    fetchUserByIdIncludingBlockedMock
      .mockResolvedValueOnce({
        id: 'viewer-1',
        profilePhoto: 'https://cdn.example/old-profile.jpg',
        coverPhoto: 'https://cdn.example/old-cover.jpg',
      })
      .mockResolvedValueOnce({
        id: 'viewer-1',
        email: 'viewer@example.com',
        name: 'Ada',
        username: 'ada',
      });
    uploadImageAssetMock
      .mockReturnValueOnce(profileUpload.promise)
      .mockReturnValueOnce(coverUpload.promise);
    fromMock.mockReturnValueOnce(updateChain);

    const { updateUser } = await import('@/mobile/app/data/repositories/usersRepository');
    const updatePromise = updateUser({
      id: 'viewer-1',
      email: 'viewer@example.com',
      name: 'Ada',
      username: 'Ada',
      profilePhoto: 'file:///tmp/profile.jpg',
      coverPhoto: 'file:///tmp/cover.jpg',
    });

    await Promise.resolve();

    expect(uploadImageAssetMock).toHaveBeenCalledTimes(2);

    profileUpload.resolve('https://cdn.example/new-profile.jpg');
    coverUpload.resolve('https://cdn.example/new-cover.jpg');

    await expect(updatePromise).resolves.toEqual(
      expect.objectContaining({
        id: 'viewer-1',
        username: 'ada',
      }),
    );
  });

  it('propagates profile update errors', async () => {
    const expectedError = new Error('update failed');
    const updateChain = {
      eq: vi.fn().mockResolvedValue({ error: expectedError }),
      update: vi.fn(() => updateChain),
    };

    fetchUserByIdIncludingBlockedMock.mockResolvedValue(null);
    uploadImageAssetMock.mockResolvedValue(undefined);
    fromMock.mockReturnValueOnce(updateChain);

    const { updateUser } = await import('@/mobile/app/data/repositories/usersRepository');

    await expect(updateUser({
      id: 'viewer-1',
      email: 'viewer@example.com',
      name: 'Ada',
      username: 'Ada',
    })).rejects.toThrow('update failed');
  });

  it('rejects objectionable profile fields before persistence', async () => {
    const { updateUser } = await import('@/mobile/app/data/repositories/usersRepository');

    await expect(updateUser({
      id: 'viewer-1',
      email: 'viewer@example.com',
      name: 'amk',
      username: 'ada',
    })).rejects.toThrow('Ad alanı topluluk kurallarına aykırı ifade içeriyor.');

    expect(fetchUserByIdIncludingBlockedMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe('usersRepository.blockUser', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('rejects attempts to block the current user', async () => {
    const { blockUser } = await import('@/mobile/app/data/repositories/usersRepository');

    await expect(blockUser('viewer-1', 'viewer-1')).rejects.toThrow(
      'Kendi hesabını engelleyemezsin.',
    );
  });

  it('persists a block record for another user', async () => {
    const { blockUser } = await import('@/mobile/app/data/repositories/usersRepository');
    const blockUpsertMock = vi.fn().mockResolvedValue({ error: null });
    const moderationUpsertMock = vi.fn().mockResolvedValue({ error: null });

    fromMock
      .mockReturnValueOnce({
        upsert: blockUpsertMock,
      })
      .mockReturnValueOnce({
        upsert: moderationUpsertMock,
      });

    await expect(blockUser('viewer-1', 'target-1')).resolves.toBeUndefined();
    expect(blockUpsertMock).toHaveBeenCalledTimes(1);
    expect(blockUpsertMock.mock.calls[0]?.[0]).toMatchObject({
      blocker_user_id: 'viewer-1',
      blocked_user_id: 'target-1',
    });
    expect(moderationUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reporter_user_id: 'viewer-1',
        target_user_id: 'target-1',
        reason: 'blocked_user_safety_signal',
      }),
      {
        onConflict: 'reporter_user_id,target_user_id',
        ignoreDuplicates: true,
      },
    );
  });

  it('propagates block persistence failures', async () => {
    const { blockUser } = await import('@/mobile/app/data/repositories/usersRepository');
    const upsertMock = vi.fn().mockResolvedValue({ error: new Error('block failed') });

    fromMock.mockReturnValueOnce({
      upsert: upsertMock,
    });

    await expect(blockUser('viewer-1', 'target-1')).rejects.toThrow('block failed');
  });

  it('keeps the block in place even if moderation signal persistence fails', async () => {
    const { blockUser } = await import('@/mobile/app/data/repositories/usersRepository');
    const blockUpsertMock = vi.fn().mockResolvedValue({ error: null });
    const moderationUpsertMock = vi.fn().mockResolvedValue({ error: new Error('report failed') });

    fromMock
      .mockReturnValueOnce({
        upsert: blockUpsertMock,
      })
      .mockReturnValueOnce({
        upsert: moderationUpsertMock,
      });

    await expect(blockUser('viewer-1', 'target-1')).resolves.toBeUndefined();
    expect(loggerWarnMock).toHaveBeenCalledWith(
      'users',
      'Failed to persist moderation signal for blocked user',
      expect.any(Error),
    );
  });
});

describe('usersRepository unblock/report/delete', () => {
  beforeEach(() => {
    fromMock.mockReset();
    getSessionMock.mockReset();
    createSignedEdgeHeadersMock.mockReset();
    createSignedEdgeHeadersMock.mockResolvedValue({
      'x-device-id': 'device-1',
      'x-nonce': 'nonce-1',
      'x-signature': 'signature-1',
      'x-timestamp': '1234567890',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unblocks and reports users successfully', async () => {
    const unblockDeleteChain = {
      delete: vi.fn(() => unblockDeleteChain),
      eq: vi.fn(() => unblockDeleteChain),
      then: (resolve: (value: { error: null }) => unknown) =>
        Promise.resolve({ error: null }).then(resolve),
    };
    submitModerationReportMock.mockResolvedValue(undefined);

    fromMock.mockReturnValueOnce(unblockDeleteChain);

    const repository = await import('@/mobile/app/data/repositories/usersRepository');

    await repository.unblockUser('viewer-1', 'target-1');
    await repository.reportUser('viewer-1', 'target-1', ' spam ');

    expect(submitModerationReportMock).toHaveBeenCalledWith({
      targetType: 'user',
      reporterUserId: 'viewer-1',
      targetUserId: 'target-1',
      reason: ' spam ',
      details: undefined,
    });
  });

  it('propagates unblock failures', async () => {
    const deleteChain = {
      delete: vi.fn(() => deleteChain),
      eq: vi.fn(() => deleteChain),
      then: (resolve: (value: { error: Error }) => unknown) =>
        Promise.resolve({ error: new Error('unblock failed') }).then(resolve),
    };

    fromMock.mockReturnValueOnce(deleteChain);

    const { unblockUser } = await import('@/mobile/app/data/repositories/usersRepository');
    await expect(unblockUser('viewer-1', 'target-1')).rejects.toThrow('unblock failed');
  });

  it('rejects self-reports and propagates report persistence failures', async () => {
    const { reportUser } = await import('@/mobile/app/data/repositories/usersRepository');
    submitModerationReportMock.mockRejectedValue(new Error('report failed'));

    await expect(reportUser('viewer-1', 'viewer-1', 'spam')).rejects.toThrow(
      'Kendi hesabını şikâyet edemezsin.',
    );
    await expect(reportUser('viewer-1', 'target-1', 'spam')).rejects.toThrow('report failed');
  });

  it('deletes the current account when the edge function succeeds', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
        },
      },
      error: null,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      createFetchResponse({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      }),
    ));

    const { deleteCurrentUser } = await import('@/mobile/app/data/repositories/usersRepository');
    await expect(deleteCurrentUser()).resolves.toBeUndefined();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/delete-user',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('rejects deleteCurrentUser when the session lookup fails', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: null },
      error: { message: 'session failed' },
    });

    const { deleteCurrentUser } = await import('@/mobile/app/data/repositories/usersRepository');
    await expect(deleteCurrentUser()).rejects.toThrow('session failed');
  });

  it('rejects deleteCurrentUser when there is no access token', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { deleteCurrentUser } = await import('@/mobile/app/data/repositories/usersRepository');
    await expect(deleteCurrentUser()).rejects.toThrow(
      'Aktif oturum bulunamadı. Lütfen tekrar giriş yapıp yeniden dene.',
    );
  });

  it('extracts error payloads from failed delete requests', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
        },
      },
      error: null,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      createFetchResponse({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Delete failed' }),
      }),
    ));

    const { deleteCurrentUser } = await import('@/mobile/app/data/repositories/usersRepository');
    await expect(deleteCurrentUser()).rejects.toThrow('Delete failed');
  });

  it('extracts message payloads from failed delete requests', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
        },
      },
      error: null,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      createFetchResponse({
        ok: false,
        status: 422,
        json: async () => ({ message: 'Token invalid' }),
      }),
    ));

    const { deleteCurrentUser } = await import('@/mobile/app/data/repositories/usersRepository');
    await expect(deleteCurrentUser()).rejects.toThrow('Token invalid');
  });

  it('falls back to the response text when JSON parsing fails', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
        },
      },
      error: null,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      createFetchResponse({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('bad json');
        },
        text: async () => 'Gateway failed',
      }),
    ));

    const { deleteCurrentUser } = await import('@/mobile/app/data/repositories/usersRepository');
    await expect(deleteCurrentUser()).rejects.toThrow('Gateway failed');
  });

  it('falls back to a generic message when the response body is empty', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
        },
      },
      error: null,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      createFetchResponse({
        ok: false,
        status: 503,
        json: async () => {
          throw new Error('bad json');
        },
        text: async () => '   ',
      }),
    ));

    const { deleteCurrentUser } = await import('@/mobile/app/data/repositories/usersRepository');
    await expect(deleteCurrentUser()).rejects.toThrow('İstek başarısız oldu (503)');
  });
});
