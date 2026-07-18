import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captureAppMessageMock = vi.fn();

describe('logger', () => {
  beforeEach(() => {
    captureAppMessageMock.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock('@/mobile/app/platform/observability/sentry');
  });

  it('redacts sensitive metadata and avoids console output in production mode', async () => {
    vi.stubGlobal('__DEV__', false);
    vi.doMock('@/mobile/app/platform/observability/sentry', () => ({
      captureAppMessage: captureAppMessageMock,
    }));
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { logger } = await import('@/mobile/app/platform/feedback/logger');

    logger.warn('auth', 'Session refresh failed', {
      access_token: 'secret-token',
      email: 'user@example.com',
      nested: {
        refresh_token: 'refresh-secret',
        value: 'contact user@example.com',
      },
    });

    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(captureAppMessageMock).toHaveBeenCalledWith('[auth] Session refresh failed', {
      extras: {
        access_token: '[redacted]',
        email: '[redacted]',
        nested: {
          refresh_token: '[redacted]',
          value: 'contact [redacted-email]',
        },
      },
      level: 'warning',
    });

    consoleWarnSpy.mockRestore();
  });
});
