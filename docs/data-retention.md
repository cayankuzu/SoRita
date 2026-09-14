# Data Retention And Deletion

## Principles

- Store only data needed for product, safety, legal, or operational purposes.
- Do not persist tokens, signed URLs, or private credentials in analytics/logs/client snapshots.
- User deletion must remove or anonymize user-owned content according to product/legal policy.

## Current Data Classes

| Data | Retention direction |
|---|---|
| Auth/session tokens | Provider managed; not logged |
| Profile data | Until account deletion |
| Lists/places/comments/media | Until user deletion, moderation action, or explicit deletion |
| Reports/moderation evidence | Retained for safety/legal policy window |
| Notification tokens | Removed on logout/account deletion/token invalidation |
| Cached visible data | Viewer-scoped TTL cache, currently 6 hours |
| Signed media URLs | Must not be durably persisted |
| Logs/Sentry | Redacted; retention configured in provider |
| Opt-in PostHog product analytics | Anonymous installation identifier plus allowlisted low-cardinality events only; disabled by default; retention configured and approved in provider |

The local PostHog preference is cleared on a logged-out boot, logout, or direct
account switch so one account cannot grant analytics for another account on a
shared device. Remote allow decisions expire after five minutes and fail closed
until a fresh response is received; successful-event sampling never suppresses
Worker error logs at the Cloudflare platform layer.

## Required Deletion Evidence

- Account deletion mobile flow.
- Backend delete-user function test.
- Storage object cleanup.
- Auth user deletion.
- PostHog/Sentry provider retention, deletion, anonymization and data-region policy.
- Backup/PITR limitation documented in privacy policy.

## External Evidence Required

- Formal retention windows require product/legal approval.
- Restore drill and backup deletion limitation evidence are external/manual.
- Private-media deletion and orphan cleanup paths are implemented and tested; staging Storage lifecycle
  and provider-retention verification remain manual.
