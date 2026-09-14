import { beforeEach, describe, expect, it, vi } from 'vitest';

const { showToastMock } = vi.hoisted(() => ({
  showToastMock: vi.fn(),
}));

vi.mock('@/mobile/app/platform/feedback/toast', () => ({
  showToast: showToastMock,
}));

import { deleteOwnedPlaceWithFeedback } from '@/mobile/app/features/places/application/deleteOwnedPlaceWithFeedback';

describe('deleteOwnedPlaceWithFeedback', () => {
  beforeEach(() => {
    showToastMock.mockReset();
  });

  it('propagates a user-facing failure so the confirmation remains open', async () => {
    const backendError = new Error('delete failed');
    const deletePlace = vi.fn().mockRejectedValueOnce(backendError);
    const onDeleted = vi.fn();

    await expect(
      deleteOwnedPlaceWithFeedback({
        deletePlace,
        onDeleted,
        placeId: 'place-1',
      }),
    ).rejects.toMatchObject({
      cause: backendError,
      message: 'delete failed',
    });

    expect(deletePlace).toHaveBeenCalledWith('place-1');
    expect(onDeleted).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledTimes(1);
    expect(showToastMock).toHaveBeenCalledWith('delete failed', 'error');
  });

  it('uses a useful fallback instead of surfacing a blank backend error', async () => {
    const deletePlace = vi.fn().mockRejectedValueOnce(new Error('   '));

    await expect(
      deleteOwnedPlaceWithFeedback({
        deletePlace,
        onDeleted: vi.fn(),
        placeId: 'place-1',
      }),
    ).rejects.toThrow(/.+/u);

    expect(showToastMock).toHaveBeenCalledWith(expect.stringMatching(/.+/u), 'error');
  });

  it('closes the surface and emits one success toast after deletion succeeds', async () => {
    const deletePlace = vi.fn().mockResolvedValueOnce(undefined);
    const onDeleted = vi.fn();

    await deleteOwnedPlaceWithFeedback({
      deletePlace,
      onDeleted,
      placeId: 'place-1',
    });

    expect(onDeleted).toHaveBeenCalledOnce();
    expect(showToastMock).toHaveBeenCalledTimes(1);
    expect(showToastMock).toHaveBeenCalledWith(expect.any(String), 'success');
  });
});
