import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('app toast runtime', () => {
  beforeEach(async () => {
    const { toastInternals } = await import('../toast');
    toastInternals.reset();
  });

  it('delivers non-blocking toast messages to the mounted host', async () => {
    const { showToast, subscribeToToasts } = await import('../toast');
    const listener = vi.fn();
    const unsubscribe = subscribeToToasts(listener);

    showToast('Kaydedildi', 'success');

    expect(listener).toHaveBeenCalledWith({
      id: 1,
      kind: 'success',
      message: 'Kaydedildi',
    });
    unsubscribe();
  });

  it('suppresses duplicate feedback fired by the same interaction', async () => {
    const { showToast, subscribeToToasts } = await import('../toast');
    const listener = vi.fn();
    const unsubscribe = subscribeToToasts(listener);

    showToast('Liste güncellendi', 'info');
    showToast('Liste güncellendi', 'info');

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
