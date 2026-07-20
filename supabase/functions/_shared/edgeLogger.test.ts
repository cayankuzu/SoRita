import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEdgeRequestContext, logEdgeEvent } from './edgeLogger';

describe('edgeLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds request context without trusting proxy metadata', () => {
    const generatedContext = createEdgeRequestContext(
      new Request('https://example.com/test', { method: 'POST' }),
      'media-assets',
    );
    expect(generatedContext).toMatchObject({
      clientIp: null,
      method: 'POST',
      origin: null,
      route: 'media-assets',
      userAgent: null,
    });
    expect(generatedContext.requestId).toBeTruthy();

    expect(
      createEdgeRequestContext(
        new Request('https://example.com/test', {
          headers: {
            Origin: 'https://app.example.com',
            'user-agent': 'test-agent',
            'x-forwarded-for': ' 203.0.113.4, 10.0.0.1',
            'x-request-id': 'request-1',
          },
        }),
        'auth-gateway',
      ),
    ).toEqual({
      clientIp: '203.0.113.4',
      method: 'GET',
      origin: 'https://app.example.com',
      requestId: 'request-1',
      route: 'auth-gateway',
      userAgent: 'test-agent',
    });
  });

  it('redacts sensitive values, errors, emails, and deeply nested details', () => {
    const infoSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const context = createEdgeRequestContext(
      new Request('https://example.com', { headers: { 'x-request-id': 'request-2' } }),
      'route',
    );

    logEdgeEvent('info', 'safe-event', context, {
      authorization: 'Bearer private',
      contact: 'person@example.com',
      count: 2,
      error: new Error('failed for owner@example.com'),
      nullable: null,
      rows: [{ api_key: 'private', nested: { deeper: { value: 'hidden-by-depth' } } }],
    });

    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload).toMatchObject({ level: 'info', message: 'safe-event' });
    expect(payload.details).toEqual({
      authorization: '[redacted]',
      contact: '[redacted-email]',
      count: 2,
      error: { message: 'failed for [redacted-email]', name: 'Error' },
      nullable: undefined,
      rows: [{ api_key: '[redacted]', nested: '[truncated]' }],
    });
  });

  it('routes warning and error events to their severity consoles', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const context = createEdgeRequestContext(new Request('https://example.com'), 'route');

    logEdgeEvent('warn', 'warning', context);
    logEdgeEvent('error', 'failure', context, 'operator@example.com');

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('[redacted-email]');
  });
});
