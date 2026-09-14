import { afterEach, describe, expect, it, vi } from 'vitest';

const loggerDebugMock = vi.fn();

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: {
    debug: loggerDebugMock,
  },
}));

describe('auth session lifecycle coordination', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs only the current scheduled revalidation callback', async () => {
    const callbacks: Array<() => void> = [];
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback) => {
      callbacks.push(callback as () => void);
      return callbacks.length as unknown as ReturnType<typeof setTimeout>;
    });
    const revalidate = vi.fn();
    const { createSessionRevalidationScheduler } = await import(
      '@/mobile/app/app-shell/auth/session/authSessionLifecycleCoordination'
    );
    const scheduler = createSessionRevalidationScheduler(revalidate);

    scheduler.schedule(null, 1_000);
    scheduler.schedule(null, 1_000);
    callbacks[0]();
    callbacks[1]();

    expect(revalidate).toHaveBeenCalledOnce();
    expect(revalidate).toHaveBeenCalledWith({ refreshIfExpiring: true });
  });

  it('suppresses the bootstrap fallback after work has settled', async () => {
    vi.useFakeTimers();
    const showFallback = vi.fn();
    const { createAuthBootstrapFallback } = await import(
      '@/mobile/app/app-shell/auth/session/authSessionLifecycleCoordination'
    );
    const fallback = createAuthBootstrapFallback(() => false, showFallback);

    fallback.start();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(showFallback).not.toHaveBeenCalled();
    expect(loggerDebugMock).not.toHaveBeenCalled();
  });

  it('rejects stale assignment and immediate-start operations', async () => {
    const { createAuthScopeOperationCoordinator } = await import(
      '@/mobile/app/app-shell/auth/session/authSessionLifecycleCoordination'
    );
    const coordinator = createAuthScopeOperationCoordinator(() => true);
    const staleOperation = coordinator.begin('user-a');
    coordinator.begin('user-b');
    const staleTask = vi.fn(async () => undefined);

    expect(coordinator.assignUser(staleOperation, 'user-c')).toBe(false);
    await coordinator.start(staleOperation, staleTask);

    expect(staleTask).not.toHaveBeenCalled();
  });
});
