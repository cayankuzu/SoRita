# Release And Rollback Checklist

## Before Release Candidate

- [ ] Working tree clean and release SHA recorded.
- [ ] `npm ci` from lockfile succeeds.
- [ ] `npm run expo:check` succeeds (dependency compatibility and Expo Doctor).
- [ ] `npm run lint` succeeds.
- [ ] `npm run typecheck` succeeds.
- [ ] `npm run security:audit:prod` succeeds.
- [ ] `npm run security:verify` succeeds.
- [ ] `npm run test` succeeds.
- [ ] `npm run test:coverage` succeeds.
- [ ] `npm run dead-code:check` and `npm run e2e:evidence` succeed.
- [ ] Supabase migrations pass fresh DB, staging upgrade, drift, and RLS negative tests.
- [ ] Android release bundle builds with production signing guard.
- [ ] iOS EAS build succeeds with existing credentials.
- [ ] Sentry sourcemaps/dSYMs are uploaded or upload is intentionally disabled for the build profile.
- [ ] AASA and assetlinks are published and verified for production domain.
- [ ] Physical iOS/Android device smoke tests pass.
- [ ] Accessibility smoke: 200% font, VoiceOver, TalkBack.
- [ ] Store privacy/data-safety/account-deletion answers match actual SDK behavior.

## Rollout

- [ ] Canary 1%.
- [ ] Hold and inspect SLO/error budget.
- [ ] Increase to 5%, 25%, 50%, 100% only if SLOs remain green.
- [ ] Monitor crash-free, ANR, feed p95, mutation p95, upload success, auth errors, and storage egress.

## Rollback

- Binary rollback: halt rollout or promote previous store build.
- Backend rollback: use forward-fix migration, not destructive migration rollback.
- Feature rollback: disable flag or route to previous compatible endpoint.
- Media rollback: keep old URL/path compatibility until migration is fully verified.

## Manual Approvals

- Production Supabase migration.
- Play/App Store submission.
- Credential/key rotation.
- Branch protection and required status checks.
