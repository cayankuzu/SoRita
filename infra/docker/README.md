# SoRita deterministic verification containers

This directory is a test and CI boundary, not a production runtime. The React
Native application, Android emulator, iOS simulator, EAS Build, store signing,
hosted Supabase and the production Cloudflare Worker remain outside Compose.

## Profiles

| Profile | Purpose | External or production traffic |
| --- | --- | --- |
| `test` | Build the non-root tooling image, exercise the bounded synthetic Maps, Supabase read, media finalize, offline outbox, push-origin and representative read-flow contracts, then run the isolated Worker gate | None |
| `maps-mock` | Run the legacy-named deterministic verification mock with success/invalid/429/5xx/timeout fixtures and a 16 KiB request limit | None |
| `resilience` | Route Maps, Supabase read, media finalize, offline outbox and push origins through five isolated Toxiproxy listeners; apply latency, timeout, TCP reset and bandwidth faults to every origin | None |
| `load` | Run a bounded 5-VU/10-second k6 smoke over discovery, lists, social, auth-gateway and edge fixtures | None |

Supabase CLI remains the canonical local backend. `npm run docker:test` copies
the tracked `supabase/` tree into an isolated temporary work directory, assigns
a unique local project ID, then runs migration replay, DB lint, pgTAP RLS/IDOR
tests and a dump/restore drill. It does not reset a running developer stack.
Supabase's built-in local mail catcher remains the auth-email fixture, so a
second Mailpit service is intentionally not added. No malware-scanner adapter
exists in the product, so a decorative ClamAV service is also intentionally
absent.

## Commands

```text
npm run docker:config
npm run docker:build
npm run docker:up:test
npm run docker:test
npm run docker:resilience
npm run docker:load
npm run docker:down
npm run docker:clean -- --confirm=DELETE_TEST_VOLUMES
```

`docker:down` never deletes volumes. `docker:clean` is deliberately fail-closed
unless the exact confirmation token is supplied, and it validates the Compose
project labels before removal. The current Compose graph has no persistent
volume.

The mock payloads are test-only, fixed and deliberately small; they do not add
application routes or emulate provider credentials. The full staging read-model
load test remains `npm run load:test`. It requires explicit staging credentials
and is not routed through these mocks. The Docker load profile accepts only the
internal `http://maps-mock:8789` target and cannot reach a hosted or production
URL.

## Security contract

- Base and third-party images use immutable multi-platform digests; Dependabot
  owns controlled Docker reference updates.
- Every runtime is non-root/read-only, drops all Linux capabilities, sets
  `no-new-privileges`, uses bounded CPU/memory/PIDs and joins an internal-only
  network.
- No Docker socket, host network, privileged mode, production data or provider
  credential is mounted.
- Root `.dockerignore`, the required directory-local `.dockerignore`, and the
  Dockerfile-specific ignore file share the same secret exclusions. The context
  guard fails if they drift.
- The Dockerfile copies explicit paths only. Native projects and signing inputs
  do not enter the tooling image.
- Test logs contain only synthetic fixtures; mock requests are not logged.

Pinned sources resolved on 2026-08-31:

- `node:24.18.0-bookworm-slim` — Node.js LTS tooling base.
- `ghcr.io/shopify/toxiproxy:2.12.0` — deterministic network faults.
- `grafana/k6:2.2.0` — bounded local load smoke.

The CI workflow additionally runs Hadolint and fails on fixable or unfixable
HIGH/CRITICAL Trivy findings. Buildx emits a max-mode SLSA provenance statement
and an SPDX SBOM as OCI attestations; the workflow checksum-verifies and extracts
both statements before discarding the large temporary OCI archive. A second
independent Docker-export build must match the first build's image config digest
(which binds its rootfs diff IDs) under the commit-derived `SOURCE_DATE_EPOCH`.
The loaded image ID must match that digest, and Anchore produces an independent
SPDX JSON scan of the same loaded image. All compact evidence is then
checksum-bound to `github.sha`.

## Failure and cleanup

Profile runners propagate the failing container's exit code and always execute
`docker compose down --remove-orphans`. The Supabase wrapper performs its own
`finally` cleanup and removes only a validated `sorita-docker-supabase-*`
temporary directory. If a runner is interrupted, use `npm run docker:down` and
then re-run `npm run docker:config` before retrying.
