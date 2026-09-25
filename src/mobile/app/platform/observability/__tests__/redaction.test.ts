import { describe, expect, it } from 'vitest';

// A made-up token in JWT shape, assembled here so secret scanners do not
// mistake the fixture for a leaked credential.
const TOKEN = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', 'c2lnbmF0dXJlLXZhbHVl'].join('.');
const SIGNED_URL =
  'https://example.supabase.co/storage/v1/object/sign/place-media-private/a.jpg?token=abc.def.ghi&download=1';

describe('redaction', () => {
  it('removes addresses, session tokens and signed-URL secrets from text', async () => {
    const { redactString } = await import('@/mobile/app/platform/observability/redaction');

    expect(redactString('ada@example.com could not sign in')).toBe('[redacted-email] could not sign in');
    expect(redactString(`Bearer ${TOKEN}`)).toBe('Bearer [redacted-token]');
    expect(redactString(SIGNED_URL)).toBe(
      'https://example.supabase.co/storage/v1/object/sign/place-media-private/a.jpg?token=[redacted]&download=1',
    );
    expect(redactString('nothing to hide')).toBe('nothing to hide');
  });

  it('blanks sensitive keys and redacts nested text', async () => {
    const { redactValue } = await import('@/mobile/app/platform/observability/redaction');

    expect(
      redactValue({
        accessToken: TOKEN,
        nested: { url: SIGNED_URL, count: 3 },
        user: { email: 'ada@example.com', id: 'user-1' },
      }),
    ).toEqual({
      accessToken: '[redacted]',
      nested: { url: expect.stringContaining('token=[redacted]'), count: 3 },
      user: { email: '[redacted]', id: 'user-1' },
    });
    expect(redactValue(new Error('ada@example.com failed'))).toEqual({
      name: 'Error',
      message: '[redacted-email] failed',
    });
  });

  it('scrubs Sentry events and breadcrumbs before they leave the device', async () => {
    const { redactBreadcrumb, redactEvent } = await import(
      '@/mobile/app/platform/observability/redaction'
    );

    const event = redactEvent({
      type: undefined,
      message: `upload failed for ${SIGNED_URL}`,
      exception: { values: [{ type: 'Error', value: `session ${TOKEN} expired` }] },
      extra: { refresh_token: 'secret', note: 'ada@example.com' },
      request: { url: SIGNED_URL },
      breadcrumbs: [{ category: 'fetch', data: { url: SIGNED_URL } }],
    });

    expect(event.message).toContain('token=[redacted]');
    expect(event.exception?.values?.[0]?.value).toBe('session [redacted-token] expired');
    expect(event.extra).toEqual({ refresh_token: '[redacted]', note: '[redacted-email]' });
    expect(event.request?.url).toContain('token=[redacted]');
    expect(event.breadcrumbs?.[0]?.data?.url).toContain('token=[redacted]');
    expect(redactBreadcrumb({ message: 'signed in as ada@example.com' }).message).toBe(
      'signed in as [redacted-email]',
    );
  });
});
