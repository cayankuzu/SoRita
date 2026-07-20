# SoRita Architecture

## Context

SoRita is an Expo/React Native social map app backed by Supabase Auth, Postgres, Storage, Realtime, and Edge Functions. The mobile client owns presentation and optimistic UX; Supabase owns authorization, visibility, persistence, and public/private data boundaries.

## Dependency Direction

Dependencies flow inward and downward:

1. `src/mobile/app/features/*` owns feature UI and application state.
2. `src/mobile/app/data/*` owns repositories, DTO mapping, query keys, and cache helpers.
3. `src/mobile/app/platform/*` owns native/platform adapters: Supabase, storage, media, security, feedback.
4. `src/mobile/app/shared/*` owns UI primitives, validation, theme, hooks, and generic utilities.
5. `src/mobile/app/contracts/*` owns cross-layer DTOs and small public contracts.
6. `src/shared/*` owns code shared by mobile and Edge Functions.

Feature internals must not be imported by platform/shared layers. The architecture guard enforces the most fragile boundaries.

## Backend Boundaries

- Authenticated user identity is always derived server-side from `auth.uid()`.
- Client-supplied `currentUserId` parameters are not trusted for authorization.
- Public DTOs never expose email, tokens, signed URLs, internal moderation state, or private storage paths.
- Edge Functions validate input, apply auth/rate-limit controls, call domain logic, and return typed responses.
- Forward-only migrations are the only database change mechanism.

## Mobile State

- React Query is the server-state cache.
- Mutations update narrow entities or collections; global invalidation is avoided when a smaller patch is possible.
- Durable cache must be viewer-namespaced, versioned, TTL-bound, and must not persist signed URLs.
- Eligible retry-safe mutations use a viewer-scoped, versioned durable outbox with idempotency
  keys, dependency ordering, exponential backoff, and foreground/network replay.

## Perceived Performance

- Startup warms only the visible route. A press intent promotes its destination immediately; one
  confidently predicted route may warm during idle time. Opening every tab at launch is forbidden.
- Durable startup snapshots are viewer-scoped, capped by count and bytes, filtered by domain TTL,
  and limited to first-screen read models. Search results and signed media URLs stay in memory.
- Screens render cached content first and revalidate in the background. Ready, empty, degraded,
  and error are explicit terminal states measured from navigation intent to the next paint.
- The map starts from a compact marker snapshot; full editable list data and location permission
  work begin only after the first paint or direct user intent.
- Media preparation follows visibility and intent, with bounded image/video work and a smaller
  video-cache budget on low-memory devices.
- Local video and its thumbnail begin uploading after selection when an owner/list is known. Saving
  claims the same in-flight result instead of restarting it; abandoned completed uploads expire and
  enter durable cleanup. This is intent-driven preparation, not launch-time bulk upload.
- Social mutations patch the smallest cache slice before waiting for cancellation, and independent
  controls use instance-local mutation queues so an unrelated like, comment, follow, or list action
  cannot block the next interaction.

## Media

Current release-hardening state:

- Place media is bounded to 60-second, dimension, count, MIME, and byte limits on both client and server.
- Private uploads follow create URL -> PUT -> finalize; finalization verifies ownership, object metadata,
  magic bytes, declared/actual size, image dimensions, and video duration/dimensions.
- Private reads are batch-authorized and delivered through short-lived, expiry-aware signed URLs that
  are deduplicated in flight and never persisted in durable snapshots.
- Failed finalized-object cleanup is retried through the durable outbox.
- Place media uses adaptive bounded concurrency: up to three media items online, one on a constrained
  connection, while each video's main object and thumbnail upload together. One auth session is reused
  across signing and finalization requests.
- Successful writes do not wait for replaced/removed object deletion. Cleanup is scheduled after the
  commit and remains durable; rollback/orphan cleanup still completes before surfacing a failed write.

## Release Safety

- Android and iOS package identifiers stay stable.
- Signing keys and credentials stay external to normal code changes.
- Android release signing fingerprint is checked by Gradle.
- Release candidates must pass `npm run check:release` and the checklist in
  `docs/release-rollback-checklist.md`.

## Known Architecture Debt

- `usePlaceEditorState.ts` and `useMapScreenState.ts` remain large orchestration hooks. Pure policy,
  preview, search, upload, repository, and screen boundaries have been extracted and golden-tested;
  further splitting should remain incremental.
- Full byte-range upload resume after process termination depends on storage-provider protocol support;
  background transfer, early video upload, abort, retry cleanup, and foreground recovery are present,
  but device evidence is required.
- Global coverage is gated at 90% for statements, branches, functions, and lines.
