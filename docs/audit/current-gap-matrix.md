# SoRita — Current Gap Matrix

- Candidate commit: `b8c8dd9bc822d4d66f55befcbde88ecb38704c3c`
- Working branch: `chore/final-aaa-mvp-hardening-docker-cloudflare-ota`
- Audit date: 2026-09-03
- Scope: re-verification of every inherited audit finding, plus the defects found
  by re-running the gates on this working tree.

This matrix records what was **re-verified on this tree**, not what an earlier
report claimed. Every `CONFIRMED` row is backed by a command executed during this
pass, with its output quoted in [release-readiness.md](../release-readiness.md).

## 0. Gate state at close

Every gate below was executed on this working tree on 2026-09-03, after all
changes. `npm run check:release` and `npm run docker:test` both exit 0.

| Gate | Result |
|---|---|
| `expo-doctor` | 19 of 19 checks pass |
| `typecheck` (app and tests) | pass |
| `lint`, including 7 content and architecture guards | pass |
| `text-encoding` (new) | 769 files, valid UTF-8, no mojibake |
| `feature-surface` and its self-test | pass, counts unchanged |
| `release-scorecard` (new) | 35 categories, all below target, verdict NO-GO |
| `ota:classifier`, `deployment-workflows`, `release-evidence`, `ops` | 44, 15, 8, 18 pass |
| `test` | 932 tests across 167 files |
| `security:verify` | 117 tests across 8 files |
| `test:coverage` | branches 90.08%, statements 94.53%, lines 94.74% |
| `security:audit:prod` | 0 critical, 0 high, 4 moderate, 1 justified acceptance |
| `security:licenses` | 738 locked production packages |
| `dead-code` | no findings |
| `docker:test` | Worker 34, pgTAP 180 across 6 suites, restore parity 22 tables |
| `docker:load:smoke` | 122,370 requests, 0 failures, `no-store` held throughout |

Seven defects were found and fixed during this pass. None was in the inherited
finding list; all were found by running gates rather than reading reports. No
threshold was lowered and no guard was loosened.

## 1. Product surface freeze

| Item | Status | Evidence |
|---|---|---|
| 10 root routes | CONFIRMED | `npm run feature-surface:check` |
| 4 tabs (Explore, Home, Map, Profile) | CONFIRMED | same |
| 13 screen entrypoints | CONFIRMED | same |
| 10 notification types | CONFIRMED | same |
| 6 Edge Function contracts | CONFIRMED | same |
| 18 product tables | CONFIRMED | same |
| 3 storage buckets | CONFIRMED | same |
| 3 Settings groups, 19 Settings CTAs | CONFIRMED | same |
| Guard self-test | CONFIRMED | 12 of 12 assertions pass |

The guard is bidirectional. It rejects additions and removals, so the surface
cannot drift in either direction without an explicit snapshot change.

## 2. Findings carried in from the previous audit

| # | Finding | Status | Evidence on this tree |
|---:|---|---|---|
| 1 | Account-enumeration hardening in the auth gateway | CONFIRMED | `supabase/functions/auth-gateway/handler.test.ts` asserts generic availability, reset and resend responses. `npm run security:verify` passes 117 tests across 8 files. |
| 2 | Android source manifest has OTA enabled | CONFIRMED | `expo.modules.updates.ENABLED=true`, update URL, runtime version and the channel request header are present in the Android manifest. |
| 3 | First OTA-ready AAB and IPA, plus provider rollout evidence | RUNTIME/PROVIDER EVIDENCE REQUIRED | No signed artifact exists in this environment. The receipt schema exists but holds no receipts. |
| 4 | Worker exists but provider deployment unproven | RUNTIME/PROVIDER EVIDENCE REQUIRED | Worker tests pass 34 of 34 inside the container, but no Cloudflare account is reachable from here. |
| 5 | EAS submit depended on a local `.p8` path | FIXED SINCE AUDIT | No credential path remains in `eas.json`. `npm run eas:credentials:check` passes and rejects a tracked key path. |
| 6 | Cloudflare `.invalid` placeholders | CONFIRMED, now mitigated | `.invalid` remains only as the local and development default in `wrangler.jsonc`. Production overrides it from a protected repository variable, and that value is now validated fail-closed. See section 3.3. |
| 7 | Docker quality layer must be repeatable | REGRESSED, now FIXED | The build context was broken on this tree. See section 3.1. It is now repaired and verified end to end. |
| 8 | Baseline docs keep provider gates open | CONFIRMED | Still honestly NO-GO. Unchanged by this pass. |

## 3. Defects found and fixed during this pass

These were not in the inherited finding list. They were found by running the
gates rather than by reading the reports.

### 3.1 Docker build context excluded `App.tsx`

All three ignore files carried a stray diff marker on one line:

```text
+!App.tsx
```

Docker reads that as a literal pattern, so the re-include never applied and the
leading `**` deny kept the file out of the build context. Every image build
failed at the `COPY` of `App.tsx` with `"/App.tsx": not found`. The entire Docker
quality environment was non-functional, and no CI job caught it because the
Docker workflow was not running the profile that builds the image.

**Fix.** The stray marker was removed from all three files, and
`utils/guards/check-docker-context.mjs` gained two fail-closed checks:

1. Any ignore line beginning with `+` or `-` is rejected as a diff artifact.
2. Every build-context `COPY` source in the tooling Dockerfile must be
   re-included by every ignore file, accepting exact entries, directory entries
   and ancestor recursive coverage.

Both were verified by reintroducing the bug, observing the guard fail, then
restoring and observing it pass.

### 3.2 Docker CI workflow never ran the database half of the profile

The Docker workflow ran the profile with the database skipped, so clean Supabase
reset, migration replay, DB lint, pgTAP and dump/restore never executed in the
Docker lane. The deployment-workflow guard already required the full profile and
was failing.

**Fix.** The workflow now runs the full test profile, which executes the
container contract profile and the Supabase validation together.

### 3.3 Production Worker deploy did not validate the CORS allowlist

The production workflow checked that the allowlist variable was non-empty and
validated the health and Supabase URLs for placeholders, but never inspected the
allowlist itself. A production version could be uploaded with an `.invalid` host.

**Fix.** Each entry must now be a bare HTTPS origin, and is rejected if it is a
placeholder or an `.invalid`, `.example`, `.test` or `localhost` host. Verified
against valid, `.invalid`, empty and plain-HTTP inputs, and locked in by three
new guard assertions.

### 3.4 Runtime-evidence tests were stale against their own schema

The receipt schema had been tightened to version 2, adding a probe source path,
per-subject commit and artifact checksums, a provider record ID and a required
scenario matrix. The test fixture still produced version 1 receipts, so two of
eight tests failed and the evidence pipeline was unverified.

**Fix.** The fixture builder now emits version 2 receipts with the exact required
scenario matrix per check and real raw-artifact files on disk whose byte counts
and checksums match. The provider-dashboard fixture also gained the FCM and APNs
control-plane subjects the implementation requires.

### 3.5 Complexity budgets did not cover backend code

The source-health guard only walked the mobile app tree, leaving Edge Functions
and the Worker unbudgeted. The largest file in the repository, the media-assets
handler at 2,095 lines, was entirely unguarded.

**Fix.** A second budget pass now covers the Edge Functions and Worker source
with a 600-line default and explicit ratcheted exemptions for the four existing
oversized files. The pass also fails when an exemption becomes stale or sits more
than 100 lines above actual size, so recorded debt can only shrink.

### 3.6 Two HIGH production advisories were unfixed, and one acceptance was stale

`npm run security:audit:prod` failed with four unaccepted advisories, two of them
HIGH severity in `browserslist`. Separately, the guard carried two acceptances
for `image-size`, a dependency that is no longer in the production tree at all.

**Fix.** Three advisories were resolved rather than accepted:

| Advisory | Dependency | Severity | Action |
|---|---|---|---|
| `GHSA-c83g-rgw3-j3cx` | `browserslist` | high | override to 4.28.8 |
| `GHSA-73wf-gq98-2v4g` | `browserslist` | high | override to 4.28.8 |
| `GHSA-6gmq-8vp8-gcm6` | `@xmldom/xmldom` | moderate | override raised 0.8.13 to 0.9.12 |

The stale `image-size` acceptances were deleted, because an acceptance that
outlives its vulnerability silently pre-approves a future reintroduction.

The fourth advisory, `GHSA-vcc3-ghjq-m6fr` in `decode-uri-component`, **cannot**
be fixed by an override. The only version outside the vulnerable range is ESM
only, while its consumer `query-string@7` is CommonJS and calls `require()`.
Forcing it would break deep-link parsing at runtime. It is recorded as a
time-bounded acceptance with owner, reason, exploitability and expiry, and is
documented in [SECURITY_RISK_ACCEPTANCE.md](../SECURITY_RISK_ACCEPTANCE.md).

The guard itself was strengthened in two ways while doing this:

1. An acceptance missing an owner, reason, exploitability assessment or a
   well-formed expiry now fails the build. Previously a bare URL was enough.
2. Compensating controls are now scoped to the dependency they protect.
   Previously the `image-size` control ran whenever *any* acceptance was active,
   so resolving one advisory made an unrelated control fail.

Both failure paths were verified by injecting the fault and observing the guard
fail, then restoring and observing it pass.

Resulting audit state: **0 critical, 0 high, 4 moderate**, one acceptance.

### 3.7 Branch coverage was below its own threshold

`npm run test:coverage` failed at 89.56% branch coverage against a 90% gate. The
threshold was not lowered. Tests were added for genuinely untested behaviour, in
the areas where the gaps were also the most security-relevant.

| Area | Tests before | Tests after | What is now covered |
|---|---:|---:|---|
| `pushNotificationRepository` | 16 | 28 | iOS ephemeral and authorized permission states, each quiet-notification flag, absent iOS permission detail, device-token registration guards, account-switch cleanup for an unknown token |
| `useAuthSessionLifecycle` | 6 | 8 | A failed pre-expiry refresh retries instead of signing out; a refresh that returns no account does sign out |
| `maps-geocoding` handler | 12 | 15 | Sparse provider entries fall back for place identity and name, subpremise results are treated as points of interest, missing geometry falls back to the requested coordinates |
| `_shared/originSecurity` | 4 | 9 | Untrusted function names, short secrets, each missing signed header, unreachable replay protection, non-boolean claim results, single-row array claim results |

Result: branch coverage 90.08%, and the full coverage run exits 0.

Two things are worth noting about the origin-security tests. Every one passed on
first run, which confirms the implementation was already correct and only
untested. And the push tests surfaced a real behavioural detail: iOS delivery
for an `AUTHORIZED` status still depends on the platform grant flag, so a test
fixture that sets one without the other does not register.

## 4. What the Docker lane now proves

The repaired profile was executed on this machine and exited 0:

| Stage | Result |
|---|---|
| Worker contract tests in-container | 34 passed across 3 files |
| Migration replay on a clean database | all migrations applied |
| Supabase DB lint | no schema errors |
| pgTAP RLS, IDOR and security suites | 180 passed across 6 files |
| Dump and isolated restore parity | 22 tables, 70 routines, 50 RLS policies, 3 buckets |
| Teardown | stack stopped, no orphan volumes |

Before the fix in section 3.1 this profile could not build at all.

## 5. Gates that remain open

These are unchanged and remain the reason the release is NO-GO. They cannot be
closed from this environment because they need provider or device access.

| Gate | Why it cannot be closed here |
|---|---|
| Cloudflare account, zone, DNS, TLS, WAF, preview deploy, staged rollout | No Cloudflare credentials or zone reachable |
| Signed Android AAB and iOS IPA, plus artifact inspection | No signing material, and an iOS archive needs macOS |
| OTA first binary, preview smoke, staged rollout and rollback | Depends on the signed binaries above |
| Physical device push matrix across iOS and Android lifecycle states | No physical devices attached |
| Play internal track and TestFlight | Depends on signed artifacts |
| Supabase production backup state and staging restore drill | Hosted project not reachable |
| Sentry alert fire and recover | Provider not reachable |

Each has an exact, executable procedure in [MANUAL_STEPS.md](../MANUAL_STEPS.md)
and a machine-checkable receipt shape in the runtime receipt schema.
