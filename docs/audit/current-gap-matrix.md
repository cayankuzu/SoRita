# SoRita — Current Gap Matrix

## 2026-09-07 working-tree hardening delta

> This section is the current assessment. The 2026-09-03 material below is
> retained as historical evidence and must not be read as proof for this dirty,
> uncommitted tree.

- Base HEAD: `b347f7f2ff91becec0db97f83088c017d6e7d1ed`
- Working branch: `chore/final-release-candidate-aaa`
- Candidate status: **none** — the working tree is intentionally uncommitted
- Product version: `1.0.106`; Android `111`; iOS `91`
- Current decision: **SOURCE HARDENED / RELEASE `NO-GO`**

The three supplied master prompts were treated as an audit backlog, not as an
instruction to manufacture a score. Contradictory or unjustified expansion
(dark mode, English/RTL, microservices, Kafka, and other non-MVP surface) was
rejected. The Turkish, light-theme, phone-first MVP surface remains frozen by
the bidirectional product-surface guard. Work was prioritized by user-data
isolation, auth correctness, exploitability, crash/performance impact, and the
strength of evidence that can be produced in this environment.

### Material changes in this delta

| Area | Result |
|---|---|
| Auth lifecycle | Auth transitions now have one lifecycle owner, serialized scope changes, generation/owner guards at asynchronous boundaries, fail-closed purge handling, owner-bound persisted snapshots, and deterministic login/logout/refresh race coverage. |
| Notification isolation | Hydration uses authoritative unread counts, parallel page/count reads, monotonic same-owner sequencing, account-generation and unmount guards, and repository-level pre/post session-owner verification including empty responses. |
| Request/media security | Legacy weak request signatures and invalid-signature downgrade retries were removed. Upload cleanup now targets the actual bucket and size errors use the selected bucket policy. |
| Lists/data ownership | Network reads require the live authenticated Supabase owner; caller-supplied fallback ownership was removed. |
| Android notification privacy | Lock-screen visibility is private. The immutable channel was bumped to `sorita-alerts-v5`, and native/app-config parity is enforced. |
| Profile performance | The static discovery grid and nested same-axis scroll layout were removed. Each tab now has a real virtualized list as its vertical scroll owner while preserving refresh, pagination, tab offsets, and scroll-to-top behavior. |
| Release evidence | The checked-in scorecard is schema-v2, fixed-shape, baseline-only `NO-GO`. It cannot ingest arbitrary receipts or self-assert runtime verification; final `GO` can only come from the checksum-bound same-SHA release-evidence workflow artifact. |
| Test and tool reliability | Vitest uses the runner config loader and a version-aware dedicated Node local-storage file, coverage is cleaned before every measurement so stale shards cannot inflate the result, the React Native `Pressable` test mock now evaluates render props, Docker's npm runner no longer uses a shell, and Supabase local mail uses the current `local_smtp` configuration. |

### Current local automated evidence

These results were produced on the dirty working tree above after the code and
test changes. They are useful local evidence, but they are not an immutable-SHA
CI attestation and do not change the release decision.

| Gate | 2026-09-07 local result |
|---|---|
| Type safety and repository lint | `typecheck` passed. Full lint passed, including architecture boundaries, 405 app/21 backend source-health budgets with no cycles, UTF-8 across 782 files, 64 tracked evidence documents, UI copy/tokens, accessibility, 150-file 48dp touch targets, product-surface freeze, marketing claims, and native parity. |
| Full regression | 167 files / 995 tests passed. |
| Security regression | 20 files / 303 tests passed. |
| Clean global coverage | 167 files / 995 tests passed; statements 94.63%, branches 90.25%, functions 94.26%, lines 94.86%. No threshold or exclusion was relaxed. |
| Release policy | Scorecard policy/schema guard and 12 self-tests passed. This validates a working-tree `NO-GO` baseline only; the printed HEAD is context, not a SHA binding. |
| Delivery and operations contracts | Deployment workflows 17/17, OTA/EAS 44/44, release evidence 8/8, and operations 18/18 passed. |
| Performance and Expo contracts | 7 files / 24 tests passed. Expo dependencies are aligned and Expo Doctor passed 19/19 checks. The official Android Hermes bytecode bundle measured 9.46 MiB against a 12 MiB budget, and the Android release baseline-profile merge passed. |
| Dependency and dead-code policy | Dead-code and license checks passed for 738 locked production packages. The production audit reports 0 critical, 0 high and 4 moderate advisories under one time-bounded acceptance; signature provenance verified 968 packages and 218 attestations. |
| Container and database validation | The ready isolated validation database applied the pending `20260914150000`, `20260914153000`, and `20260914160000` migrations in order; DB lint returned no errors and 10 pgTAP files / 311 assertions passed. A fresh full-stack verification attempt exceeded the shell timeout during initial stack startup, so final same-SHA zero-reset and dump/restore evidence is still required. This is local evidence, not hosted-provider evidence. |
| Android smoke artifact | The current tree produced a 125,021,804-byte APK for `com.cayan.sorita.socialmap` version `1.0.102` (`107`), SHA-256 `9129B78B6467D0E201862BEB4F70CCB69CEBF19C9BE329CF7DC97EF7E1ACB6B7`. APK Signature Scheme v2 verification passed, but the signer is Android Debug, so this is only a local smoke artifact—not a store/release artifact. |
| Emulator smoke | The APK updated in place and rendered the guest UI on one API 30 emulator, but Maestro was occluded by an emulator System UI ANR dialog. A second emulator retained an older differently signed build and was not uninstalled or data-cleared. No device-flow execution is claimed as passed. |
| Product and E2E manifests | Product-surface guard 12/12 passed. All 30 critical flows map to named evidence, but only 1/12 device-required flows maps to a Maestro YAML definition and no execution result is attached. |

An additional in-session security review pass found and drove closure of several
subtle auth ordering cases, including `SIGNED_OUT`/`SIGNED_IN` renders that occur
before a Supabase mutation promise resolves, chained `B → null → C` transitions,
stale transition markers, failed newer login attempts, and terminal logout priority.
No high-confidence open-diff security finding remained after the final patch;
this is not a substitute for the external gates below.

### Open release blockers

1. A non-placeholder Sentry auth credential is still reachable in historical
   `.env` commits. Revoke/rotate it provider-side, review access/audit logs and
   blast radius, coordinate history remediation, and attach a clean full-history
   scan. Never copy the credential value into evidence or tickets.
2. There is no clean immutable candidate SHA and therefore no checksum-bound
   same-SHA CI/provider evidence for hosted Supabase, Cloudflare, EAS, Sentry,
   migrations, restore, canary, rollback, or production monitoring.
3. Production-signed Android AAB and iOS IPA, Play Internal/TestFlight evidence,
   and the required physical-device matrix are absent. The local APK is
   debug-signed and cannot close any distribution gate. The successful Android
   build also emitted warnings from transitive Google Play Services bytecode and
   future Gradle 10 deprecations; the signed release lane must re-evaluate them
   against its exact dependency/plugin graph.
4. The critical-flow manifest maps 30/30 flows to named automated evidence, but
   only 1/12 device-required flows has a mapped Maestro YAML definition and no
   same-SHA execution result is attached. The remaining flows require real
   device/store execution against the same immutable candidate.

Until every blocker is closed by independently controlled evidence, neither a
9.8 score nor a production `GO` is supportable.

## Historical snapshot — 2026-09-03

- Previous/base HEAD: `b8c8dd9bc822d4d66f55befcbde88ecb38704c3c`
- Resulting candidate: `86702f86c06d57a05a668bebf47bdb91e7b0636f`
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
