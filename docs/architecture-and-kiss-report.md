# SoRita — Architecture and KISS Report

- Candidate commit: `b8c8dd9bc822d4d66f55befcbde88ecb38704c3c`
- Date: 2026-09-03

## Summary

The layering is already correct and enforced by a build gate, not by convention.
This pass added no new layer, container, adapter or abstraction. The two changes
made were to close holes in existing guards, not to restructure code.

The KISS test applied throughout was: does this change fix a real defect, or does
it only make the report look thorough? Work that failed that test was not done,
and the omissions are listed at the end.

## Layer shape as it exists

| Layer | Files | Responsibility |
|---|---:|---|
| `features` | 165 | Screens, feature components, and the hooks that own screen state |
| `shared` | 74 | Generic UI, tokens, i18n, validation, layout maths |
| `platform` | 61 | Supabase, network, media, notifications, feedback adapters |
| `data` | 55 | Repositories, contracts, query cache, outbox |
| `app-shell` | 39 | Navigation, providers, session lifecycle, feedback stack |

Eleven features each expose a `public/` contract directory. Cross-feature imports
must go through those contracts.

## Enforced boundaries

`npm run architecture:check` fails the build on 19 distinct rules. It runs inside
`npm run lint`, so every pull request is gated. The rules that matter most:

**Dependency direction**

- A feature may import another feature only through its `public/` contract.
- `shared` must not import the data layer. It stays generic and dependency-free.
- Nothing may import feature internals across a feature boundary.
- Infrastructure code must not import data, features or app-shell layers.
- Wildcard re-exports are rejected, so the import graph stays explicit.

**Data access**

- UI must not import repositories or Supabase directly. It goes through data
  hooks, selectors and contracts.
- `supabaseStorage` must not be imported outside its adapter. Server state flows
  through stateless repositories plus React Query.

**Type safety at the navigation seam**

- `useNavigation<any>`, `useRoute<any>` and any-typed navigation props are all
  rejected, so route parameters stay checked.

**Security invariants expressed as architecture**

- Supabase auth token persistence in client storage is rejected.
- `AsyncStorage` must not hold auth tokens. Tokens belong in the secure store.
- Wildcard CORS is rejected.

Putting these three in the architecture gate rather than in a review checklist is
the right call, because they are structural properties that a reviewer would have
to re-derive on every pull request.

## Circular dependencies

`npm run source-health:check` builds the import graph across 404 application
files and fails on any cycle. Current result: no cycles.

## File and function budgets

The same gate enforces size budgets. The default is 700 lines per file and 300
lines per function, with named exemptions for known hotspots so existing debt is
recorded explicitly rather than hidden by a raised global limit.

This pass extended the gate to the backend, which was previously unguarded:

| Root | Files | Default budget |
|---|---:|---|
| `src/mobile/app` | 404 | 700 lines per file, 300 per function |
| `supabase/functions` and Worker `src` | 21 | 600 lines per file |

Four backend files carry explicit exemptions:

| File | Lines | Budget |
|---|---:|---:|
| `supabase/functions/media-assets/handler.ts` | 2,095 | 2,100 |
| `infra/cloudflare/sorita-edge/src/index.ts` | 1,072 | 1,080 |
| `supabase/functions/auth-gateway/handler.ts` | 928 | 930 |
| `supabase/functions/moderation-reports/handler.ts` | 762 | 770 |

The exemptions are ratchets, not permissions. The gate fails if an exemption
becomes stale, and it also fails if a budget sits more than 100 lines above the
file's actual size. Recorded debt can therefore only shrink.

**These four files were not split during this pass.** Splitting a 2,095-line
security-critical upload handler is a large, risky refactor whose only driver
would be a line count. The budget records the debt and prevents growth, which is
the proportionate response. Splitting it should be its own change with its own
review, not a side effect of a hardening pass.

## Dead code

`npm run dead-code:check` reports no unused files, unused dependencies, unlisted
dependencies or unlisted binaries.

## Test seams

Time, network, storage and provider access are already injected rather than
reached for globally:

- Network state through `netInfoAdapter` and `useNetworkStatus`.
- Supabase through repositories, never directly from UI.
- Notifications through the platform notification adapters.
- Maps through a mock server in the Docker `maps-mock` profile, so geocoding
  contract tests never call a paid provider.

This is why 932 tests run without network access.

## KISS decisions taken during this pass

**Done, because each fixed a real defect:**

- Removed a stray diff marker that broke the Docker build context, and taught the
  guard to reject that class of error.
- Made the Docker CI workflow run the database half of its own profile.
- Added placeholder validation for the production CORS allowlist.
- Brought the runtime-evidence fixtures up to the schema they are validated
  against.
- Extended size budgets to backend code.

**Deliberately not done:**

- No second Docker topology. The prompt sketched `docker/` and `scripts/docker/`
  directories; `infra/docker/` already provides the same profiles and the root
  `compose.quality.yml` already aliases it. Creating parallel trees would mean
  two definitions of one stack.
- No dependency injection container. Constructor and factory injection already
  cover the seams that tests need.
- No Redis, queue, or microservice. Nothing measured showed a need, and the push
  outbox already lives in PostgreSQL where its transactional guarantees are.
- No splitting of the four oversized backend files, for the reason given above.
- No new shared component. No pattern repeated three or more times was found that
  is not already factored into `shared/components`.
- No widening of the UI catalogue. That would change a screen's content to
  improve a report rather than to fix a defect.

## Residual architectural risk

| Risk | Impact | Why it is accepted for now |
|---|---|---|
| Four oversized backend handlers | Harder to review; higher chance of a subtle change slipping through | Budgeted and ratcheted; each is covered by contract tests and, for the DB paths, by pgTAP |
| Token values themselves are untested | A single token edit shifts every screen | Centralisation is the intended design; the mitigation is pixel capture, which needs hardware |
| Cross-feature contracts are directory-based | A contract could grow too wide without tripping a gate | Eleven contracts today, all narrow; worth revisiting if a feature's public surface grows |
