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
- Offline/outbox and resumable upload are planned extensions and must use idempotent server endpoints.

## Media

Current release-hardening state:

- Place media is bounded to 60 second / 720p-oriented uploads.
- Rate-limit responses do not fall back to direct Storage writes.
- Private bucket foundation exists, but full asset schema and signed delivery resolver are still pending.

Target state:

- `media_assets` stores physical assets.
- `list_place_media` stores relationships and ordering.
- Clients persist asset IDs/descriptors, not signed URLs.
- Delivery URLs are short-lived and authorized per viewer.

## Release Safety

- Android and iOS package identifiers stay stable.
- Signing keys and credentials stay external to normal code changes.
- Android release signing fingerprint is checked by Gradle.
- Release candidates must pass the checklist in `docs/release-rollback-checklist.md`.

## Known Architecture Debt

- `usePlaceEditorState.ts` and `useMapScreenState.ts` remain large orchestration hooks and should be split behind golden tests.
- Full feed read-model RPC is not implemented yet.
- Full private media asset lifecycle and resumable upload state machine are not implemented yet.
- Coverage is below the configured 80% global gate.
