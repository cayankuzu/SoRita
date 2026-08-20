import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onlineManager } from '@tanstack/react-query';
import {
  clearAllOutboxEntries,
  readOutboxEntries,
} from '@/mobile/app/data/outbox/outboxStorage';

const callJsonEdgeFunctionMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock('@/mobile/app/platform/api/edgeFunctions', () => ({
  callJsonEdgeFunction: callJsonEdgeFunctionMock,
}));

vi.mock('@/mobile/app/platform/config/env', () => ({
  env: {
    supabaseModerationReportsFunctionName: 'moderation-reports',
  },
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}));

describe('moderationReports', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    onlineManager.setOnline(true);
    await clearAllOutboxEntries();
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'access-token' } },
      error: null,
    });
    callJsonEdgeFunctionMock.mockResolvedValue({ success: true });
  });

  it('submits each supported target through the authenticated edge function', async () => {
    const { submitModerationReport } = await import('@/mobile/app/data/repositories/moderationReports');
    const payloads = [
      { commentId: 'comment-1', reason: 'spam', reporterUserId: 'viewer', targetType: 'comment' as const },
      { listId: 'list-1', reason: 'spam', reporterUserId: 'viewer', targetType: 'list' as const },
      { placeId: 'place-1', reason: 'spam', reporterUserId: 'viewer', targetType: 'place' as const },
      { details: 'details', reason: 'spam', reporterUserId: 'viewer', targetType: 'user' as const, targetUserId: 'user-1' },
    ];

    for (const payload of payloads) {
      await submitModerationReport(payload);
    }

    expect(callJsonEdgeFunctionMock).toHaveBeenCalledTimes(4);
    expect(callJsonEdgeFunctionMock).toHaveBeenLastCalledWith(
      'moderation-reports',
      payloads[3],
      { accessToken: 'access-token' },
    );
  });

  it('fails before the network call when session retrieval fails', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: { message: 'session error' } });
    const { submitModerationReport } = await import('@/mobile/app/data/repositories/moderationReports');

    await expect(submitModerationReport({
      placeId: 'place-1',
      reason: 'spam',
      reporterUserId: 'viewer',
      targetType: 'place',
    })).rejects.toThrow('session error');
    expect(callJsonEdgeFunctionMock).not.toHaveBeenCalled();
  });

  it('requires an authenticated access token', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    const { submitModerationReport } = await import('@/mobile/app/data/repositories/moderationReports');

    await expect(submitModerationReport({
      reason: 'spam',
      reporterUserId: 'viewer',
      targetType: 'user',
      targetUserId: 'user-1',
    })).rejects.toThrow();
    expect(callJsonEdgeFunctionMock).not.toHaveBeenCalled();
  });

  it('queues reports while offline without requesting a session', async () => {
    onlineManager.setOnline(false);
    const { submitModerationReport } = await import('@/mobile/app/data/repositories/moderationReports');

    await submitModerationReport({
      details: 'details',
      placeId: 'place-1',
      reason: 'spam',
      reporterUserId: 'viewer',
      targetType: 'place',
    });

    expect(getSessionMock).not.toHaveBeenCalled();
    expect(callJsonEdgeFunctionMock).not.toHaveBeenCalled();
    await expect(readOutboxEntries('viewer')).resolves.toEqual([
      expect.objectContaining({
        kind: 'moderation-report',
        payloadRef: {
          details: 'details',
          placeId: 'place-1',
          reason: 'spam',
          targetType: 'place',
        },
      }),
    ]);
  });

  it('builds durable ids for every offline report target', async () => {
    onlineManager.setOnline(false);
    const { submitModerationReport } = await import('@/mobile/app/data/repositories/moderationReports');

    await submitModerationReport({
      commentId: 'comment-1', reason: 'spam', reporterUserId: 'viewer', targetType: 'comment',
    });
    await submitModerationReport({
      listId: 'list-1', reason: 'spam', reporterUserId: 'viewer', targetType: 'list',
    });
    await submitModerationReport({
      reason: 'spam', reporterUserId: 'viewer', targetType: 'user', targetUserId: 'user-1',
    });

    await expect(readOutboxEntries('viewer')).resolves.toHaveLength(3);
    expect(getSessionMock).not.toHaveBeenCalled();
  });
});
