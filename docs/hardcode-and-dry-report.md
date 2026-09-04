# SoRita — Hardcode, Config and DRY Report

- Candidate commit: `b8c8dd9bc822d4d66f55befcbde88ecb38704c3c`
- Date: 2026-09-03

## Summary

Configuration is already schema-validated and the secret boundary already holds.
This pass changed nothing in the mobile config layer, because nothing there was
broken. The one configuration defect found was on the deployment side: the
production Worker CORS allowlist accepted placeholder origins. That is fixed.

The guiding rule applied was the one the brief states: centralise semantic,
repeated or operational values, and leave incidental numbers alone. Turning every
spacing literal into a named constant makes code harder to read, not easier.

## Runtime configuration

Public runtime configuration is parsed through a Zod schema in
`platform/config/publicRuntimeConfig.ts`, with typed defaults and a cross-field
refinement:

| Key | Type | Default | Rule |
|---|---|---|---|
| `edgeApiUrl` | HTTPS base URL | empty | must be HTTPS when present |
| `edgeCutoverMode` | `direct` or `gateway` | `direct` | enum, normalised before parse |
| `releaseEnvironment` | enum | `development` | enum, normalised before parse |

The refinement is the part that matters: selecting `gateway` without an
`edgeApiUrl` is a parse error, not a runtime surprise. The app cannot boot into a
state where it believes it is routing through the edge but has no edge URL. That
is fail-closed configuration, and it is why the direct-to-gateway cutover can be
flipped by configuration without a new binary.

Parse failures are reported by environment variable name through
`getPublicRuntimeConfigIssueEnvNames`, so a misconfiguration names the variable
to fix rather than surfacing a schema path.

## Secret boundary

The boundary holds in the direction that matters. A search of the mobile source
for service-role material returns nothing.

| Class | Where it may live | Verified |
|---|---|---|
| `EXPO_PUBLIC_*` values | client bundle; these are not secrets | 20 variables, all non-secret by construction |
| Supabase service role | server only, never in the app | absent from `src/**` |
| Cloudflare origin HMAC secret | Cloudflare secret store and Supabase project secrets | never referenced as `EXPO_PUBLIC` |
| APNs and FCM admin credentials | provider and EAS secret stores | not in the repository |
| Sentry auth token | CI secret | not in the repository |
| Store signing material | EAS and provider key stores | `eas.json` carries no credential path |

The public Maps keys are platform-restricted client keys. The server-side
geocoding key is a separate value that lives in the Worker and Supabase secret
stores, which is why geocoding is proxied rather than called from the app.

Three independent gates keep this true: the architecture guard rejects auth
tokens in `AsyncStorage` and Supabase token persistence in client storage; the
Docker context guard denies the repository by default and re-includes only named
paths, with an explicit deny list for credential file patterns; and the secret
scan runs over the current tree and full history.

## Operational values that are centralised

| Concern | Location |
|---|---|
| Design tokens: colour, spacing, radius, typography, elevation, motion, touch, icon size, opacity | `shared/theme/tokens.ts`, 14 groups in one file |
| Turkish copy | `shared/i18n/tr.ts` |
| Query staleness and page size | `data/constants.ts` |
| Connectivity thresholds and debounce | `platform/network/connectivityStatus.ts`, `useNetworkStatus.ts` |
| Edge function names | environment variables, one per function |
| Layout breakpoints | `shared/utils/layout.ts` |
| Worker timeouts, log sample rate, CORS allowlist | Worker vars set per environment at deploy time |

Edge function names being environment variables rather than string literals is
what allows the same binary to point at a renamed function without a rebuild.

## Values deliberately left inline

Spacing multipliers, flex weights, animation offsets and one-off dimensions that
appear once are left where they are. Hoisting them would add indirection without
removing duplication. The token gate already prevents the two cases that actually
cause drift: a raw colour, and text below 12 px.

## DRY: what is shared, and what is deliberately not

Shared and correct:

| Pattern | Shared implementation |
|---|---|
| Error to message mapping | `platform/feedback/errorMessage.ts`, one mapping for all typed error classes |
| Empty, notice and skeleton states | `EmptyState`, `InlineNotice`, `SkeletonPlaceholder` |
| Buttons and inputs | `PrimaryButton`, `IconButton`, `TextField` |
| Modal and sheet scaffolding | `ModalScaffold`, `ConfirmActionModal`, `ActionMenuSheet` |
| Optimistic write and rollback | `data/query/optimisticSocialCache.ts` |
| Offline queue admission | `data/outbox/shouldQueueOfflineOperation.ts` |
| Layout maths | `shared/utils/layout.ts`, consumed via `useAppLayout` |
| Reduce Motion | `shared/hooks/useReduceMotion.ts` |

Deliberately not merged:

- The eleven feature screens are not collapsed into a generic screen component.
  They share primitives, not structure. Merging them would produce exactly the
  many-prop component the brief warns against.
- The four large backend handlers are not merged behind a common abstraction.
  They serve genuinely different contracts, and a shared base class would couple
  five deploy targets to one file.
- No new abstraction was introduced during this pass. No pattern was found
  repeated three or more times that is not already factored out.

## Encoding and copy integrity

All user-facing text is Turkish and lives in one catalogue. The `ui-copy` gate
fails on raw JSX copy, including accessibility strings, so a label cannot drift
from the catalogue at a call site. No new locale, no language selector and no
English strings were added.

## The one configuration defect fixed

The production Worker workflow validated that the CORS allowlist variable was
non-empty, and separately validated the health and Supabase URLs for placeholder
values, but never inspected the allowlist entries themselves. A production
version could be uploaded with `https://app.sorita.invalid`.

Each entry must now be a bare HTTPS origin, and is rejected when it is a
placeholder or an `.invalid`, `.example`, `.test` or `localhost` host. Verified
against valid, `.invalid`, empty and plain-HTTP inputs, and locked in by three
guard assertions.

The `.invalid` values that remain in `wrangler.jsonc` are the local and
development defaults. They are the correct default, because that top-level domain
can never resolve, so a misconfigured local run fails closed rather than reaching
a real host.

## Verification

| Check | Command | Result |
|---|---|---|
| Config schema and defaults | included in `npm run test` | pass |
| Architecture and secret-boundary rules | `npm run architecture:check` | pass |
| Token compliance | `npm run ui-tokens:check` | pass |
| Copy centralisation | `npm run ui-copy:check` | pass |
| Docker context and credential denial | `node utils/guards/check-docker-context.mjs` | pass |
| Unused files, dependencies and binaries | `npm run dead-code:check` | pass, none found |
