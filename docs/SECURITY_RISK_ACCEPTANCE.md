# Temporary production advisory risk acceptances

Last reviewed: 2026-09-03

Every acceptance below is enforced by `npm run security:audit:prod`, which fails
the release when an acceptance lacks an owner, reason, exploitability assessment
or expiry, when an expiry has passed, or when a compensating control no longer
holds. An advisory cannot be silenced by adding a bare URL.

## Resolved on 2026-09-03, no longer accepted

These were fixed rather than accepted, and their acceptances were removed.

| Advisory | Dependency | Severity | Resolution |
|---|---|---|---|
| `GHSA-c83g-rgw3-j3cx` | `browserslist` | high | Pinned to 4.28.8 via override |
| `GHSA-73wf-gq98-2v4g` | `browserslist` | high | Pinned to 4.28.8 via override |
| `GHSA-6gmq-8vp8-gcm6` | `@xmldom/xmldom` | moderate | Override raised from 0.8.13 to 0.9.12 |
| `GHSA-w3rx-r6r6-pgpr` | `image-size` | high | No longer present in the production tree |
| `GHSA-5p2g-fcmc-qvqq` | `image-size` | high | No longer present in the production tree |

The two `image-size` acceptances were removed because the dependency is gone. An
acceptance must never outlive the vulnerability it covers, otherwise it silently
pre-approves a future reintroduction.

Current audit state: **0 critical, 0 high, 4 moderate**, with one acceptance.

## Active acceptance

### `GHSA-vcc3-ghjq-m6fr` — `decode-uri-component`

| Field | Value |
|---|---|
| Severity | moderate |
| Owner | mobile-platform |
| Mandatory re-review | 2026-12-01 |
| Dependency path | `@react-navigation/native` → `@react-navigation/core` → `query-string@7` → `decode-uri-component` |

**Why it is not simply fixed.** The only release outside the vulnerable range is
`decode-uri-component@0.5.0`, which is ESM-only. Its consumer, `query-string@7`,
is CommonJS and loads it with `require()`. Forcing 0.5.0 through an override
breaks deep-link parsing at runtime rather than fixing anything. The supported
fix is a React Navigation major upgrade, which changes native dependencies,
requires a new binary, and is out of scope for a hardening pass that must not
alter the product surface.

**Exploitability.** Denial of service only, and only locally. An attacker must
get the user to open a crafted `sorita://` deep link. The worst outcome is CPU
exhaustion inside the user's own app process, recovered by relaunching. There is
no data disclosure, no privilege escalation, and no cross-user or server impact.
The linking configuration exposes four routes behind a single custom scheme, and
only one of those carries a path parameter.

**Compensating control, enforced by the guard.** `decode-uri-component` must
remain transitive and reachable only through `query-string`. If it becomes a
direct dependency, or acquires any other dependent, the exploitability
assessment above no longer holds and the guard fails so the acceptance is
re-reviewed rather than silently inherited.

**Exit condition.** Remove this acceptance when React Navigation ships a release
whose `query-string` dependency uses a patched `decode-uri-component`, or when
the app takes the React Navigation major upgrade as its own reviewed change with
a new native build.

## Rules that apply to every acceptance

1. Critical and high advisories are never accepted. Only moderate and below.
2. Each entry carries an owner, a reason the fix is not applied, an honest
   exploitability assessment and an expiry date.
3. Expiry is enforced. A passed date fails the release.
4. Each entry has a compensating control that keeps the exploitability
   assessment true, and the guard verifies it.
5. An acceptance is removed as soon as the advisory leaves the tree.
