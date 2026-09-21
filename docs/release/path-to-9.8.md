# The path to 9.8

This answers one question precisely: **what has to happen before every scorecard
category reads 9.8?** It exists because the answer is not "more code", and asking
for the score without this map leads to fabricating it.

Last computed: 2026-09-22.

## Why the checked-in file can never show 9.8

`quality/release-scorecard.json` is a **policy baseline**, not a result.
`utils/guards/check-release-scorecard.mjs` freezes it three ways:

```js
if (category.score !== expected.score)            // must equal the frozen table
if (category.score >= EXPECTED_TARGET_SCORE)      // 9.8 is rejected outright
if (scorecard.verdict !== 'NO-GO')                // the verdict is pinned
```

`BASELINE_CATEGORY_CONTRACT` in that guard holds all 35 scores. Editing the JSON
to 9.8 fails `npm run release-scorecard:check`, which fails `npm run
check:release`, which blocks `npm run ota:publish`. This is deliberate: a tracked
file cannot contain the SHA of the commit that contains it, so a number typed
into it proves nothing.

**9.8 exists in exactly one place**: a checksum-bound artifact produced by
`.github/workflows/release-evidence.yml` for one immutable candidate SHA. Raising
a score therefore means producing evidence, never editing a file.

## What a category needs

Each category is gated by named runtime checks (`CATEGORY_RUNTIME_CHECKS`). A
check passes only as an **Ed25519-signed receipt** that:

- carries its exact required scenario matrix (`REQUIRED_SCENARIOS`, ~70 scenarios
  in total) with a raw artifact per scenario, hashed and byte-counted;
- binds every subject to the candidate commit SHA;
- was observed **within 72 hours** of verification;
- is signed by the CI-held key, which is not on the developer machine.

## Leverage, highest first

| Runtime check | Categories it gates | Count | Who can produce it |
|---|---|---:|---|
| `security-review` | 4,5,6,7,9,13,18,19,21,26,27,28,29,30,31,32,34 | **17** | CI only — secret scan, SAST, dependency audit, SBOM provenance, threat review |
| `physical-device-matrix` | 1,2,3,8,10,12,13,14,15,16,22,27,33 | **13** | Needs iOS + Android hardware and a signed build on each |
| `staging-restore` | 4,8,11,13,15,20,27 | 7 | A staging Supabase project |
| `provider-dashboards` | 4,7,11,16,25,27 | 6 | Six control planes: Cloudflare, EAS, Supabase, Sentry, FCM, APNs |
| `cloudflare-preview` | 9,11,12,27 | 4 | A Cloudflare account and zone |
| `observability-alerts` | 17,25,27 | 3 | Sentry alert fire → deliver → recover |
| `signed-android-ios` | 23,27,35 | 3 | Production AAB **and** IPA |
| `ota-preview-rollback` | 25,27,35 | 3 | Depends on both signed binaries |
| `store-internal-tracks` | 24,27 | 2 | Play internal track + TestFlight |
| `backup-pitr` | 25,27 | 2 | Supabase backups with PITR |
| `ota-code-signing` | 27 | 1 | **Blocked: not available on the current Expo plan** |

### Read this table as a plan

1. **`security-review` is the single biggest move.** It alone gates 17 of 35
   categories, needs no hardware, no provider accounts and no store release —
   only a GitHub Actions workflow and the signing key. Nothing else comes close.
2. **`physical-device-matrix` is second at 13**, and it is the one with a real
   cost: its 19 scenarios name iOS current/old and three Android device classes,
   plus push provider 429/5xx and token-rotation cases.
3. **Category 27 (Overall maturity) requires every check**, including
   `ota-code-signing`. Until the Expo plan includes EAS Update code signing,
   **27 cannot reach 9.8 by any amount of work.** It is the one hard blocker; the
   other 34 are reachable with access the owner can grant.

## Honest status

| | Count |
|---|---:|
| Categories at 9.8 today | **0** |
| Reachable with owner-granted access and effort | 34 |
| Blocked by an Expo plan limit | 1 (category 27) |

The code-side work that can be done without provider access has been done and
keeps being done; see the gap fields in the scorecard for what each category
still lists. But no amount of refactoring moves a score, because scores are not
gated on code quality — they are gated on evidence.

## Related

- [ota-runtime-and-release.md](../ota-runtime-and-release.md) — the OTA contract
  and the iOS baseline build that `signed-android-ios` waits on
- [MANUAL_STEPS.md](../MANUAL_STEPS.md) — the executable procedure per gate
- `release-evidence/runtime-receipt.schema.json` — the receipt shape
