# SoRita Verified Baseline

Date: 2026-07-18

Timezone: Europe/Istanbul

Verified branch: `main`
Verified base: `89d9bc89835d55e3fd8415e0225a21213bd05692`

Before implementation, local `HEAD` and `origin/main` matched and the working tree was clean. This
working tree now contains the uncommitted release-hardening implementation; no commit, push, PR,
signing operation, native build, store identity change, or production database mutation was made.

## Automatic baseline comparison

| Gate | Audit baseline | Current evidence |
|---|---:|---:|
| Lint | 70 warnings | 0 warnings |
| Tests | 91 files / 432 tests | 104 files / 613 tests |
| Statements | 82.05% | 94.96% |
| Branches | 69.60% | 90.00% |
| Functions | 86.09% | 94.11% |
| Lines | 82.23% | 95.22% |
| Dependency advisories | 13 | 0 vulnerabilities |
| Expo Doctor | 18/18 in the audit, later direct-dependency drift detected | 18/18 after correction |
| Critical-flow executable evidence | absent | 30/30 mapped |

## Current local tool availability

- k6 is available; the 1,000-VU script parses with its thresholds.
- Docker, Supabase CLI, PostgreSQL client, and actionlint are unavailable on this workstation.
- Workflow YAML syntax was independently linted.
- Database reset/lint/pgTAP/restore is configured in CI but was not claimed as locally executed.
- Native builds and signed artifacts were intentionally not produced.

See `docs/release/FINAL_RELEASE_EVIDENCE.md` for the completed scope, measurements, remaining
external gates, and release decision.
