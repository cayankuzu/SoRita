import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEdgeRequestContext, logEdgeEvent } from './edgeLogger';

describe('edgeLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds a PII-minimal request context without proxy metadata', () => {
    const generatedContext = createEdgeRequestContext(
      new Request('https://example.com/test', { method: 'POST' }),
      'media-assets',
    );
    expect(generatedContext).toMatchObject({ method: 'POST', origin: null, route: 'media-assets' });
    expect(generatedContext).not.toHaveProperty('clientIp');
    expect(generatedContext).not.toHaveProperty('userAgent');
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
      method: 'GET',
      origin: 'https://app.example.com',
      requestId: expect.any(String),
      route: 'auth-gateway',
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
      error: '[redacted]',
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
