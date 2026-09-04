# Incident Runbook

## Severity

- SEV1: credential leak, auth outage, data exposure, destructive data loss, store-blocking crash.
- SEV2: degraded feed/upload/mutation path, elevated crash/ANR, partial privacy regression.
- SEV3: isolated feature regression with workaround.

## First 30 Minutes

1. Assign incident commander.
2. Freeze releases and stop rollout.
3. Capture timeline, release SHA, affected version, environment, and user impact.
4. Preserve logs and dashboards without exporting PII.
5. Decide containment: feature flag, backend block, store rollout halt, credential revoke, or forward-fix.

## Credential Leak

1. Identify secret type and scope.
2. Revoke or rotate provider-side credential.
3. For Android signing, verify Play App Signing state before any action.
4. Never blindly replace app-signing key.
5. Clean git history only with coordinated mirror backup and team communication.
6. Run full-history secret scan after cleanup.

## Data Exposure

1. Identify tables/buckets/functions and exact exposed fields.
2. Apply least-risk containment migration or policy change.
3. Run RLS/RPC negative tests for the affected boundary.
4. Prepare user/legal notification material if required.

## Post-Incident

- Root cause, blast radius, timeline, evidence, and prevention tasks.
- Add regression tests and monitoring.
- Keep irreversible credential/history operations as signed manual records.
