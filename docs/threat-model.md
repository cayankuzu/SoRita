# Threat Model

## Assets

- User identity, session, profile data, follow/block graph, reports, comments, list/place content, media objects, notification tokens, analytics identifiers, signing credentials, API keys, database data, and operational logs.

## Actors

- Anonymous user, authenticated user, blocked user, private-account follower, malicious client, compromised device, moderator/operator, service-role backend, third-party SDK/provider, and accidental insider.

## Trust Boundaries

- Mobile app to Supabase Auth/PostgREST/Realtime/Storage/Edge Functions.
- Edge Functions to service-role Supabase client.
- Mobile app to Firebase/APNs, Sentry, maps, and share targets.
- CI/CD to Expo/EAS, GitHub Actions, stores, and secret stores.

## Required Controls

- Authenticated RPCs derive current user from `auth.uid()`, not caller parameters.
- Public DTOs exclude email, tokens, private URLs, and internal moderation data.
- Storage writes are mediated by signed upload sessions and server-side validation.
- Signed URLs are short-lived and never persisted in durable client cache.
- Logs, Sentry, and analytics redact PII and tokens.
- Branch protection, CODEOWNERS, secret scanning, dependency audit, and SBOM are required release controls.

## Abuse Cases To Test

- IDOR on private profiles, private lists, media, comments, reports, and block state.
- Replay or path traversal on upload/delete endpoints.
- MIME spoofing, oversized upload, long video, malformed image, and stale signed URL.
- Parallel like/follow/comment mutations causing duplicates or counter drift.
- Block/unblock visibility inconsistencies across feed, profile, comments, notifications, and deep links.
- Offline/retry replay duplicating user actions.

## External Evidence Required

- The private media upload/finalize/batch-delivery path and negative unit tests are implemented.
- The RLS negative matrix is present under `supabase/tests`; execution requires the isolated Supabase
  CI job or an authorized staging stack.
- Full-history secret scanning and any resulting credential rotation require authorized incident response.
- Moderator queue/SLA/appeal workflow requires product and operations implementation.
