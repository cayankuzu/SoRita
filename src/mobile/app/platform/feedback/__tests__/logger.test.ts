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

  // This test used to pin "no console output in production". That silence cost
  // a full day: a release build on a cable emitted not one diagnostic line, so
  // a deep-link bug could only be guessed at. What has to hold is not silence
  // but that nothing secret is printed, which is what this now proves.
  it('redacts sensitive metadata and mirrors the redacted line to the console', async () => {
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

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

    const printed = String(consoleWarnSpy.mock.calls[0]?.[0] ?? '');
    expect(printed).toContain('[SoRita][auth][WARN] Session refresh failed');
    for (const secret of ['secret-token', 'refresh-secret', 'user@example.com']) {
      expect(printed).not.toContain(secret);
    }
    expect(printed).toContain('[redacted]');

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

  it('keeps an error line free of secrets too', async () => {
    vi.stubGlobal('__DEV__', false);
    vi.doMock('@/mobile/app/platform/observability/sentry', () => ({
      captureAppMessage: captureAppMessageMock,
    }));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { logger } = await import('@/mobile/app/platform/feedback/logger');

    logger.error('media', 'Upload failed', { apiKey: 'sk-live-123', owner: 'user@example.com' });

    const printed = String(consoleErrorSpy.mock.calls[0]?.[0] ?? '');
    expect(printed).toContain('[SoRita][media][ERROR] Upload failed');
    expect(printed).not.toContain('sk-live-123');
    expect(printed).not.toContain('user@example.com');

    consoleErrorSpy.mockRestore();
  });
});
