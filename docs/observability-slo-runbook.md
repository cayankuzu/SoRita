# Observability and SLO Runbook

> Status: **PROVISIONAL / UNMEASURED** as of 2026-08-30. The targets in
> [`docs/slo.md`](./slo.md) are policy proposals, not measured production
> performance. Provider dashboards, alert delivery, retention, ownership and
> production burn-rate evidence are `UNVERIFIED`; production release status is
> therefore `NO-GO`.

## Purpose and authority

This runbook describes how to establish, validate and operate observability for
the existing SoRita product surface. It does not create a new feature, approve a
release, or authorize access to production data. Operational owner:
`OWNER_TBD`.

Do not place access tokens, raw request bodies, user-generated content, email
addresses, precise locations or other personal data in screenshots or evidence
artifacts.

## Source-of-truth map

| Source | What it currently defines | Evidence status |
| --- | --- | --- |
| [`docs/slo.md`](./slo.md) | Provisional availability, latency, upload, publish and crash-free targets | `UNMEASURED` |
| `src/mobile/app/performance/budgets.ts` | Client release-performance budgets, expressed as p75 limits | Code-defined; production attainment `UNVERIFIED` |
| `src/mobile/app/platform/observability/sentry.ts` | Sentry initialization, navigation integration and sampling behavior | Source-reviewed; provider configuration `UNVERIFIED` |
| `src/mobile/app/platform/observability/sentryAnalyticsProvider.ts` | Low-cardinality event, duration and value metrics | Source-reviewed; ingestion/dashboard `UNVERIFIED` |
| `src/mobile/app/platform/logger.ts` | Production warning/error forwarding and field redaction | Source-reviewed; provider retention/routing `UNVERIFIED` |
| `infra/cloudflare/sorita-edge/src` | Edge structured logging and request correlation fields | Source-reviewed; deployed log pipeline `UNVERIFIED` |
| Supabase project logs and metrics | Function, database, Auth and Storage runtime signals | External provider state `UNVERIFIED` |

The p75 client budgets and the provisional p95 service SLOs are separate
contracts. Passing one does not prove the other.

## Required signal inventory

| User journey or subsystem | Minimum signal | Present in source | Missing release evidence |
| --- | --- | --- | --- |
| App launch/navigation | Release identifier, environment, navigation transaction, crash/error | Sentry integration is present | Release association, source maps, dashboard and crash-free report |
| Feed/search/list reads | Duration, success/error outcome, environment and release | Client metric conventions are present | A reviewed query, denominator and p95 report |
| Mutations/publish/upload | Duration, success/error outcome and terminal state | Client analytics/metrics and backend logs are available in principle | Cross-provider correlation and success-rate report |
| Cloudflare edge | `requestId`, `cfRay`, route, method, status, duration, error code, environment | Structured log fields are present | Deployed log destination, retention, alert and sample-rate proof |
| Supabase Functions | Invocation/error/runtime logs correlated to request where possible | Provider capability; function source exists | Production log access, redaction review and correlation proof |
| Database/Auth/Storage | Availability, errors, saturation/usage and policy failures | Provider capability | Dashboard capture and alert delivery proof |

## Establishing an SLI

For each provisional SLO, the release owner must attach a reviewed SLI
definition before claiming measurement. Every definition must record:

- event or metric name, source provider and environment;
- numerator, denominator, exclusions and time window;
- percentile aggregation and sample-size handling where applicable;
- release/build/runtime identifiers and timezone;
- data-retention period and access controls;
- a link to the dashboard/query and a sanitized export;
- approving owner (`OWNER_TBD`) and approval timestamp.

Do not silently combine client duration with server duration, cached responses
with origin responses, or foreground-only sessions with all sessions. If a
denominator cannot be reconstructed, label the result `UNVERIFIED`.

## One-time provider setup and verification

1. Configure the Sentry project and build credentials using only the variable
   names documented in [`docs/MANUAL_STEPS.md`](./MANUAL_STEPS.md). Confirm that
   default PII collection remains disabled and review the pseudonymous Sentry
   user identifier against the privacy declaration and retention policy.
2. Upload and verify source maps for a non-production test release. Confirm the
   provider associates an intentionally generated, non-sensitive test error
   with the exact release/build.
3. Create dashboards for each approved SLI. Mark every panel without a reviewed
   query and useful traffic as `UNVERIFIED`.
4. Configure warning and critical notifications only after the SLI query is
   reviewed. Exercise delivery to the approved on-call destination with a test
   notification; do not claim the alert is active from configuration alone.
5. Configure Cloudflare and Supabase log access, retention and redaction.
   Confirm no authorization headers, tokens, raw request bodies, email
   addresses or precise location payloads are stored.
6. Save sanitized screenshots/exports and provider audit references under
   `artifacts/release-evidence/manual/observability/`.

## Repository verification

Run from a clean candidate commit:

```powershell
npm run performance:test
npm run security:verify
npm run check:release
npm --prefix infra/cloudflare/sorita-edge run check
```

Expected safe result: all commands exit successfully without modifying tracked
files. These checks validate repository contracts only; they do not prove that
provider ingestion, dashboards, alert routing or production SLOs work.

## Triage procedure

1. Record the UTC start time, affected environment, app release/build/runtime,
   Cloudflare version and candidate commit SHA. Assign `OWNER_TBD` until an
   accountable incident owner accepts the case.
2. Determine user impact from aggregates. Avoid searching raw personal data
   unless the approved incident procedure requires it.
3. Correlate client events with edge `requestId`/`cfRay`, then Supabase Function
   and database logs. A missing correlation field is evidence of a gap, not
   proof that a subsystem was healthy.
4. Check deploy and canary changes before escalating to an infrastructure
   hypothesis.
5. Contain or roll back through the applicable Cloudflare, EAS Update, database
   or binary runbook. Do not deploy a broad unrelated change during triage.
6. Re-run the same SLI query over a documented recovery window and attach the
   result. Close only when the approved owner confirms user impact ended.

For suspected compromise, credential exposure or personal-data leakage, switch
to [`docs/security-incident-response.md`](./security-incident-response.md).

## Alert quality and ongoing review

Until provider evidence exists, every alert in [`docs/slo.md`](./slo.md) remains
a provisional rule. Before promotion to an operational alert, demonstrate:

- a reviewed query and stable denominator;
- a test notification reaching the intended destination;
- deduplication and recovery behavior;
- an attached response runbook;
- an accountable owner and escalation route;
- a false-positive/false-negative review after real traffic is available.

No numeric error budget, alert burn rate, response SLA or retention period is
approved by this document. Missing decisions remain `OWNER_TBD`, `UNMEASURED`
and release-blocking where required by [`docs/release-readiness.md`](./release-readiness.md).

## Evidence checklist

Store sanitized evidence under `artifacts/release-evidence/manual/observability/`:

- `provider-config/` — project/environment and redaction/retention review;
- `release-and-sourcemaps/` — exact candidate release association;
- `dashboards/` — reviewed queries and exports for each SLI;
- `alert-delivery/` — test trigger, delivery and recovery proof;
- `edge-and-supabase/` — log access, redaction and correlation proof;
- `slo-review.md` — owner, scope, window, exclusions and final disposition.

Do not commit secret values or unsanitized production data. Absent artifacts are
`UNVERIFIED`, not implicitly passed.
