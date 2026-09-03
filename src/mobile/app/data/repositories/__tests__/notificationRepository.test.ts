import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchNotificationsMock = vi.fn();
const fetchNotificationsCursorPageMock = vi.fn();
const eqMock = vi.fn();
const limitMock = vi.fn();
const selectMock = vi.fn();
const updateMock = vi.fn();
const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('@/mobile/app/data/repositories/notifications/notificationQueryHelpers', () => ({
  fetchNotifications: fetchNotificationsMock,
  fetchNotificationsCursorPage: fetchNotificationsCursorPageMock,
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
    fetchNotificationsCursorPageMock.mockReset();
    eqMock.mockReset();
    limitMock.mockReset();
    selectMock.mockReset();
    updateMock.mockReset();
    fromMock.mockReset();
    rpcMock.mockReset();

    eqMock.mockResolvedValue({ error: null });
    updateMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ update: updateMock });
    rpcMock.mockResolvedValue({ error: null });
  });

  it('refreshes and paginates notifications through the helper layer', async () => {
    const firstPage = Object.assign(
      Array.from({ length: 20 }, (_, index) => ({ id: `n${index}`, read: false })),
      { nextCursor: { createdAt: '2026-01-01T00:00:00.000Z', id: 'n19' } },
    );
    fetchNotificationsCursorPageMock.mockImplementation(
      ({ cursor }: { cursor?: { id: string } | null }) =>
        Promise.resolve(cursor ? [{ id: 'n20', read: false }] : firstPage),
    );
    fetchNotificationsMock.mockResolvedValue([{ id: 'n1', read: false }, { id: 'n2', read: true }]);
    rpcMock.mockResolvedValue({ data: 1, error: null });
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await expect(repository.refreshNotifications('viewer-1')).resolves.toEqual(firstPage);
    await expect(repository.getNotificationsPage('viewer-1', 20, 20)).resolves.toEqual([{ id: 'n20', read: false }]);
    await expect(repository.getNotificationCount('viewer-1')).resolves.toBe(1);

    expect(fetchNotificationsCursorPageMock).toHaveBeenCalledWith({
      pageSize: 20,
      userId: 'viewer-1',
    });
    expect(fetchNotificationsCursorPageMock).toHaveBeenCalledWith({
      cursor: firstPage.nextCursor,
      pageSize: 20,
      userId: 'viewer-1',
    });
  });

  it('uses direct and first-page helper paths without an offset loop', async () => {
    const direct = [{ id: 'direct' }];
    const cursorPage = Object.assign([{ id: 'cursor' }], { nextCursor: undefined });
    fetchNotificationsMock.mockResolvedValue(direct);
    fetchNotificationsCursorPageMock.mockResolvedValue(cursorPage);
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await expect(repository.getNotifications('viewer-1')).resolves.toBe(direct);
    await expect(repository.getNotificationsPage('viewer-1', 0, 10)).resolves.toBe(cursorPage);
    await expect(repository.getNotificationsCursorPage({ pageSize: 10, userId: 'viewer-1' })).resolves.toBe(cursorPage);
  });

  it('stops offset emulation when the keyset source is exhausted', async () => {
    fetchNotificationsCursorPageMock.mockResolvedValueOnce(Object.assign([{ id: 'only' }], { nextCursor: undefined }));
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await expect(repository.getNotificationsPage('viewer-1', 10, 10)).resolves.toEqual([]);
    expect(fetchNotificationsCursorPageMock).toHaveBeenCalledOnce();
  });

  it('caps each compatibility page at fifty rows', async () => {
    const first = Object.assign(
      Array.from({ length: 50 }, (_, index) => ({ id: `n-${index}` })),
      { nextCursor: { createdAt: '2026-01-01', id: 'n-49' } },
    );
    const second = Object.assign(
      Array.from({ length: 20 }, (_, index) => ({ id: `n-${index + 50}` })),
      { nextCursor: undefined },
    );
    fetchNotificationsCursorPageMock.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await expect(repository.getNotificationsPage('viewer-1', 55, 10)).resolves.toEqual(second.slice(5, 15));
    expect(fetchNotificationsCursorPageMock.mock.calls.map(([input]) => input.pageSize)).toEqual([50, 15]);
  });

  it('accepts numeric string counts and rejects invalid responses', async () => {
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    rpcMock.mockResolvedValueOnce({ data: '12', error: null });
    await expect(repository.getNotificationCount('viewer-1')).resolves.toBe(12);

    rpcMock.mockResolvedValueOnce({ data: 'not-a-number', error: null });
    await expect(repository.getNotificationCount('viewer-1')).rejects.toThrow('response was invalid');

    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('count failed') });
    await expect(repository.getNotificationCount('viewer-1')).rejects.toThrow('count failed');
  });

  it('marks notifications as read', async () => {
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await repository.markNotificationRead('notification-1');

    expect(fromMock).toHaveBeenCalledWith('notifications');
    expect(updateMock).toHaveBeenCalledWith({ read: true });
    expect(eqMock).toHaveBeenCalledWith('id', 'notification-1');
  });

  it('resolves detailed push navigation only from the recipient-owned notification row', async () => {
    const recipientEqMock = vi.fn().mockReturnValue({ limit: limitMock });
    const idEqMock = vi.fn().mockReturnValue({ eq: recipientEqMock });
    limitMock.mockResolvedValue({
      data: [{
        actor_user_id: '22222222-2222-4222-8222-222222222222',
        id: '11111111-1111-4111-8111-111111111111',
        list_id: '33333333-3333-4333-8333-333333333333',
        list_place_id: '44444444-4444-4444-8444-444444444444',
        recipient_user_id: 'viewer-1',
        type: 'comment',
      }],
      error: null,
    });
    selectMock.mockReturnValue({ eq: idEqMock });
    fromMock.mockReturnValue({ select: selectMock, update: updateMock });
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await expect(repository.getVerifiedPushNotificationTarget(
      '11111111-1111-4111-8111-111111111111',
      'viewer-1',
    )).resolves.toEqual({
      actorUserId: '22222222-2222-4222-8222-222222222222',
      id: '11111111-1111-4111-8111-111111111111',
      listId: '33333333-3333-4333-8333-333333333333',
      placeId: '44444444-4444-4444-8444-444444444444',
      recipientUserId: 'viewer-1',
      type: 'comment',
    });

    expect(selectMock).toHaveBeenCalledWith(
      'id, recipient_user_id, actor_user_id, type, list_id, list_place_id',
    );
    expect(idEqMock).toHaveBeenCalledWith('id', '11111111-1111-4111-8111-111111111111');
    expect(recipientEqMock).toHaveBeenCalledWith('recipient_user_id', 'viewer-1');
    expect(limitMock).toHaveBeenCalledWith(1);
  });

  it('refuses unknown notification types when resolving a push route', async () => {
    const recipientEqMock = vi.fn().mockReturnValue({ limit: limitMock });
    const idEqMock = vi.fn().mockReturnValue({ eq: recipientEqMock });
    limitMock.mockResolvedValue({
      data: [{
        id: '11111111-1111-4111-8111-111111111111',
        recipient_user_id: 'viewer-1',
        type: 'untrusted_new_type',
      }],
      error: null,
    });
    selectMock.mockReturnValue({ eq: idEqMock });
    fromMock.mockReturnValue({ select: selectMock, update: updateMock });
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await expect(repository.getVerifiedPushNotificationTarget(
      '11111111-1111-4111-8111-111111111111',
      'viewer-1',
    )).resolves.toBeNull();
  });

  it('fails closed if a returned notification row belongs to another recipient', async () => {
    const recipientEqMock = vi.fn().mockReturnValue({ limit: limitMock });
    const idEqMock = vi.fn().mockReturnValue({ eq: recipientEqMock });
    limitMock.mockResolvedValue({
      data: [{
        id: '11111111-1111-4111-8111-111111111111',
        recipient_user_id: 'another-viewer',
        type: 'comment',
      }],
      error: null,
    });
    selectMock.mockReturnValue({ eq: idEqMock });
    fromMock.mockReturnValue({ select: selectMock, update: updateMock });
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await expect(repository.getVerifiedPushNotificationTarget(
      '11111111-1111-4111-8111-111111111111',
      'viewer-1',
    )).resolves.toBeNull();
  });

  it('propagates notification update failures', async () => {
    eqMock.mockResolvedValueOnce({ error: new Error('update failed') });
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await expect(repository.markNotificationRead('notification-1')).rejects.toThrow('update failed');
  });

  it('marks only unread notifications for the current recipient', async () => {
    const finalEqMock = vi.fn().mockResolvedValue({ error: null });
    const firstEqMock = vi.fn().mockReturnValue({ eq: finalEqMock });
    updateMock.mockReturnValue({ eq: firstEqMock });
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await repository.markAllNotificationsRead('viewer-1');

    expect(firstEqMock).toHaveBeenCalledWith('recipient_user_id', 'viewer-1');
    expect(finalEqMock).toHaveBeenCalledWith('read', false);
  });

  it('propagates bulk notification update failures', async () => {
    const finalEqMock = vi.fn().mockResolvedValue({ error: new Error('bulk failed') });
    updateMock.mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: finalEqMock }) });
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await expect(repository.markAllNotificationsRead('viewer-1')).rejects.toThrow('bulk failed');
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

  it('creates place quote notifications through the rpc layer', async () => {
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await repository.createPlaceQuoteNotification({
      actorUserId: 'user-1',
      listId: 'list-1',
      message: '"Original Cafe" mekanini kendi listesine alintiladi',
      placeId: 'place-1',
      recipientUserId: 'user-2',
    });

    expect(rpcMock).toHaveBeenCalledWith('create_place_quote_notification', {
      input_list_id: 'list-1',
      input_list_place_id: 'place-1',
      input_message: '"Original Cafe" mekanini kendi listesine alintiladi',
      input_recipient_user_id: 'user-2',
    });
  });

  it('skips place quote notification creation for self-attribution', async () => {
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await repository.createPlaceQuoteNotification({
      actorUserId: 'user-1',
      message: 'ignored',
      recipientUserId: 'user-1',
    });

    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    { actorUserId: '', recipientUserId: 'user-2' },
    { actorUserId: 'user-1', recipientUserId: '' },
  ])('skips malformed quote notification identities', async (identities) => {
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await repository.createPlaceQuoteNotification({ ...identities, message: 'ignored' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('normalizes absent quote link ids and propagates rpc failures', async () => {
    rpcMock.mockResolvedValueOnce({ error: new Error('quote failed') });
    const repository = await import('@/mobile/app/data/repositories/notificationRepository');

    await expect(repository.createPlaceQuoteNotification({
      actorUserId: 'user-1',
      message: 'quote',
      recipientUserId: 'user-2',
    })).rejects.toThrow('quote failed');
    expect(rpcMock).toHaveBeenCalledWith('create_place_quote_notification', {
      input_list_id: null,
      input_list_place_id: null,
      input_message: 'quote',
      input_recipient_user_id: 'user-2',
    });
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
