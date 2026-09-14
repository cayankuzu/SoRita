# Delivery and Operations Release Gates

> Repository automation is prepared; no provider, domain, store, backup, load,
> uptime, or device result is claimed by this document. Until the evidence named
> below exists for the immutable candidate SHA, release remains **NO-GO**.

## HTTPS Universal Links and Android App Links

`EXPO_PUBLIC_APP_LINK_DOMAIN` is an optional, client-visible hostname. It is
not a secret. Leave it empty for custom-scheme-only development builds. For a
real release, set the same canonical hostname (without `https://`, port, path,
or credentials) in the protected EAS environment before creating a new native
binary. The build then emits iOS `applinks:<host>` and Android HTTPS
`autoVerify` intent-filter declarations; an OTA update cannot add either
native entitlement.

1. Choose and control a public HTTPS hostname. Do not reuse a Supabase or API
   host merely because it exists.
2. Replace placeholders in
   `ops/link-association/apple-app-site-association.template.json` with the
   Apple team ID and iOS bundle ID, and host it at
   `https://<host>/.well-known/apple-app-site-association` with no redirect and
   `application/json` content type.
3. Replace placeholders in `ops/link-association/assetlinks.template.json`
   with `com.cayan.sorita.socialmap` and the **actual Play app-signing
   certificate** SHA-256 fingerprint (not an unverified local debug key). Host
   it at `https://<host>/.well-known/assetlinks.json`, also without a redirect
   and with `application/json`.
4. Run `npm run app-links:check`, then, from an approved network, set
   `SORITA_ANDROID_APP_LINK_CERT_SHA256` and run `npm run app-links:verify`.
   This verifies both hosted identities but does not prove operating-system
   association caching or routing.
5. Build new iOS and Android binaries. On a real iOS device, install the build
   and open an HTTPS link from Messages/Safari. On an Android device, install
   from the intended Internal track and inspect
   `adb shell pm get-app-links com.cayan.sorita.socialmap`; then cold- and
   warm-open an HTTPS link. Record only sanitized results, build IDs, device
   class/OS, and the candidate SHA.

## Same-SHA CI prerequisites for signed mobile delivery

Both protected signed-binary workflows require numeric `quality_run_id` and
`database_run_id` dispatch inputs in addition to `candidate_sha`. Before the
first EAS Build or provider mutation, each workflow uses read-only GitHub
Actions access to resolve those run IDs and fails closed unless both runs are
completed successfully in this repository, belong to `quality.yml` and
`database-validation.yml` respectively, and have the exact candidate head SHA.
The sanitized run metadata is retained in the delivery receipt.

Operators must allow the Quality and Database Validation workflows to finish,
then copy their numeric run IDs from GitHub Actions. A green run for another
commit, repository, or workflow is not acceptable evidence. These two gates do
not replace the final release-evidence packet, provider processing, or physical
device verification.

## Protected Play Internal delivery

The tracked workflow
`.github/workflows/eas-production-android-internal.yml` is dispatch-only,
requires GitHub `production` environment approval, a lower-case full candidate
SHA equal to the dispatch and checked-out source, successful same-SHA Quality
and Database Validation run IDs, an explicit confirmation, a remote frozen EAS
build, provider identity verification, and an exact-build-ID submit. It has not
been dispatched by repository changes.

Manual provider preparation:

1. In EAS, retain Android signing credentials remotely and associate the Play
   publishing service account in EAS-managed credentials. Do not add a JSON
   key or `serviceAccountKeyPath` to the repository or CI workspace.
2. In Google Play Console, confirm the app package and Play App Signing state,
   create/select the Internal testing track, add the intended tester list, and
   grant the EAS service account the minimum release permission.
3. Configure the protected GitHub `production` environment with reviewers,
   `EXPO_TOKEN`, and only the public runtime variables referenced by the
   workflow. Set `EXPO_PUBLIC_APP_LINK_DOMAIN` there if HTTPS links are
   enabled.
4. Run `npm run eas:android-internal:check`. Dispatch only from the default
   branch with the exact candidate SHA, the successful same-SHA Quality and
   Database Validation run IDs, a sanitized release name, and explicit
   confirmation. The workflow does not download or retain an AAB locally;
   EAS/Play manage the provider artifact.
5. Review the Play Internal release, install it through the tester flow, test
   sign-in, reset link, push tap, upload, and HTTPS app link on a physical
   device. Retain the sanitized workflow receipt and Play release reference.

## Protected TestFlight delivery

`.github/workflows/eas-production-ios.yml` follows the same pre-build Quality
and Database Validation evidence gate. Dispatch it from the default branch with
the exact `candidate_sha`, both successful same-SHA numeric run IDs, a sanitized
`what_to_test` note, and explicit `confirm_testflight` authorization. The
protected `production` environment must provide the documented EAS and
ephemeral App Store Connect credentials; the workflow freezes remote build
credentials, verifies the returned provider build against the candidate, and
submits only that exact build ID. It has not been dispatched by repository
changes.

After App Store Connect processing, an approved tester must install the build
through TestFlight and complete the physical-device matrix. Retain only the
sanitized workflow receipt and approved provider/device references; never copy
the ephemeral App Store Connect key into evidence.

## Uptime and SLO probes

Set the GitHub `production-evidence` environment variable
`SORITA_UPTIME_HEALTH_URL` to an approved public HTTPS health endpoint. The
scheduled `uptime-slo-probe.yml` records only host, status, duration, and
`no-store` observation; it does not send credentials or request bodies. The
environment must have an approved owner, alert routing, and external access
policy before enabling scheduled execution.

For a manual probe, set `SORITA_UPTIME_RUN_CONFIRM=APPROVED_EXTERNAL_PROBE`
and run `npm run ops:uptime:probe -- --url <approved-health-url> --samples 3
--output artifacts/release-evidence/manual/observability/uptime.json`. A pass
is a tiny synthetic sample, not attainment of the provisional monthly SLO.
Attach provider dashboard/query, alert-delivery, ownership, and response
evidence as required by `docs/observability-slo-runbook.md`.

## Backup/PITR restore drill

The local Docker restore profile is not hosted PITR evidence. An authorized
operator must confirm Supabase retention/backup entitlement and restore to a
fresh **isolated staging** project only. Never run this procedure in place on
production without an incident commander.

1. Capture the selected restore-point UTC time and a provider operation
   reference; do not export connection strings, rows, or secrets.
2. Restore database data and a separately approved Storage sample to the
   isolated target. Reconfigure only non-production credentials and deny
   production traffic.
3. Check schema/migration parity, RLS negative paths, Auth, critical reads,
   upload/download authorization, and Storage reconciliation. Measure observed
   RPO/RTO instead of inventing targets.
4. Write sanitized JSON conforming to the validation fields in
   `utils/ops/validate-restore-drill-evidence.mjs`, then run
   `npm run ops:restore-drill:validate -- --file <evidence.json>`.
5. Store the validated evidence and operator approval under the ignored manual
   release-evidence path. It remains external evidence, not a committed claim.

## Staged capacity campaign

Never point these scripts at production. Provision an isolated staging project,
representative non-sensitive data, isolated synthetic identities, provider
quota/cost approval, dashboards, and an operator able to stop the test. The
target stage additionally requires `SORITA_PROVIDER_LOAD_APPROVAL_ID`.

Set `SORITA_LOAD_CAMPAIGN_CONFIRM=STAGING_ONLY_APPROVED_CAMPAIGN`,
`SORITA_LOAD_CANDIDATE_SHA` (which must equal a clean checked-out `HEAD`), the
existing staging URL/publishable key/identity variables, distinct approved
`SORITA_LOAD_STAGING_PROJECT_REF` and `SORITA_LOAD_PRODUCTION_PROJECT_REF`
values, and an empty non-symlink evidence directory. Then run
`npm run ops:load:campaign`.
It stops before the next stage on failure and produces per-stage k6 summaries
for 25, 250, 1,000, and 10,000 VUs. Run
`npm run ops:load:evidence:validate -- --dir <evidence-dir>` before reviewing
the raw metrics. Validation binds every summary checksum and byte count to the
current candidate and enforces the k6 error/p95/p99 thresholds. The schema
proves complete sanitized records, not capacity
approval; attach provider saturation, cost, recovery, and stop-decision
evidence before asserting any SLO.

## Historical secret incident gate

The current-tree check does not close the historical Sentry credential incident
listed in `SECURITY_CHECKLIST.md`. Before any production delivery, an approved
incident owner must revoke/rotate the credential provider-side, review audit
logs, coordinate any history remediation with a mirror backup, and run the
existing full-history scanner across all refs. Record sanitized operation IDs
and disposition under the incident evidence path in
`docs/security-incident-response.md`; never copy the credential, its value, or
raw provider logs into this repository.
