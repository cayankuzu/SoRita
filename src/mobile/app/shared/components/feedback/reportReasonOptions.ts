export type ReportTargetType = 'comment' | 'list' | 'place' | 'profile';

export function getReportReasonsForTarget(
  reasons: readonly string[],
  targetType: ReportTargetType,
) {
  if (targetType === 'place') {
    return [...reasons];
  }

  // The first shared reason is the place-only "wrong location" option.
  // Keeping it out of profile, list and comment reports prevents users from
  // submitting a semantically impossible moderation reason.
  return reasons.slice(1);
}
