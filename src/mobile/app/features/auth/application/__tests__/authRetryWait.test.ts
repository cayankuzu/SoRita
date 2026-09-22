import { describe, expect, it } from 'vitest';

import {
  formatAuthRetryWait,
  getSafeAuthFailureMessage,
} from '@/mobile/app/features/auth/application/authScreenStateHelpers';
import { tr } from '@/mobile/app/shared/i18n/tr';

describe('formatAuthRetryWait', () => {
  it('keeps a short wait in seconds', () => {
    expect(formatAuthRetryWait(30_000)).toBe(tr.auth.toast.retryWaitSeconds(30));
  });

  // Rounding down would send someone back to a screen that is still locked.
  it('rounds a part-second up rather than down', () => {
    expect(formatAuthRetryWait(30_400)).toBe(tr.auth.toast.retryWaitSeconds(31));
  });

  it('switches to minutes once a minute is reached', () => {
    expect(formatAuthRetryWait(60_000)).toBe(tr.auth.toast.retryWaitMinutes(1));
    expect(formatAuthRetryWait(300_000)).toBe(tr.auth.toast.retryWaitMinutes(5));
  });

  it('rounds a part-minute up too', () => {
    expect(formatAuthRetryWait(61_000)).toBe(tr.auth.toast.retryWaitMinutes(2));
  });
});

describe('getSafeAuthFailureMessage', () => {
  // The defect this closes: the gateway sends Retry-After, the transport
  // parses it, and the message threw it away to say "after a while".
  it('tells a locked-out user how long the lock lasts', () => {
    const message = getSafeAuthFailureMessage('account_locked', 'yedek', 300_000);

    expect(message).toBe(
      tr.auth.toast.accountLockedFor(tr.auth.toast.retryWaitMinutes(5)),
    );
    expect(message).not.toBe(tr.auth.toast.accountLocked);
  });

  it('falls back to the vague wording only when the server gave no window', () => {
    expect(getSafeAuthFailureMessage('account_locked', 'yedek')).toBe(
      tr.auth.toast.accountLocked,
    );
    expect(getSafeAuthFailureMessage('account_locked', 'yedek', 0)).toBe(
      tr.auth.toast.accountLocked,
    );
  });

  it('still maps rate limiting to its own message', () => {
    expect(getSafeAuthFailureMessage('rate_limited', 'yedek')).toBe(
      tr.auth.toast.rateLimited,
    );
  });

  it('passes an unrecognised code through to the caller fallback', () => {
    expect(getSafeAuthFailureMessage('invalid_credentials', 'yedek')).toBe('yedek');
    expect(getSafeAuthFailureMessage(undefined, 'yedek')).toBe('yedek');
  });

  it('ignores a retry window on a code that is not a lockout', () => {
    expect(getSafeAuthFailureMessage('invalid_credentials', 'yedek', 300_000)).toBe('yedek');
  });
});

describe('forgot-password copy', () => {
  // The defect this closes: the signed-out reset flow used
  // tr.settings.password.resetHint as its failure message. That string belongs
  // to Settings, where a signed-in user changes a password they still know, so
  // a failed send told someone who had forgotten their password to type it in.
  it('never asks a signed-out user for the password they have forgotten', () => {
    for (const message of Object.values(tr.auth.forgotPassword)) {
      if (typeof message !== 'string') continue;
      expect(message.toLocaleLowerCase('tr')).not.toContain('mevcut şifre');
    }
  });

  it('owns the messages the reset flow shows, rather than borrowing Settings copy', () => {
    expect(tr.auth.forgotPassword.sendFailed).toBeTruthy();
    expect(tr.auth.forgotPassword.sent).toBeTruthy();
    expect(tr.auth.forgotPassword.sendFailed).not.toBe(tr.settings.password.resetHint);
    expect(tr.auth.forgotPassword.sent).not.toBe(tr.settings.password.resetSent);
  });

  it('keeps the Settings hint asking for the current password, because there it is right', () => {
    expect(tr.settings.password.resetHint.toLocaleLowerCase('tr')).toContain('mevcut şifre');
  });
});
