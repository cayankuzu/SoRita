import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook } from '@/mobile/app/test/hookTestUtils';

const showToastMock = vi.fn();

vi.mock('@/mobile/app/platform/feedback/toast', () => ({
  showToast: showToastMock,
}));

describe('useFeedActionBarState', () => {
  beforeEach(() => {
    showToastMock.mockReset();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  it('counts nested comments and prefixes replies with the username', async () => {
    const onCommentSubmit = vi.fn().mockResolvedValue(undefined);
    const onUserPress = vi.fn();
    const hooks = await import('@/mobile/app/features/social/application/useFeedActionBarState');
    const comment = {
      id: 'comment-1',
      userId: 'user-1',
      userName: 'Ada',
      username: 'ada',
      content: 'hello',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      replies: [
        {
          id: 'reply-1',
          userId: 'user-2',
          userName: 'Grace',
          content: 'reply',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          replies: [],
        },
      ],
    };

    const hook = renderHook(() =>
      hooks.useFeedActionBarState({
        comments: [comment],
        onCommentSubmit,
        onUserPress,
      }),
    );

    expect(hook.result.current.commentCount).toBe(2);

    act(() => {
      hook.result.current.handleStartReply(comment);
      hook.result.current.setCommentText('tesekkurler');
    });
    await hook.result.current.handleCommentSubmit();

    expect(onCommentSubmit).toHaveBeenCalledWith('@ada tesekkurler', 'comment-1');

    act(() => {
      hook.result.current.handleUserPress('user-1');
    });
    expect(onUserPress).toHaveBeenCalledWith('user-1');
  });

  it('surfaces callback failures through toasts', async () => {
    const onLikePress = vi.fn().mockRejectedValue(new Error('like failed'));
    const hooks = await import('@/mobile/app/features/social/application/useFeedActionBarState');
    const hook = renderHook(() =>
      hooks.useFeedActionBarState({
        comments: [],
        onLikePress,
      }),
    );

    await hook.result.current.handleLikePress();

    expect(showToastMock).toHaveBeenCalledWith('like failed', 'error');
  });

  it('supports editing, deleting, reporting, and refreshing comment flows', async () => {
    const onCommentDelete = vi.fn().mockResolvedValue(undefined);
    const onCommentLikeToggle = vi.fn().mockResolvedValue(undefined);
    const onCommentReport = vi.fn().mockResolvedValue(undefined);
    const onCommentSubmit = vi.fn().mockResolvedValue(undefined);
    const onCommentUpdate = vi.fn().mockResolvedValue(undefined);
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const onReportSubmit = vi.fn().mockResolvedValue(undefined);
    const hooks = await import('@/mobile/app/features/social/application/useFeedActionBarState');
    const comment = {
      id: 'comment-1',
      userId: 'user-1',
      userName: 'Ada',
      username: 'ada',
      content: 'hello',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      replies: [],
    };

    const hook = renderHook(() =>
      hooks.useFeedActionBarState({
        comments: [comment],
        onCommentDelete,
        onCommentLikeToggle,
        onCommentReport,
        onCommentSubmit,
        onCommentUpdate,
        onRefresh,
        onReportSubmit,
      }),
    );

    act(() => {
      hook.result.current.handleStartEdit(comment);
      hook.result.current.setCommentText('updated comment');
    });
    await hook.result.current.handleCommentSubmit();
    expect(onCommentUpdate).toHaveBeenCalledWith('comment-1', 'updated comment');

    act(() => {
      hook.result.current.handleStartReport('comment-1');
      hook.result.current.setReportReason('spam');
    });
    await hook.result.current.handleCommentReport('comment-1');
    expect(onCommentReport).toHaveBeenCalledWith('comment-1', 'spam', undefined);

    act(() => {
      hook.result.current.setItemReportReason('abuse');
      hook.result.current.setShowReportSheet(true);
    });
    await hook.result.current.handleItemReport();
    expect(onReportSubmit).toHaveBeenCalledWith('abuse', undefined);

    await hook.result.current.handleCommentLikeToggle('comment-1');
    await hook.result.current.handleDeleteComment('comment-1');
    await hook.result.current.handleRefreshComments();
    await hook.result.current.handleRefreshLikers();

    expect(onCommentLikeToggle).toHaveBeenCalledWith('comment-1');
    expect(onCommentDelete).toHaveBeenCalledWith('comment-1');
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it('blocks editing after the allowed comment window expires', async () => {
    const hooks = await import('@/mobile/app/features/social/application/useFeedActionBarState');
    const comment = {
      id: 'comment-1',
      userId: 'user-1',
      userName: 'Ada',
      username: 'ada',
      content: 'hello',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      editWindowExpired: true,
      replies: [],
    };

    const hook = renderHook(() =>
      hooks.useFeedActionBarState({
        comments: [comment],
      }),
    );

    act(() => {
      hook.result.current.handleStartEdit(comment);
    });

    expect(hook.result.current.editingCommentId).toBeNull();
    expect(hook.result.current.commentText).toBe('');
    expect(showToastMock).toHaveBeenCalledWith(
      'Düzenleme süresi doldu. Yorum yalnızca ilk 3 dakika içinde düzenlenebilir.',
      'error',
    );
  });

  it('blocks editing while a new comment is still syncing', async () => {
    const hooks = await import('@/mobile/app/features/social/application/useFeedActionBarState');
    const comment = {
      id: 'comment-1',
      userId: 'user-1',
      userName: 'Ada',
      username: 'ada',
      content: 'hello',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      pendingSync: true,
      replies: [],
    };

    const hook = renderHook(() =>
      hooks.useFeedActionBarState({
        comments: [comment],
      }),
    );

    act(() => {
      hook.result.current.handleStartEdit(comment);
    });

    expect(hook.result.current.editingCommentId).toBeNull();
    expect(showToastMock).toHaveBeenCalledWith('Yorum gönderiliyor...', 'error');
  });

  it('handles comment/report callback failures and reset behavior', async () => {
    const onCommentDelete = vi.fn().mockRejectedValue(new Error('delete failed'));
    const onCommentLikeToggle = vi.fn().mockRejectedValue(new Error('like failed'));
    const onCommentReport = vi.fn().mockRejectedValue(new Error('report failed'));
    const onCommentSubmit = vi.fn().mockRejectedValue(new Error('submit failed'));
    const onReportSubmit = vi.fn().mockRejectedValue(new Error('item report failed'));
    const hooks = await import('@/mobile/app/features/social/application/useFeedActionBarState');
    const comment = {
      id: 'comment-1',
      userId: 'user-1',
      userName: 'Ada',
      username: 'ada',
      content: 'hello',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      replies: [],
    };

    const hook = renderHook(() =>
      hooks.useFeedActionBarState({
        comments: [comment],
        onCommentDelete,
        onCommentLikeToggle,
        onCommentReport,
        onCommentSubmit,
        onReportSubmit,
      }),
    );

    act(() => {
      hook.result.current.handleStartReply(comment);
      hook.result.current.setCommentText('reply');
      hook.result.current.setReportReason('spam');
      hook.result.current.setItemReportReason('abuse');
    });

    await hook.result.current.handleCommentSubmit();
    await hook.result.current.handleCommentLikeToggle('comment-1');
    await hook.result.current.handleCommentReport('comment-1');
    await hook.result.current.handleDeleteComment('comment-1');
    await hook.result.current.handleItemReport();

    act(() => {
      hook.result.current.resetCommentComposer();
    });

    expect(hook.result.current.commentText).toBe('');
    expect(showToastMock).toHaveBeenCalled();
  });

  it('guards absent callbacks, clamps count overrides, and clears deleted active comment state', async () => {
    const hooks = await import('@/mobile/app/features/social/application/useFeedActionBarState');
    expect(hooks.feedActionBarInternals.getErrorMessage(new Error('specific'), 'fallback')).toBe('specific');
    expect(hooks.feedActionBarInternals.getErrorMessage(new Error(' '), 'fallback')).toBe('fallback');
    expect(hooks.feedActionBarInternals.getErrorMessage('failure', 'fallback')).toBe('fallback');
    const comment = {
      id: 'comment-1', userId: 'user-1', userName: 'Ada', username: 'ada', content: 'hello',
      createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
      replies: [],
    };
    const guardedHook = renderHook(() => hooks.useFeedActionBarState({
      comments: [comment], commentCountOverride: -4,
    }));
    expect(guardedHook.result.current.commentCount).toBe(0);
    await act(async () => {
      await guardedHook.result.current.handleLikePress();
      await guardedHook.result.current.handleCommentSubmit();
      await guardedHook.result.current.handleDeleteComment(comment.id);
      await guardedHook.result.current.handleRefreshComments();
      await guardedHook.result.current.handleRefreshLikers();
      await guardedHook.result.current.handleCommentReport(comment.id);
      await guardedHook.result.current.handleCommentLikeToggle(comment.id);
      await guardedHook.result.current.handleItemReport();
    });

    let releaseRefresh!: () => void;
    const refreshPromise = new Promise<void>((resolve) => { releaseRefresh = resolve; });
    const onRefresh = vi.fn().mockReturnValue(refreshPromise);
    const onCommentDelete = vi.fn().mockResolvedValue(undefined);
    const hook = renderHook(() => hooks.useFeedActionBarState({
      comments: [comment], onCommentDelete, onCommentSubmit: vi.fn(), onRefresh,
    }));
    act(() => {
      hook.result.current.handleStartEdit(comment);
      hook.result.current.setReplyingTo({
        commentId: comment.id, userName: comment.userName, username: comment.username,
      });
      hook.result.current.setActiveReportCommentId(comment.id);
      hook.result.current.setReportReason('spam');
      hook.result.current.setReportDetails('details');
    });
    await act(async () => {
      await hook.result.current.handleDeleteComment(comment.id);
    });
    expect(hook.result.current.editingCommentId).toBeNull();
    expect(hook.result.current.replyingTo).toBeNull();
    expect(hook.result.current.activeReportCommentId).toBeNull();
    expect(hook.result.current.reportReason).toBe('');

    let firstRefresh: Promise<void> | undefined;
    await act(async () => {
      firstRefresh = hook.result.current.handleRefreshComments();
      await Promise.resolve();
    });
    await hook.result.current.handleRefreshComments();
    expect(onRefresh).toHaveBeenCalledOnce();
    releaseRefresh();
    await act(async () => {
      await firstRefresh;
    });

    let firstLikerRefresh: Promise<void> | undefined;
    const secondRefreshPromise = Promise.resolve();
    onRefresh.mockReturnValue(secondRefreshPromise);
    await act(async () => {
      firstLikerRefresh = hook.result.current.handleRefreshLikers();
      await firstLikerRefresh;
    });
    expect(onRefresh).toHaveBeenCalledTimes(2);

    act(() => {
      hook.result.current.handleStartEdit(comment);
      hook.result.current.setCommentText('edited');
    });
    await hook.result.current.handleCommentSubmit();
    expect(hook.result.current.editingCommentId).toBe(comment.id);
  });
});
