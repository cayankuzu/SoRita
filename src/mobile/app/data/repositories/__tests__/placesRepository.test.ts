import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();
const rpcMock = vi.fn();
const deleteStorageAssetsByUrlsMock = vi.fn();

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

vi.mock('@/mobile/app/platform/supabase/media', () => ({
  deleteStorageAssetsByUrls: deleteStorageAssetsByUrlsMock,
}));

function createSelectChain(result: { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {};

  Object.assign(chain, {
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    is: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    order: vi.fn(() => chain),
    range: vi.fn(() => chain),
    select: vi.fn(() => chain),
    then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  });

  return chain as {
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    then: Promise<typeof result>['then'];
  };
}

function createDeleteChain(result: { error?: unknown }) {
  const chain: Record<string, unknown> = {};

  Object.assign(chain, {
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  });

  return chain as {
    delete: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    then: Promise<typeof result>['then'];
  };
}

function createUpdateChain(result: { error?: unknown }) {
  const chain: Record<string, unknown> = {};

  Object.assign(chain, {
    eq: vi.fn(() => chain),
    update: vi.fn(() => chain),
    then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  });

  return chain as {
    eq: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    then: Promise<typeof result>['then'];
  };
}

describe('placesRepository', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
    deleteStorageAssetsByUrlsMock.mockReset();
    deleteStorageAssetsByUrlsMock.mockResolvedValue(undefined);
  });

  it('returns top-level comments together with replies', async () => {
    const topLevelCommentsQuery = createSelectChain({
      data: [
        {
          id: 'comment-1',
          list_place_id: 'place-1',
          user_id: 'user-1',
          parent_comment_id: null,
          content: 'hello',
          created_at: '2026-04-16T10:00:00.000Z',
          updated_at: '2026-04-16T10:00:00.000Z',
          list_place_comment_likes: [],
        },
      ],
      error: null,
    });
    const replyCommentsQuery = createSelectChain({
      data: [
        {
          id: 'comment-2',
          list_place_id: 'place-1',
          user_id: 'user-2',
          parent_comment_id: 'comment-1',
          content: 'reply',
          created_at: '2026-04-16T10:05:00.000Z',
          updated_at: '2026-04-16T10:05:00.000Z',
          list_place_comment_likes: [],
        },
      ],
      error: null,
    });

    fromMock
      .mockReturnValueOnce(topLevelCommentsQuery)
      .mockReturnValueOnce(replyCommentsQuery);

    const { getPlaceCommentsPage } = await import('@/mobile/app/data/repositories/placesRepository');
    await expect(getPlaceCommentsPage('place-1', 0, 20)).resolves.toEqual([
      expect.objectContaining({ id: 'comment-1' }),
      expect.objectContaining({ id: 'comment-2' }),
    ]);
    expect(topLevelCommentsQuery.range).toHaveBeenCalledWith(0, 19);
    expect(replyCommentsQuery.in).toHaveBeenCalledWith('parent_comment_id', ['comment-1']);
  });

  it('returns an empty page when there are no top-level comments', async () => {
    const topLevelCommentsQuery = createSelectChain({
      data: [],
      error: null,
    });

    fromMock.mockReturnValueOnce(topLevelCommentsQuery);

    const { getPlaceCommentsPage } = await import('@/mobile/app/data/repositories/placesRepository');
    await expect(getPlaceCommentsPage('place-1', 20, 20)).resolves.toEqual([]);
  });

  it('propagates top-level and reply fetch errors', async () => {
    fromMock.mockReturnValueOnce(createSelectChain({
      data: null,
      error: new Error('top-level failed'),
    }));

    const { getPlaceCommentsPage } = await import('@/mobile/app/data/repositories/placesRepository');
    await expect(getPlaceCommentsPage('place-1', 0, 20)).rejects.toThrow('top-level failed');

    const topLevelCommentsQuery = createSelectChain({
      data: [
        {
          id: 'comment-1',
          list_place_id: 'place-1',
          user_id: 'user-1',
          parent_comment_id: null,
          content: 'hello',
          created_at: '2026-04-16T10:00:00.000Z',
          updated_at: '2026-04-16T10:00:00.000Z',
          list_place_comment_likes: [],
        },
      ],
      error: null,
    });
    const replyCommentsQuery = createSelectChain({
      data: null,
      error: new Error('reply failed'),
    });

    fromMock
      .mockReturnValueOnce(topLevelCommentsQuery)
      .mockReturnValueOnce(replyCommentsQuery);

    await expect(getPlaceCommentsPage('place-1', 0, 20)).rejects.toThrow('reply failed');
  });

  it('deletes places and associated media', async () => {
    const placeSelectChain = createSelectChain({
      data: [
        {
          list_place_photos: [
            { url: 'https://cdn.example/place-1.jpg' },
            { url: null },
          ],
        },
      ],
      error: null,
    });
    const deleteChain = createDeleteChain({ error: null });

    fromMock
      .mockReturnValueOnce(placeSelectChain)
      .mockReturnValueOnce(deleteChain);

    const { deletePlace } = await import('@/mobile/app/data/repositories/placesRepository');
    await expect(deletePlace('place-1')).resolves.toBeUndefined();

    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteStorageAssetsByUrlsMock).toHaveBeenCalledWith({
      bucket: 'place-media',
      urls: ['https://cdn.example/place-1.jpg', null],
    });
  });

  it('propagates place delete read and write failures', async () => {
    fromMock.mockReturnValueOnce(createSelectChain({
      data: null,
      error: new Error('select failed'),
    }));

    const { deletePlace } = await import('@/mobile/app/data/repositories/placesRepository');
    await expect(deletePlace('place-1')).rejects.toThrow('select failed');

    const placeSelectChain = createSelectChain({
      data: [],
      error: null,
    });
    const deleteChain = createDeleteChain({ error: new Error('delete failed') });

    fromMock
      .mockReturnValueOnce(placeSelectChain)
      .mockReturnValueOnce(deleteChain);

    await expect(deletePlace('place-1')).rejects.toThrow('delete failed');
  });

  it('toggles place likes for existing and missing likes', async () => {
    const existingLikeQuery = createSelectChain({
      data: { list_place_id: 'place-1' },
      error: null,
    });
    const deleteChain = createDeleteChain({ error: null });
    const missingLikeQuery = createSelectChain({
      data: null,
      error: null,
    });
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    fromMock
      .mockReturnValueOnce(existingLikeQuery)
      .mockReturnValueOnce(deleteChain)
      .mockReturnValueOnce(missingLikeQuery)
      .mockReturnValueOnce({ insert: insertMock });

    const { toggleLikePlace } = await import('@/mobile/app/data/repositories/placesRepository');
    await expect(toggleLikePlace('place-1', 'user-1')).resolves.toBeUndefined();
    await expect(toggleLikePlace('place-1', 'user-1')).resolves.toBeUndefined();

    expect(deleteChain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(insertMock).toHaveBeenCalledWith({
      list_place_id: 'place-1',
      user_id: 'user-1',
    });
  });

  it('propagates place like lookup and persistence failures', async () => {
    fromMock.mockReturnValueOnce(createSelectChain({
      data: null,
      error: new Error('like lookup failed'),
    }));

    const { toggleLikePlace } = await import('@/mobile/app/data/repositories/placesRepository');
    await expect(toggleLikePlace('place-1', 'user-1')).rejects.toThrow('like lookup failed');

    const existingLikeQuery = createSelectChain({
      data: { list_place_id: 'place-1' },
      error: null,
    });
    const deleteChain = createDeleteChain({ error: new Error('unlike failed') });

    fromMock
      .mockReturnValueOnce(existingLikeQuery)
      .mockReturnValueOnce(deleteChain);

    await expect(toggleLikePlace('place-1', 'user-1')).rejects.toThrow('unlike failed');

    const missingLikeQuery = createSelectChain({
      data: null,
      error: null,
    });
    const insertMock = vi.fn().mockResolvedValue({ error: new Error('like failed') });

    fromMock
      .mockReturnValueOnce(missingLikeQuery)
      .mockReturnValueOnce({ insert: insertMock });

    await expect(toggleLikePlace('place-1', 'user-1')).rejects.toThrow('like failed');
  });

  it('creates, updates, and deletes comments with trimmed payloads', async () => {
    const createInsertMock = vi.fn().mockResolvedValue({ error: null });
    const replyInsertMock = vi.fn().mockResolvedValue({ error: null });
    const updateChain = createUpdateChain({ error: null });
    const deleteChain = createDeleteChain({ error: null });

    fromMock
      .mockReturnValueOnce({ insert: createInsertMock })
      .mockReturnValueOnce({ insert: replyInsertMock })
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(deleteChain);

    const repository = await import('@/mobile/app/data/repositories/placesRepository');

    await repository.createPlaceComment('place-1', 'user-1', '  hello world  ');
    await repository.createPlaceComment('place-1', 'user-1', '  reply  ', 'parent-1');
    await repository.updatePlaceComment('comment-1', 'user-1', '  edited  ');
    await repository.deletePlaceComment('comment-1');

    expect(createInsertMock).toHaveBeenCalledWith({
      list_place_id: 'place-1',
      user_id: 'user-1',
      content: 'hello world',
    });
    expect(replyInsertMock).toHaveBeenCalledWith({
      list_place_id: 'place-1',
      user_id: 'user-1',
      content: 'reply',
      parent_comment_id: 'parent-1',
    });
    expect(updateChain.update).toHaveBeenCalledWith({
      content: 'edited',
      updated_at: expect.any(String),
    });
    expect(deleteChain.eq).toHaveBeenCalledWith('id', 'comment-1');
  });

  it('propagates comment mutation failures', async () => {
    const repository = await import('@/mobile/app/data/repositories/placesRepository');

    fromMock.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: new Error('create failed') }),
    });
    await expect(
      repository.createPlaceComment('place-1', 'user-1', 'comment'),
    ).rejects.toThrow('create failed');

    fromMock.mockReturnValueOnce(createUpdateChain({ error: new Error('update failed') }));
    await expect(
      repository.updatePlaceComment('comment-1', 'user-1', 'comment'),
    ).rejects.toThrow('update failed');

    fromMock.mockReturnValueOnce(createDeleteChain({ error: new Error('delete failed') }));
    await expect(repository.deletePlaceComment('comment-1')).rejects.toThrow('delete failed');
  });

  it('rejects objectionable comment content before persistence', async () => {
    const repository = await import('@/mobile/app/data/repositories/placesRepository');

    await expect(
      repository.createPlaceComment('place-1', 'user-1', 'bu yorum amk'),
    ).rejects.toThrow('Yorum topluluk kurallarina aykiri ifade iceriyor.');
    await expect(
      repository.updatePlaceComment('comment-1', 'user-1', 's i k'),
    ).rejects.toThrow('Yorum topluluk kurallarina aykiri ifade iceriyor.');

    expect(fromMock).not.toHaveBeenCalled();
  });

  it('toggles comment likes for existing and missing likes', async () => {
    rpcMock.mockResolvedValue({ error: null });

    const { toggleLikePlaceComment } = await import('@/mobile/app/data/repositories/placesRepository');
    await toggleLikePlaceComment('comment-1', 'user-1');
    await toggleLikePlaceComment('comment-1', 'user-1');

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).toHaveBeenCalledWith('toggle_list_place_comment_like', {
      target_comment_id: 'comment-1',
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('propagates comment like failures', async () => {
    rpcMock.mockResolvedValueOnce({
      error: new Error('comment rpc failed'),
    });

    const { toggleLikePlaceComment } = await import('@/mobile/app/data/repositories/placesRepository');
    await expect(toggleLikePlaceComment('comment-1', 'user-1')).rejects.toThrow(
      'comment rpc failed',
    );

    rpcMock.mockResolvedValueOnce({
      error: { code: 'PGRST202', message: 'missing rpc' },
    });
    fromMock.mockReturnValueOnce(createSelectChain({
      data: null,
      error: new Error('comment like lookup failed'),
    }));

    await expect(toggleLikePlaceComment('comment-1', 'user-1')).rejects.toThrow(
      'comment like lookup failed',
    );

    rpcMock.mockResolvedValueOnce({
      error: { code: 'PGRST202', message: 'missing rpc' },
    });
    const existingLikeQuery = createSelectChain({
      data: { comment_id: 'comment-1' },
      error: null,
    });
    const deleteChain = createDeleteChain({ error: new Error('comment unlike failed') });

    fromMock
      .mockReturnValueOnce(existingLikeQuery)
      .mockReturnValueOnce(deleteChain);

    await expect(toggleLikePlaceComment('comment-1', 'user-1')).rejects.toThrow(
      'comment unlike failed',
    );

    rpcMock.mockResolvedValueOnce({
      error: { code: 'PGRST202', message: 'missing rpc' },
    });
    const missingLikeQuery = createSelectChain({
      data: null,
      error: null,
    });
    const insertMock = vi.fn().mockResolvedValue({ error: new Error('comment like failed') });

    fromMock
      .mockReturnValueOnce(missingLikeQuery)
      .mockReturnValueOnce({ insert: insertMock });

    await expect(toggleLikePlaceComment('comment-1', 'user-1')).rejects.toThrow(
      'comment like failed',
    );
  });

  it('reports places and comments with trimmed reasons', async () => {
    const reportPlaceUpsertMock = vi.fn().mockResolvedValue({ error: null });
    const reportCommentInsertMock = vi.fn().mockResolvedValue({ error: null });

    fromMock
      .mockReturnValueOnce({ upsert: reportPlaceUpsertMock })
      .mockReturnValueOnce({ insert: reportCommentInsertMock });

    const repository = await import('@/mobile/app/data/repositories/placesRepository');

    await repository.reportPlace('reporter-1', 'place-1', '  spam  ');
    await repository.reportPlaceComment('comment-1', 'reporter-1', '  abuse  ');

    expect(reportPlaceUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        list_place_id: 'place-1',
        reporter_user_id: 'reporter-1',
        reason: 'spam',
        created_at: expect.any(String),
      }),
      { onConflict: 'list_place_id,reporter_user_id' },
    );
    expect(reportCommentInsertMock).toHaveBeenCalledWith({
      comment_id: 'comment-1',
      reporter_user_id: 'reporter-1',
      reason: 'abuse',
    });
  });

  it('propagates place and comment report failures', async () => {
    const repository = await import('@/mobile/app/data/repositories/placesRepository');

    fromMock.mockReturnValueOnce({
      upsert: vi.fn().mockResolvedValue({ error: new Error('report place failed') }),
    });
    await expect(repository.reportPlace('reporter-1', 'place-1', 'spam')).rejects.toThrow(
      'report place failed',
    );

    fromMock.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: new Error('report comment failed') }),
    });
    await expect(
      repository.reportPlaceComment('comment-1', 'reporter-1', 'abuse'),
    ).rejects.toThrow('report comment failed');
  });
});
