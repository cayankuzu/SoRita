# SoRita Final Release Evidence

Date: 2026-07-16
Branch: `agent/release-1.0.79-ux-supabase`
Base commit: `63dee86`
Supabase project: `csidemtcbvtcmmjextey`

## Scope Completed

- Hardened `public.upsert_list_place_with_media(jsonb, jsonb)` in a forward-only migration.
- Added owner/list/place scoped validation for private place media storage URIs.
- Prevented cross-list place mutation through the atomic RPC.
- Forced `created_by` to `auth.uid()` server-side instead of trusting client payloads.
- Added media payload validation for max item count, max video count, duplicate ids, duplicate URLs, media type, MIME type, dimensions, duration, and storage path scope.
- Added DB-backed private media metadata fields on `public.list_place_photos`.
- Added service-role-only `public.can_read_private_place_media(text, text, uuid)` authorization RPC.
- Updated `media-assets` to authorize private read URLs through DB state before creating signed Storage URLs.
- Updated `delete-user` cleanup to remove `place-media-private` objects as part of account deletion.
- Updated tests for DB-backed media reads and private bucket account cleanup.
- Hardened connectivity status so failed Supabase probes no longer create false `internet baglantisi yok` banners while media and maps are loading.
- Added a native-manager guard and JS fallback for profile pagers when `RNCViewPager` is not registered in the Android release binary.

## Supabase Deployment

- Deployed Edge Function `admin-broadcast-notification`.
- Deployed Edge Function `auth-gateway`.
- Deployed Edge Function `delete-user`.
- Deployed Edge Function `maps-geocoding`.
- Deployed Edge Function `media-assets`.
- Deployed Edge Function `moderation-reports`.
- Applied remote migration `20260715203000_harden_atomic_place_media_and_private_reads.sql`.
- Verified remote migration list includes `20260715203000`.
- Re-ran `npx supabase db push --linked --yes`; remote database is up to date.

Note: a previous execution pass hit a Windows file access error during `supabase db push --linked`; this pass reran the command directly from the workspace and confirmed the remote database is up to date.

## Validation

- `npm ci`: passed.
- `npm run lint`: passed with 76 warnings.
- `npm run typecheck`: passed.
- `npm test`: passed scripted suites.
- `npm run security:verify`: passed, 6 files / 42 tests.
- `npx vitest run src/mobile/app/platform/network/__tests__/connectivityStatus.test.ts src/mobile/app/platform/network/__tests__/netInfoAdapter.test.ts src/mobile/app/shared/components/navigation/__tests__/pagerViewAdapter.test.ts`: passed, 3 files / 16 tests.
- `npx expo install --check`: passed.
- `npm run security:audit:prod`: passed at audit-level high; still reports low/moderate items below.
- `npx supabase db push --linked --dry-run --yes`: showed `20260715203000_harden_atomic_place_media_and_private_reads.sql` before deployment and `Remote database is up to date` after deployment.
- `git diff --check`: passed; only CRLF conversion warnings on Windows.

## Coverage

`npm run test:coverage` executed 85 files / 406 tests successfully, but failed the release threshold:

- Statements: 82.03%
- Branches: 69.6%
- Functions: 86.09%
- Lines: 82.22%
- Failed threshold: branches must be at least 80%.

## Audit

`npm audit --omit=dev --json` summary:

- Critical: 0
- High: 0
- Moderate: 12
- Low: 1
- Total: 13

## Release Decision

Status: NO-GO for store release.

Open blockers:

- Branch coverage remains below the 80% global threshold.
- Lint still has 76 warnings.
- Production audit still reports 13 low/moderate vulnerabilities.
- Manual E2E, local DB auth tests, device matrix, load test, backup/restore drill, and store review checklist are not evidenced here.

Latest native artifact from the explicit build request:

- `C:\Users\Cayan\Desktop\SoRita-1.0.84-89-release-A704-signed.aab`
- Size: `73635504` bytes.
- SHA256: `0205843946FA2BBB1AC89A0904FA14DA66589664F47CCEBCE5C04DC20530DB07`
- Signing SHA1: `A7:04:1D:7D:DF:1B:C0:25:FA:FB:72:11:C9:4B:7B:2C:86:15:B1:E0`

Built with `SENTRY_DISABLE_AUTO_UPLOAD=true` and `.\gradlew.bat clean bundleRelease`.
