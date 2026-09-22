/**
 * What the reset screen should do with the link it currently holds.
 *
 * Two things made a freshly clicked link report itself as already used:
 *
 * - `Linking.useURL()` returns null until it resolves, so the first render of
 *   a cold start from an email link has no state yet. Treating that as a bad
 *   link showed the failure before the link had arrived.
 * - The state token is single use; consuming it deletes it. The preparation
 *   effect re-runs when the payload identity changes - which it does the
 *   moment Linking delivers the URL - and the second run found its own token
 *   gone and called the link spent.
 */
export type PasswordResetLinkAction = 'prepare' | 'wait' | 'fail';

export function resolvePasswordResetLinkAction(params: {
  /** The state token carried by the link, when there is one. */
  state?: string;
  /** The token this screen has already spent, if any. */
  preparedState: string | null;
  /** Whether `Linking.useURL()` has produced a result yet, null included. */
  linkingResolved: boolean;
}): PasswordResetLinkAction {
  const { linkingResolved, preparedState, state } = params;

  if (!state) {
    return linkingResolved ? 'fail' : 'wait';
  }

  return preparedState === state ? 'wait' : 'prepare';
}
