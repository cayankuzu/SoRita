# SoRita — Current Screen State Matrix

- Candidate commit: `b8c8dd9bc822d4d66f55befcbde88ecb38704c3c`
- Date: 2026-09-03
- Scope: the frozen product surface only. No screen, tab, route, modal or CTA was
  added, removed or renamed while producing this matrix.

## Corrections since `b8c8dd9b`

The body of this matrix is still the 2026-09-03 reading and has not been
re-verified wholesale. The rows below were re-checked against the current
candidate and were wrong; they are corrected here rather than silently edited
into the table, so the provenance of each claim stays visible.

| Row | Was | Is | Evidence |
|---|---|---|---|
| ExploreScreen / Empty | `-` | `Y` | `ExploreScreen.tsx:308` renders `ExploreResultsPage`, which renders `EmptyState` per tab and distinguishes a fruitless search (`explore.empty.noResult` / `tryDifferentSearch`) from an unpopulated tab (`noList`, `noPlace`, `noPhoto`, `noUser`). Verified 2026-09-04. |

## How this was measured

Each screen file under `src/mobile/app/features/**/ui/screens` was read together
with its feature's `application` layer, because state ownership in this codebase
lives in the hooks, not in the view. A state counts as handled when the screen or
its own state hook renders or exposes it, not merely when the data layer could
produce it.

`Y` means the state is handled on that surface. A dash means the state is either
not reachable on that surface or is handled globally, as described below.

## Globally handled states

Three states are deliberately handled once at the app shell instead of being
duplicated on every screen. This is the correct placement, and duplicating them
per screen would be a regression, not an improvement.

| State | Where it lives | Why global |
|---|---|---|
| Offline and reconnect banner | `OfflineIndicator` mounted through `AppFeedbackStack` in `RootNavigator` | Connectivity is a device fact, not a screen fact. One banner avoids eleven inconsistent ones. |
| Toast and transient feedback | `ToastHost` in the same feedback stack | Priority ordering across concurrent sources is only decidable centrally, via `feedbackPriority`. |
| Session expiry | Auth session lifecycle in the app shell | Expiry must unwind every screen at once, not per screen. |

The feedback stack is mounted once, in `RootNavigator`.

## Per-screen matrix

| Screen | Loading | Refresh | Paginate | Empty | Error/retry | Permission | Destructive confirm |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| AuthScreen | - | - | - | - | Y | - | Y |
| AuthCallbackScreen | Y | - | - | - | Y | - | Y |
| ResetPasswordScreen | Y | - | - | - | Y | - | Y |
| ExploreScreen | Y | Y | Y | Y | Y | - | - |
| HomeScreen | Y | Y | Y | Y | Y | - | - |
| MapScreen | Y | Y | - | - | Y | Y | - |
| LocationPlaceCardsScreen | Y | Y | Y | Y | Y | Y | - |
| ListDetailScreen | Y | Y | Y | Y | Y | - | Y |
| NotificationsScreen | Y | Y | Y | Y | Y | - | - |
| ProfileScreen | Y | Y | Y | Y | Y | - | Y |
| UserProfileScreen | Y | Y | Y | Y | Y | - | Y |
| SettingsScreen | - | Y | - | - | Y | - | Y |
| UiCatalogScreen | Y | Y | - | Y | Y | - | Y |

Notes on the dashes that are intentional:

- **Pagination** is absent on Map, Settings, the three auth screens and the
  catalog because none of them render an unbounded list. Map loads a bounded
  viewport, and Settings renders a fixed set of rows.
- **Empty state** on Explore is rendered by the discovery grid component rather
  than the screen, so the screen file itself does not reference it.
- **Permission** applies only to the two surfaces that request location.
- **Loading** on AuthScreen and SettingsScreen is expressed as per-control busy
  state rather than a screen-level spinner, because neither blocks on a fetch
  before first paint.

## Mutation and concurrency states

These are enforced in the data layer and apply to every mutation on the frozen
surface, so they are not repeated per screen.

| State | Mechanism |
|---|---|
| Mutation pending | Per-control busy flag; the control is disabled while in flight |
| Double submit | Disabled and busy state on the control, plus idempotency keys server-side |
| Optimistic success | Optimistic cache writes in `optimisticSocialCache` |
| Optimistic rollback | Snapshot and restore on failure in the same module |
| Queued while offline | `shouldQueueOfflineOperation` decides which operations enter the outbox |
| Replay after reconnect | Outbox drain with attempt limits and dead-lettering |

The outbox has no user-facing screen, by design. Its terminal states are visible
through existing error and retry affordances and through telemetry, not through a
new dead-letter surface.

## Error presentation contract

No screen renders a raw HTTP status, a Supabase error string or a stack trace.
All failures pass through `platform/feedback/errorMessage.ts`, which maps a typed
error class to a Turkish message key in `shared/i18n/tr.ts`. The `ui-copy` guard
fails the build on raw JSX copy, so this cannot regress silently.

Error classes are distinguished rather than collapsed: network, offline, timeout,
authentication, validation, conflict, rate limit and unexpected each map to their
own message, so a user can tell a retryable problem from a permanent one.

## Verification

| Check | Command | Result |
|---|---|---|
| No raw copy in JSX | `npm run ui-copy:check` | pass |
| No raw colors, no text below 12px | `npm run ui-tokens:check` | pass |
| Pressables carry role and label | `npm run accessibility:check` | pass |
| Surface unchanged | `npm run feature-surface:check` | pass |
| Full unit and component suite | `npm run test` | 932 tests across 167 files pass |
