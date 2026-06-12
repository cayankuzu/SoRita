import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchNotificationsMock = vi.fn();
const fetchNotificationsPageMock = vi.fn();
const eqMock = vi.fn();
const updateMock = vi.fn();
const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('@/mobile/app/data/repositories/notifications/notificationQueryHelpers', () => ({
  fetchNotifications: fetchNotificationsMock,
  fetchNotificationsPage: fetchNotificationsPageMock,
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

describe('notificationRepository', () => {
  beforeEach(() => {
    fetchNotificationsMock.mockReset();
    fetchNotificationsPageMock.mockReset();
    eqMock.mockReset();
    updateMock.mockReset();
    fromMock.mockReset();
    rpcMock.mockReset();

    eqMock.mockResolvedValue({ error: null });
    updateMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ update: updateMock });
    rpcMock.mockResolvedValue({ error: null });
  });

  it('refreshes and paginates notifications through the helper layer', async () => {
    fetchNotificationsPageMock.mockResolvedValue([{ id: 'n1' }]);
    fetchNotificationsMock.mockResolvedValue([{ id: 'n1', read: false }, { id: 'n2', read: true }]);
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await expect(repository.refreshNotifications('viewer-1')).resolves.toEqual([{ id: 'n1' }]);
    await expect(repository.getNotificationsPage('viewer-1', 20, 20)).resolves.toEqual([{ id: 'n1' }]);
    await expect(repository.getNotificationCount('viewer-1')).resolves.toBe(1);

    expect(fetchNotificationsPageMock).toHaveBeenCalledWith('viewer-1', 0, 20);
    expect(fetchNotificationsPageMock).toHaveBeenCalledWith('viewer-1', 20, 20);
  });

  it('marks notifications as read', async () => {
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await repository.markNotificationRead('notification-1');

    expect(fromMock).toHaveBeenCalledWith('notifications');
    expect(updateMock).toHaveBeenCalledWith({ read: true });
    expect(eqMock).toHaveBeenCalledWith('id', 'notification-1');
  });

  it('propagates notification update failures', async () => {
    eqMock.mockResolvedValueOnce({ error: new Error('update failed') });
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await expect(repository.markNotificationRead('notification-1')).rejects.toThrow('update failed');
  });

  it('responds to follow requests and marks the notification as read', async () => {
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await repository.respondToFollowRequestNotification('notification-1', 'request-1', 'accept');

    expect(rpcMock).toHaveBeenCalledWith('respond_to_follow_request', {
      input_request_id: 'request-1',
      input_decision: 'accept',
    });
    expect(eqMock).toHaveBeenCalledWith('id', 'notification-1');
  });

  it('propagates follow request decision failures', async () => {
    rpcMock.mockResolvedValueOnce({ error: new Error('rpc failed') });
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await expect(
      repository.respondToFollowRequestNotification('notification-1', 'request-1', 'reject'),
    ).rejects.toThrow('rpc failed');
    expect(eqMock).not.toHaveBeenCalled();
  });
});
