import { describe, expect, it } from 'vitest';

import { resolvePasswordResetLinkAction } from '@/mobile/app/features/auth/application/passwordResetLinkState';

describe('resolvePasswordResetLinkAction', () => {
  it('prepares a link the first time its token is seen', () => {
    expect(
      resolvePasswordResetLinkAction({
        linkingResolved: true,
        preparedState: null,
        state: 'abc',
      }),
    ).toBe('prepare');
  });

  // The reported defect: a link clicked seconds after it arrived reported
  // itself as already used. The token is single use, and the effect re-ran
  // when Linking delivered the URL, so the screen spent its own token and
  // then failed to find it.
  it('never spends the same token twice', () => {
    expect(
      resolvePasswordResetLinkAction({
        linkingResolved: true,
        preparedState: 'abc',
        state: 'abc',
      }),
    ).toBe('wait');
  });

  it('prepares again when a genuinely different link arrives', () => {
    expect(
      resolvePasswordResetLinkAction({
        linkingResolved: true,
        preparedState: 'abc',
        state: 'def',
      }),
    ).toBe('prepare');
  });

  // The other half: on a cold start the URL is not there on the first render,
  // and failing then showed the error before the link had arrived.
  it('waits while Linking has not resolved yet', () => {
    expect(
      resolvePasswordResetLinkAction({
        linkingResolved: false,
        preparedState: null,
        state: undefined,
      }),
    ).toBe('wait');
  });

  it('fails once Linking has resolved and still carries no token', () => {
    expect(
      resolvePasswordResetLinkAction({
        linkingResolved: true,
        preparedState: null,
        state: undefined,
      }),
    ).toBe('fail');
  });

  it('treats an empty token as no token', () => {
    expect(
      resolvePasswordResetLinkAction({
        linkingResolved: true,
        preparedState: null,
        state: '',
      }),
    ).toBe('fail');
    expect(
      resolvePasswordResetLinkAction({
        linkingResolved: false,
        preparedState: null,
        state: '',
      }),
    ).toBe('wait');
  });

  it('still waits for a repeat token even before Linking resolves', () => {
    expect(
      resolvePasswordResetLinkAction({
        linkingResolved: false,
        preparedState: 'abc',
        state: 'abc',
      }),
    ).toBe('wait');
  });
});
