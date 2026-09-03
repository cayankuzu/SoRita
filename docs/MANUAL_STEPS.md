# Manual External Steps and Evidence Register

> Snapshot: 2026-08-31. Branch:
> `chore/final-aaa-mvp-hardening-docker-cloudflare-ota`; source version
> `1.0.102`, Android `107`, iOS `87`. No external provider action in this
> document has been proved for an immutable candidate SHA. Unless a section includes attached
> evidence from the exact immutable candidate SHA, its status is `UNVERIFIED`.
> All production-impacting sections are `NO-GO`. Operational and approval owner
> is `OWNER_TBD` unless an accountable person accepts it in the evidence record.

This file is the handoff for work that cannot be completed or proved from the
repository alone. It does not grant provider access or authorize deployment,
traffic changes, credential rotation, database mutation, restore or store
submission.

## Handling rules

- Record variable/configuration **names only** in committed evidence. Never
  record values, tokens, IDs that are treated as credentials, database URLs,
  signing material or authorization headers.
- Angle-bracket text in commands, such as `<staging-project-ref>`, is a required
  operator-supplied identifier. It is not a value to copy literally and must not
  be committed if organizational policy classifies it as sensitive.
- Run mutations only from an immutable candidate after same-SHA quality and
  database evidence exists. Use an approved least-privilege operator identity.
- Sanitize screenshots and command output before placing them under
  `artifacts/release-evidence/manual/`.
- Every approval record must include candidate SHA, UTC time, environment,
  decision, unresolved gaps, rollback target and owner. Missing fields mean
  `UNVERIFIED`.

## 1. Cloudflare account and least-privilege token

- **Current status:** `UNVERIFIED / NO-GO`. Repository workflows reference
  protected configuration, but no account membership, token-scope or successful
  provider-run evidence is present.
- **Why:** Preview/production Worker upload, version routing and rollback require
  a verified account and a narrowly scoped non-personal deployment identity.
- **Panel/location:** Cloudflare Dashboard → account membership/API Tokens;
  GitHub repository → Environments → preview/production → secrets and variables.
- **Variable/configuration names only:** `CLOUDFLARE_ACCOUNT_ID`,
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_EDGE_CORS_ALLOWLIST`,
  `CLOUDFLARE_EDGE_HEALTH_URL`, `CLOUDFLARE_EDGE_LOG_SAMPLE_RATE`,
  `CLOUDFLARE_EDGE_SUPABASE_URL`, `CLOUDFLARE_ORIGIN_HMAC_SECRET`,
  `CLOUDFLARE_IP_HASH_PEPPER`, `CLOUDFLARE_SUPABASE_PUBLISHABLE_KEY`.
- **Authorized action:** An account administrator creates a dedicated token with
  only the permissions and resources required by the checked-in Worker
  workflows, stores it in protected GitHub environments, requires reviewers for
  production, and records the scope review without the token value.
- **Verification command/check:**

  ```powershell
  Set-Location infra/cloudflare/sorita-edge
  npx wrangler whoami
  npx wrangler deployments status --env preview --json
  npx wrangler deployments status --env production --json
  ```

- **Expected safe result:** The intended automation identity and account are
  shown; it can read only the intended Worker deployment state. No token value
  appears in output, logs or artifacts.
- **Rollback:** Revoke the dedicated token, remove it from both GitHub
  environments and restore the previously approved token reference. Do not
  delete Worker versions or routes as part of credential rollback.
- **Owner:** `OWNER_TBD`.
- **Evidence path:**
  `artifacts/release-evidence/manual/cloudflare/account-token/`.

## 2. Cloudflare DNS, TLS and public Worker route

- **Current status:** `UNVERIFIED / NO-GO`. The checked-in Worker configuration
  contains non-production placeholders; no approved hostname, DNS/TLS state or
  route ownership is proved.
- **Why:** The mobile gateway needs an owned HTTPS endpoint with deterministic
  routing; exposing an unverified `workers.dev` route or wrong hostname can
  bypass policy or direct traffic to the wrong environment.
- **Panel/location:** Cloudflare Dashboard → Workers & Pages → Worker → Settings
  → Domains & Routes; DNS → Records; SSL/TLS; GitHub protected environments.
- **Variable/configuration names only:** `CLOUDFLARE_EDGE_HEALTH_URL`,
  `EXPO_PUBLIC_EDGE_API_URL`, `EXPO_PUBLIC_EDGE_CUTOVER_MODE`.
- **Authorized action:** Prove zone ownership, attach a dedicated preview custom
  domain first, validate certificate issuance and DNS resolution, then attach a
  separately approved production domain. Disable unintended public routes only
  after preview/production health and rollback access are confirmed.
- **Verification command/check:**

  ```powershell
  Resolve-DnsName <edge-hostname>
  curl.exe --fail-with-body --proto '=https' --tlsv1.2 https://<edge-hostname>/health
  curl.exe -I --proto '=https' --tlsv1.2 https://<edge-hostname>/health
  ```

- **Expected safe result:** DNS resolves only to the intended Cloudflare service,
  TLS validates for the hostname, `/health` returns the documented healthy JSON,
  and caching headers prevent health-response caching.
- **Rollback:** Detach the new custom domain/route and restore the previously
  recorded DNS/routing configuration. Keep the mobile cutover in `direct` mode
  until the gateway gate is separately approved.
- **Owner:** `OWNER_TBD`.
- **Evidence path:** `artifacts/release-evidence/manual/cloudflare/dns-tls/`.

## 3. Cloudflare WAF, bot, cache and edge rate controls

- **Current status:** `UNVERIFIED / NO-GO`. No provider rule export, preview
  exercise or approved threshold evidence exists.
- **Why:** Authentication/API routes must not be cached, automated abuse must be
  bounded, and legitimate app traffic must not be blocked by untested rules.
- **Panel/location:** Cloudflare Dashboard → Security/WAF, Bots, Caching/Cache
  Rules and rate-limiting controls for the selected zone/service.
- **Variable/configuration names only:** `CLOUDFLARE_EDGE_CORS_ALLOWLIST`,
  `CLOUDFLARE_EDGE_LOG_SAMPLE_RATE`, `CLOUDFLARE_IP_HASH_PEPPER`.
- **Authorized action:** Export the prior rules, introduce narrowly scoped rules
  in log/simulate or preview mode, explicitly bypass caching for dynamic/auth
  routes, and choose rate thresholds only from reviewed traffic/security data.
  Promote a blocking rule only after an approved preview exercise.
- **Verification command/check:**

  ```powershell
  npm --prefix infra/cloudflare/sorita-edge run check
  curl.exe -I --proto '=https' --tlsv1.2 https://<preview-edge-hostname>/health
  curl.exe -i --proto '=https' --tlsv1.2 https://<preview-edge-hostname>/v1/feed
  ```

  Perform any bounded rate/bot probe only against preview with an approved
  request count; do not load-test production from this runbook.

- **Expected safe result:** Health remains available; an unauthenticated dynamic
  route is rejected; dynamic/auth responses are not shared-cacheable; approved
  app traffic succeeds; the bounded abusive pattern is logged/challenged/blocked
  exactly as the reviewed rule specifies.
- **Rollback:** Disable the new rule set or restore the exported prior version.
  Confirm normal preview traffic recovers before any production change.
- **Owner:** `OWNER_TBD`.
- **Evidence path:** `artifacts/release-evidence/manual/cloudflare/waf-cache-rate/`.

## 4. Supabase staging, migrations and Edge Functions

- **Current status:** `VERIFIED (LOCAL) / UNVERIFIED HOSTED / NO-GO`. The
  current migration set passed an isolated local zero-reset, DB lint
  (`results: []`), 6 files/180 pgTAP tests and a separate dump/restore check of
  22 public tables. This is pre-commit local evidence. Hosted staging identity,
  parity, migration history and deployed Function versions are not evidenced.
- **Why:** Schema/RLS/Function changes must be exercised outside production and
  bound to the exact candidate before release.
- **Panel/location:** Supabase Dashboard → staging project → Database, Auth,
  Storage and Edge Functions; approved secret manager; GitHub database workflow.
- **Variable/configuration names only:** `SUPABASE_ACCESS_TOKEN`,
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Authorized action:** Confirm that the linked project is staging, compare
  migration history, take a backup, review a dry run, apply forward migrations,
  deploy only existing reviewed Functions, and execute RLS/Auth/Storage/function
  tests with synthetic accounts. Production push is a separate approval.
- **Verification command/check:**

  ```powershell
  supabase link --project-ref <staging-project-ref>
  supabase migration list --linked
  supabase db push --linked --dry-run
  supabase functions list --project-ref <staging-project-ref>
  supabase db lint --linked --level error
  ```

- **Expected safe result:** The operator confirms staging before linking; local
  and hosted migration histories match after the approved push; lint reports no
  errors; deployed Function names/versions match the candidate; negative RLS and
  authorization tests fail closed.
- **Rollback:** Stop traffic to the affected staging path. Prefer a reviewed
  forward repair migration. Restore only into an isolated project according to
  [`docs/backup-restore-runbook.md`](./backup-restore-runbook.md); never run
  `supabase db reset --linked`.
- **Owner:** `OWNER_TBD`.
- **Evidence path:** `artifacts/release-evidence/manual/supabase/staging/`.

## 5. Supabase Function secrets and origin HMAC

- **Current status:** **`UNVERIFIED / NO-GO`**. The working tree contains Worker
  signing, matching HMAC/timestamp/body/nonce verification in the five selected
  Supabase Functions and a nonce-claim migration. These files are
  uncommitted/unapplied; the origin remains direct-compatible until the external
  enforcement flag is enabled. Setting a shared secret alone does not close the
  direct-origin path.
- **Why:** Gateway cutover is safe only when the origin rejects missing, invalid,
  expired and replayed signatures while authorized requests still succeed.
- **Panel/location:** Supabase Dashboard → staging project → Edge Functions →
  Secrets and Logs; Cloudflare protected environments; approved secret manager.
- **Variable/configuration names only:** `ORIGIN_HMAC_SECRET`,
  `CLOUDFLARE_ORIGIN_HMAC_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
  `CLOUDFLARE_ORIGIN_SIGNATURE_REQUIRED`,
  `GOOGLE_MAPS_SERVICES_API_KEY`, `REPORTS_EMAIL_FROM`, `REPORTS_EMAIL_TO`,
  `RESEND_API_KEY`, `BREVO_API_KEY`, `MODERATION_REPORTS_ALLOWED_ORIGINS`,
  `EXPO_PUBLIC_EDGE_CUTOVER_MODE`.
- **Authorized action:** Keep `EXPO_PUBLIC_EDGE_CUTOVER_MODE` on its existing
  direct path. From a clean reviewed SHA, first apply the nonce migration and
  deploy all five Functions to staging with enforcement disabled; provision the
  same secret-manager value (at least 32 characters) as Worker
  `ORIGIN_HMAC_SECRET` and Supabase `CLOUDFLARE_ORIGIN_HMAC_SECRET`; set the
  Supabase `CLOUDFLARE_ORIGIN_SIGNATURE_REQUIRED` switch only to the reviewed
  boolean literal `true` or `false`; deploy the staging Worker; and verify signed
  traffic. Next exercise a gateway-configured
  mobile candidate while enforcement remains disabled. Before setting required
  signatures, prove that every supported installed binary routes these calls
  through the Worker or approve an explicit old-binary retirement/forced-update
  plan; otherwise old direct clients will fail. Only then enable required origin
  signatures and prove direct negative/replay cases. Do not claim the origin is
  closed while the required flag remains disabled.
- **Verification command/check:**

  ```powershell
  supabase secrets list --project-ref <staging-project-ref>
  npm --prefix infra/cloudflare/sorita-edge run check
  npx vitest run supabase/functions/_shared/originSecurity.test.ts
  supabase migration list --linked
  ```

  In staging, repeat against every selected Function with intentionally missing,
  invalid, expired and replayed origin signatures using an approved harness;
  never place the real secret on the command line.

- **Expected safe result:** Secret **names** and the enforcement flag exist
  without values being printed; source tests/migration state pass; every
  unsigned/invalid/expired/replayed direct-origin request is rejected after
  enforcement; a correctly signed edge request succeeds and correlates by
  request ID. This external result is not currently proved.
- **Rollback:** Before enforcement, keep or restore direct mobile routing and
  remove traffic from the gateway candidate. If enabling required signatures
  breaks an approved old binary, use the recorded emergency decision to restore
  the prior flag while traffic returns to the verified direct path; record that
  the origin is no longer closed. Restore secret references atomically and revoke
  exposed material. Never leave gateway traffic paired with mismatched secrets.
- **Owner:** `OWNER_TBD`.
- **Evidence path:** `artifacts/release-evidence/manual/supabase/origin-hmac/`.

## 6. EAS owner, project, environments and channels

- **Current status:** `PARTIALLY VERIFIED (LOCAL SESSION) / NO-GO`. An
  interactive local EAS session can resolve the operator and project, and the
  repository profiles name development/preview/production channels. A protected
  automation token, environment isolation, channel-to-branch state and
  same-SHA provider evidence are not proved.
- **Why:** A wrong project owner or channel can publish an update to unintended
  binaries/users.
- **Panel/location:** Expo Dashboard → project → Overview, Access, Environment
  Variables, Channels and Updates; GitHub protected environments.
- **Variable/configuration names only:** `EXPO_OWNER`,
  `EXPO_PUBLIC_EXPO_PROJECT_ID`, `EXPO_TOKEN`,
  `EXPO_PUBLIC_RELEASE_ENVIRONMENT`, `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EAS_PREVIEW_OTA_BINARY_READY`,
  `EAS_PRODUCTION_OTA_BINARY_READY`.
- **Authorized action:** Verify organization/project ownership against the
  checked-in config without copying identifiers into evidence, use a dedicated
  least-privilege automation token, keep preview and production variables
  isolated, and confirm each profile points to its intended channel/runtime.
- **Verification command/check:**

  ```powershell
  eas whoami
  eas project:info
  eas channel:list
  eas branch:list
  npx expo config --type public
  ```

- **Expected safe result:** The intended operator/project is selected; the three
  channels exist with reviewed branch mappings; public config contains no
  privileged secret; runtime and project association match the candidate.
- **Rollback:** Revoke the automation token, remove incorrect environment
  variables/channel mapping, and repoint only to the previously recorded branch.
  Do not publish a compensating production update until binary/runtime evidence
  is verified.
- **Owner:** `OWNER_TBD`.
- **Evidence path:** `artifacts/release-evidence/manual/eas/project-channels/`.

## 7. EAS Update code signing

- **Current status:** **`BLOCKED / NO-GO`**. The current EAS account reports the
  Free plan, which does not provide EAS Update code signing. No tracked public
  certificate, secure private-key ceremony or device rejection evidence exists.
  The production OTA workflow now fails closed when the certificate/metadata is
  absent or invalid; this guard is not a signed update.
- **Why:** OTA-capable binaries must authenticate update manifests/assets using
  an approved certificate/key lifecycle and reject invalid signatures.
- **Panel/location:** Expo project settings and approved offline/managed signing
  key store; application configuration under the `updates` keys.
- **Variable/configuration names only:** `EXPO_TOKEN`,
  `updates.codeSigningCertificate`, `updates.codeSigningMetadata`,
  `updates.codeSigningMetadata.alg`, `updates.codeSigningMetadata.keyid`.
- **Authorized action:** The accountable Expo organization owner chooses and
  records one of two safe outcomes: (a) approve a plan that supports EAS Update
  code signing, define certificate ownership/expiry/rotation, generate/store the
  private key outside the repository, commit only the public certificate and
  metadata, then create new preview binaries; or (b) keep production OTA
  disabled and release only through separately verified store binaries. Never
  bypass the workflow certificate check or claim signed OTA on the Free plan.
- **Verification command/check:**

  ```powershell
  npx expo config --type public | Select-String -Pattern 'codeSigning|runtimeVersion|updates'
  eas build:list --profile preview --limit 5 --json
  eas channel:view preview --json

  $evidenceConfig = Join-Path $env:TEMP 'sorita-public-expo-config.json'
  npx expo config --type public --json | Set-Content -LiteralPath $evidenceConfig -Encoding utf8
  node utils/eas/check-update-code-signing.mjs --config $evidenceConfig
  Remove-Item -LiteralPath $evidenceConfig -Force
  ```

  Complete the acceptance/rejection tests on physical iOS and Android devices.

- **Expected safe result:** On the current Free-plan/unconfigured state the
  repository verifier exits non-zero and production publication remains
  blocked. After an approved supported-plan ceremony, public certificate
  metadata and runtime are present; the verifier passes; a valid preview update
  installs; unsigned/tampered/wrong-key updates are rejected; no private signing
  key appears in config, logs or artifacts. If outcome (b) is selected, no EAS
  Update production group is published and that limitation is explicit in the
  release record.
- **Rollback:** Stop the rollout, revert the update rollout where supported, and
  distribute a binary trusted by the last uncompromised certificate. Follow the
  approved key-compromise procedure; do not commit the private key as a shortcut.
- **Owner:** `OWNER_TBD`.
- **Evidence path:** `artifacts/release-evidence/manual/eas/update-code-signing/`.

## 8. Android application signing

- **Current status:** `UNVERIFIED / NO-GO`. Source version `1.0.102` and Android
  `versionCode 107` are prepared. Gradle supports environment-provided release
  signing and fingerprint checking, but a clean same-SHA 107 bundle, secure key
  custody, Play Console association and store installation are not proved. Any
  older `1.0.101`/106 local artifact is not candidate evidence.
- **Why:** A production Android artifact must be signed by the approved upload
  key, map to the intended Play application and remain recoverable.
- **Panel/location:** Approved secret/signing-key store; Google Play Console →
  Setup → App integrity; EAS/CI protected environment.
- **Variable/configuration names only:** `SORITA_RELEASE_STORE_FILE`,
  `SORITA_RELEASE_STORE_PASSWORD`, `SORITA_RELEASE_KEY_ALIAS`,
  `SORITA_RELEASE_KEY_PASSWORD`, `SORITA_RELEASE_EXPECTED_SHA1`, `EXPO_TOKEN`.
- **Authorized action:** Compare the configured certificate fingerprint with the
  Play Console using an authorized operator, inject the keystore/passwords only
  from the secret manager, build the exact candidate and retain the artifact
  digest and build ID without copying signing material.
- **Verification command/check:**

  ```powershell
  .\android\gradlew.bat -p android signingReport
  .\android\gradlew.bat -p android :app:bundleRelease
  eas build:list --platform android --profile production --limit 5 --json
  ```

- **Expected safe result:** The release task fails closed without required
  credentials; with approved credentials it produces a signed bundle whose
  certificate matches the Play upload certificate and whose source/runtime is
  bound to the candidate.
- **Rollback:** Quarantine the artifact, remove temporary local signing files and
  restore the prior secret reference. If compromise/loss is suspected, follow
  the Play upload-key recovery process and the security incident runbook.
- **Owner:** `OWNER_TBD`.
- **Evidence path:** `artifacts/release-evidence/manual/signing/android/`.

## 9. iOS signing and App Store Connect credentials

- **Current status:** `UNVERIFIED / NO-GO`. Production build profiles now use
  frozen EAS-managed remote signing credentials, and the protected workflow
  materializes its submit key only under `RUNNER_TEMP`; provider custody,
  certificate/profile validity and App Store association are not yet proved by
  a same-SHA run.
- **Why:** Store builds and submissions must use the intended team, bundle,
  distribution certificate, provisioning profile and narrowly scoped App Store
  Connect credential.
- **Panel/location:** Apple Developer → Certificates, Identifiers & Profiles;
  App Store Connect → Users and Access → Integrations; approved signing store;
  EAS credentials/build view.
- **Variable/configuration names only:** `EXPO_TOKEN`,
  `submit.production.ios.ascAppId`, `submit.production.ios.appleTeamId`,
  `submit.production.ios.bundleIdentifier`, `EXPO_ASC_API_KEY_BASE64`,
  `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID`.
- **Authorized action:** Store the least-privilege API key only in the protected
  GitHub `production` environment, verify the tracked app/team/bundle identity,
  dispatch `.github/workflows/eas-production-ios.yml` from the exact candidate
  SHA and retain only its sanitized receipt.
- **Verification command/check:**

  ```powershell
  eas credentials --platform ios
  eas build:list --platform ios --profile production --limit 5 --json
  npx expo config --type public
  ```

- **Expected safe result:** The selected team/app/config match; the candidate is
  signed with a valid distribution identity/profile; no private key or App Store
  API-key content appears in repository, logs or evidence; installation succeeds
  through the approved test path.
- **Rollback:** Revoke the newly created API credential if needed, quarantine
  the build and restore the last approved credential reference. Handle suspected
  signing compromise through Apple recovery and the security incident runbook.
- **Owner:** `OWNER_TBD`.
- **Evidence path:** `artifacts/release-evidence/manual/signing/ios/`.

## 10. Sentry project, releases, source maps and alerts

- **Current status:** `UNVERIFIED / NO-GO`. Source integration exists, but
  provider project access, release/source-map ingestion, alert delivery,
  retention and privacy settings are not evidenced.
- **Why:** Crash/error and provisional SLO claims need actionable, sanitized and
  release-correlated telemetry.
- **Panel/location:** Sentry → project settings, Security & Privacy, Releases,
  Source Maps, Alerts and Audit Log; GitHub/EAS protected environments.
- **Variable/configuration names only:** `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`,
  `SENTRY_PROJECT`, `SENTRY_URL`, `SENTRY_AUTH_TOKEN`.
- **Authorized action:** Verify project/environment separation; create a
  least-privilege release-upload token; review default-PII, pseudonymous user ID,
  sampling and retention; upload source maps for a non-production release; then
  exercise alerts with a non-sensitive synthetic event.
- **Verification command/check:**

  ```powershell
  npx sentry-cli info
  npx sentry-cli releases list --org $env:SENTRY_ORG --project $env:SENTRY_PROJECT
  npm run performance:test
  npm run security:verify
  ```

- **Expected safe result:** The candidate release and source maps resolve a
  synthetic stack; intended alerts deliver and recover; no raw secret or
  prohibited personal data is captured; repository checks pass.
- **Rollback:** Revoke the release token, disable the new alert/integration or
  restore prior sampling/retention settings, and remove only synthetic test data
  where provider policy permits. Do not hide a real incident by deleting it.
- **Owner:** `OWNER_TBD`.
- **Evidence path:** `artifacts/release-evidence/manual/observability/provider/`.

## 11. Real-device test matrix

- **Current status:** `UNVERIFIED / NO-GO`. Emulator/unit evidence cannot replace
  physical-device installation, permissions, offline/concurrency and lifecycle
  behavior.
- **Why:** Store and OTA readiness depend on actual iOS/Android binaries, OS
  integration, network transitions, background/foreground and permission states.
- **Panel/location:** Approved physical-device lab; EAS build pages; Play
  Internal testing; TestFlight; device system settings/log capture.
- **Variable/configuration names only:** `EXPO_PUBLIC_RELEASE_ENVIRONMENT`,
  `EXPO_PUBLIC_EXPO_PROJECT_ID`, `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_EDGE_CUTOVER_MODE`.
- **Authorized action:** An owner approves a matrix covering at least physical
  iOS and Android, supported OS boundaries, fresh install/upgrade, denied/granted
  permissions, foreground/background/termination, offline/poor/recovered
  network, concurrent edits, report/block, upload/download and OTA apply/rollback.
  Use synthetic accounts and data.
- **Verification command/check:**

  ```powershell
  adb devices -l
  adb shell dumpsys package <android-application-id>
  xcrun xctrace list devices
  npm run e2e:evidence
  ```

  The `xcrun` command requires the approved macOS test host. Manual journey
  results must be attached per device/build, not inferred from device discovery.

- **Expected safe result:** Each approved matrix cell identifies device/OS,
  immutable build/runtime, tester, UTC time and pass/fail; offline and concurrent
  operations follow the documented contract; no private data enters artifacts.
- **Rollback:** Uninstall/quarantine the candidate, revert the OTA rollout or
  return testers to the last verified binary. Remove synthetic test data through
  the approved cleanup procedure.
- **Owner:** `OWNER_TBD`.
- **Evidence path:** `artifacts/release-evidence/manual/real-devices/`.

## 12. Google Play Internal testing

- **Current status:** `UNVERIFIED / NO-GO`. No current candidate upload, reviewer
  access, tester installation or Play automated-review evidence is attached.
- **Why:** The signed Android bundle must be validated through the same store
  delivery path before any broader release.
- **Panel/location:** Google Play Console → Testing → Internal testing; App
  integrity; App content; Data safety; release dashboard.
- **Variable/configuration names only:** `EXPO_TOKEN`,
  `SORITA_RELEASE_STORE_FILE`, `SORITA_RELEASE_STORE_PASSWORD`,
  `SORITA_RELEASE_KEY_ALIAS`, `SORITA_RELEASE_KEY_PASSWORD`,
  `SORITA_RELEASE_EXPECTED_SHA1`,
  `submit.production.android.serviceAccountKeyPath`.
- **Authorized action:** Upload the exact signed candidate to Internal testing,
  add only approved testers, complete app-content/data-safety prerequisites, wait
  for provider processing and install from the tester opt-in link. If automated
  submission credentials are not approved/configured, use the audited manual
  Console upload rather than adding an ad-hoc key.
- **Verification command/check:**

  ```powershell
  eas build:list --platform android --profile production --limit 5 --json
  adb shell dumpsys package <android-application-id>
  ```

  Compare the installed version/build and certificate with the immutable build
  record and Play App integrity page.

- **Expected safe result:** Play accepts the intended application/package and
  signing lineage; an approved tester installs the exact candidate; critical
  journeys pass; provider warnings and review state are recorded.
- **Rollback:** Halt/deactivate the test release where the Console allows and
  return testers to the last verified track build. A published version code is
  not reused; any replacement follows the normal higher-version process.
- **Owner:** `OWNER_TBD`.
- **Evidence path:** `artifacts/release-evidence/manual/store/play-internal/`.

## 13. Apple TestFlight

- **Current status:** `UNVERIFIED / NO-GO`. No current candidate processing,
  export-compliance/app-information decision, tester install or review evidence
  is attached.
- **Why:** The signed iOS candidate must be processed and exercised through the
  Apple distribution path before production submission.
- **Panel/location:** App Store Connect → app → TestFlight, Build, App
  Information, Users and Access; EAS build/submit records.
- **Variable/configuration names only:** `EXPO_TOKEN`,
  `submit.production.ios.ascAppId`, `submit.production.ios.appleTeamId`,
  `submit.production.ios.bundleIdentifier`, `EXPO_ASC_API_KEY_BASE64`,
  `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID`.
- **Authorized action:** Dispatch the protected exact-SHA iOS build/submit
  workflow, answer export
  compliance/app metadata truthfully, wait for processing/review where required,
  assign only approved testers and install via TestFlight on physical devices.
- **Verification command/check:**

  ```powershell
  eas build:list --platform ios --profile production --limit 5 --json
  eas credentials --platform ios
  ```

  Compare App Store Connect build metadata with the candidate SHA/runtime and
  record device journey results.

- **Expected safe result:** Apple associates the build with the intended app/team;
  processing succeeds without unresolved compliance warnings; approved testers
  install the exact build and complete the real-device matrix.
- **Rollback:** Expire/stop testing the candidate where supported, remove tester
  groups and return to the last verified build. Revoke only a credential known
  to be compromised; do not destroy signing continuity as a routine rollback.
- **Owner:** `OWNER_TBD`.
- **Evidence path:** `artifacts/release-evidence/manual/store/testflight/`.

## 14. Store privacy, data-safety and UGC declarations

- **Current status:** `UNVERIFIED / NO-GO`. Current store answers, published
  privacy/terms URLs, provider disclosures, moderation ownership and an appeal
  lifecycle are not evidenced.
- **Why:** Apple privacy labels/review answers and Google Play Data safety/UGC
  declarations must match actual collection, processing, sharing, retention,
  deletion, report and block behavior.
- **Panel/location:** App Store Connect → App Privacy and App Review Information;
  Google Play Console → App content → Data safety and policy declarations;
  approved public privacy/terms/support pages.
- **Variable/configuration names only:** `EXPO_PUBLIC_SENTRY_DSN`,
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `REPORTS_EMAIL_FROM`, `REPORTS_EMAIL_TO`, `RESEND_API_KEY`, `BREVO_API_KEY`,
  `MODERATION_REPORTS_ALLOWED_ORIGINS`.
- **Authorized action:** Build a reviewed data-flow inventory from code and
  configured providers; reconcile it with privacy/terms/deletion behavior;
  exercise report and block on both stores' test builds; document moderation
  intake, enforcement, notification and appeal ownership; then submit truthful
  declarations. Do not claim an admin panel or resolution state that does not
  exist.
- **Verification command/check:**

  ```powershell
  npm run feature-surface:check
  npm run security:verify
  rg -n "Sentry|moderation_reports|report|block|delete-user|Storage" src supabase docs
  ```

  Compare the results and provider configuration with each store answer and the
  real-device evidence.

- **Expected safe result:** Every declared data type/purpose/sharing/retention
  behavior has a source/provider/policy reference; report/block and deletion
  paths work on physical devices; unresolved moderation lifecycle gaps are
  disclosed and block release rather than being hidden.
- **Rollback:** Withdraw or pause the submission and correct the declaration or
  product behavior through a separately reviewed change. Never falsify an answer
  to preserve a release date.
- **Owner:** `OWNER_TBD`.
- **Evidence path:** `artifacts/release-evidence/manual/store/privacy-ugc/`.

## 15. Supabase managed backups, PITR and restore drill

- **Current status:** `UNVERIFIED / NO-GO`. Plan entitlement, backup retention,
  PITR window, Storage recovery, restore access and approved RPO/RTO are not
  proved. RPO/RTO remain `UNDEFINED`/`UNMEASURED`.
- **Why:** A database deployment or incident cannot rely on an untested backup;
  database restore also does not restore underlying Storage objects or every
  project setting.
- **Panel/location:** Supabase Dashboard → project → Database → Backups; a new
  isolated staging project; approved encrypted backup store/secret manager.
- **Variable/configuration names only:** `SUPABASE_ACCESS_TOKEN`,
  `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Authorized action:** Verify managed-backup/PITR entitlement and restore
  points; approve RPO/RTO; inventory database, Storage, Functions, secrets and
  project settings separately; restore a selected point into a new isolated
  project; then execute the validation in
  [`docs/backup-restore-runbook.md`](./backup-restore-runbook.md). Production
  in-place restore requires separate incident-commander approval.
- **Verification command/check:**

  ```powershell
  supabase migration list --linked
  supabase db lint --linked --level error
  supabase functions list --project-ref <isolated-restore-project-ref>
  ```

  Validate RLS/Auth/Storage/Function journeys with synthetic accounts and compare
  aggregate counts/checksums through approved read-only queries.

- **Expected safe result:** The isolated restore reaches the selected restore
  point, passes integrity/security journeys, restores Storage through its
  separate procedure and records observed recovery/data-loss intervals. No
  production traffic or secret value enters the exercise artifacts.
- **Rollback:** Keep production untouched during the drill. Quarantine or remove
  the isolated project only after evidence/retention approval. A production PITR
  has no assumed automatic rollback; preserve a current restore point and use
  explicit incident command.
- **Owner:** `OWNER_TBD`.
- **Evidence path:** `artifacts/release-evidence/manual/backup-restore/`.

## 16. Cloudflare production canary approvals

- **Current status:** `UNVERIFIED / NO-GO`. The branch workflow defines an
  initial 5% route and manual 25%, 50% and 100% stages, but no same-SHA runs,
  approved observation windows or provider evidence exist.
- **Why:** Traffic must advance only when the exact candidate, rollback version
  and observed health are independently reviewable.
- **Panel/location:** GitHub Actions → Cloudflare Production; protected
  `production` environment reviewers; Cloudflare Workers versions/deployments;
  observability providers.
- **Variable/configuration names only:** `CLOUDFLARE_ACCOUNT_ID`,
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_EDGE_HEALTH_URL`,
  `CLOUDFLARE_EDGE_LOG_SAMPLE_RATE`, `CLOUDFLARE_EDGE_SUPABASE_URL`,
  `CLOUDFLARE_ORIGIN_HMAC_SECRET`, `CLOUDFLARE_IP_HASH_PEPPER`,
  `CLOUDFLARE_SUPABASE_PUBLISHABLE_KEY`; workflow inputs
  `quality_run_id`, `database_run_id`, `preview_run_id`,
  `previous_version_id`, `confirm_production`.
- **Authorized action:** Dispatch only from the default branch and exact clean
  SHA with successful same-SHA quality, database and preview runs. Confirm the
  rollback version is active. After the workflow starts 5%, hold and review the
  approved SLI/security signals; record an owner approval before each existing
  25%, 50% and 100% command.
- **Verification command/check:**

  ```powershell
  gh run view <cloudflare-production-run-id>
  Set-Location infra/cloudflare/sorita-edge
  npx wrangler deployments status --env production --json
  curl.exe --fail-with-body --proto '=https' --tlsv1.2 https://<production-edge-hostname>/health
  ```

- **Expected safe result:** Run IDs resolve to the exact candidate and approved
  workflows; deployment state shows only the recorded previous/candidate split;
  health and approved SLI/security checks pass for each hold. A missing signal is
  `UNVERIFIED`, not approval.
- **Rollback:** Route the recorded previous version to 100% using the command
  emitted by the workflow, verify health and preserve both pre/post deployment
  states. Investigate before a new attempt.
- **Owner:** `OWNER_TBD`.
- **Evidence path:** `artifacts/release-evidence/manual/canary/cloudflare/`.

## 17. EAS Update production canary approvals

- **Current status:** `UNVERIFIED / NO-GO`. The branch workflow defines an
  initial 5% OTA and manual 20%, 50% and 100% stages, but OTA-enabled store
  binary evidence, signing proof, same-SHA runs and hold approvals are absent.
- **Why:** An OTA must be JavaScript-only safe, runtime-compatible, signed and
  targeted only to verified installed binaries.
- **Panel/location:** GitHub Actions → EAS Update Production; protected
  `production` environment reviewers; Expo Dashboard → Channels/Updates;
  observability providers and device evidence.
- **Variable/configuration names only:** `EXPO_TOKEN`,
  `EXPO_PUBLIC_EXPO_PROJECT_ID`, `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `EXPO_PUBLIC_RELEASE_ENVIRONMENT`, `EAS_PRODUCTION_OTA_BINARY_READY`;
  workflow inputs `base_sha`, `preview_run_id`, `quality_run_id`,
  `database_run_id`, `ota_binary_evidence`, `message`, `confirm_production`.
- **Authorized action:** Provide exact OTA-enabled Android/iOS binary evidence,
  prove the base SHA is an ancestor, obtain same-SHA preview/quality/database
  runs, pass the OTA classifier and code-signing/device gates, then dispatch the
  initial 5%. Record an owner approval after each observation hold before the
  existing 20%, 50% and 100% edit commands.
- **Verification command/check:**

  ```powershell
  gh run view <eas-production-run-id>
  eas channel:view production --json
  ```

- **Expected safe result:** One update group is tied to the exact candidate and
  intended runtime/channel; only the approved rollout percentage is active;
  signed updates apply on verified binaries; crash/error/journey signals remain
  within the approved provisional policy during each hold.
- **Rollback:** Stop the active rollout with the workflow-emitted
  `eas update:revert-update-rollout` command, confirm the channel no longer
  advances the candidate and validate devices on the last verified update. A
  native/runtime change requires a new store binary, not an OTA workaround.
- **Owner:** `OWNER_TBD`.
- **Evidence path:** `artifacts/release-evidence/manual/canary/eas-update/`.

## 18. Legacy private-list cover exposure audit and migration

- **Current status:** **`UNVERIFIED / NO-GO` for production mutation**. New
  private-list covers use the private media reference path, but legacy private
  lists may still reference the public `place-media` bucket. The working tree now
  contains an uncommitted authorization migration and a bounded dry-run/apply
  utility with unit tests. They have not passed same-SHA database CI, staging or
  live owner/unrelated access verification. The apply utility removes a public
  source after its copy and conditional reference update; it does not retain the
  source for a post-update live-access observation window. The current source
  deterministically rehomes unsafe legacy paths, rehomes unchanged covers on a
  public-to-private client transition, and adds a database guard for private
  bucket/owner path; external execution evidence is still absent.
- **Why:** A private list cover must not remain publicly retrievable, while an
  unsafe bulk update or early object deletion can break content or lose data.
- **Panel/location:** Supabase staging project → SQL Editor/read-only connection,
  Storage object browser and audit logs; restricted change record.
- **Variable/configuration names only:** `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SORITA_PRIVATE_COVER_MIGRATION_CONFIRM`.
- **Authorized action:** Current authorization is **read-only audit only**. Run
  the SQL count and the utility's default dry run in isolated staging, then in
  production through an approved controlled operator. Before any apply, require
  a database/Storage backup, same-SHA tests, staging copy/update/access/rollback
  evidence and an explicit decision on source-object retention/deletion. Because
  the current utility deletes after update rather than after a live-access hold,
  production apply remains `NO-GO` until a reviewed code change or recovery
  policy resolves that gap. Re-run the unsafe-path and public-to-private
  regression cases against staging before production authorization.
- **Verification command/check:**

  ```sql
  select count(*) as exposed_private_list_cover_count
  from public.lists
  where is_public = false
    and cover_image_url is not null
    and (
      cover_image_url like '%/storage/v1/object/public/place-media/%'
      or cover_image_url like 'sorita-storage://place-media/%'
    );
  ```

  ```powershell
  npm run ops:test
  npm run ops:private-covers:audit -- --max <approved-limit>
  ```

  After a future approved apply, repeat both audits and test the affected objects
  with an owner account and an unrelated/anonymous client. Include legacy paths
  containing encoded spaces and a public list toggled to private without a new
  cover selection.

- **Expected safe result:** The count is zero; owners can load their covers
  through the private path; unrelated and anonymous clients cannot; object and
  database audit counts reconcile. A non-zero count is a release-blocking gap,
  not permission to mutate production ad hoc.
- **Rollback:** The read-only audits need no rollback. The current utility tries
  to restore the original database reference if public-source deletion fails,
  but a successful source deletion is not automatically reversible. Do not run
  production apply without a separately verified Storage-object backup. If
  private access fails, restore the object and original reference from that
  backup through an approved repair, then re-run owner/unrelated access tests.
  If a staging/public-to-private regression ever retains a public reference,
  treat it as an exposure incident, preserve evidence and use the approved
  copy/update cleanup; toggling visibility back is not a privacy-safe rollback by
  itself.
- **Owner:** `OWNER_TBD`.
- **Evidence path:**
  `artifacts/release-evidence/manual/storage/private-list-covers/`.

## 19. Supabase hosted Auth abuse and redirect controls

- **Current status:** **`UNVERIFIED / NO-GO`**. Repository `auth-gateway`
  controls do not protect direct publishable-key requests to Supabase
  `/auth/v1/*`. Local `config.toml` defaults are not evidence of the hosted
  project's Auth settings, plan features or effective limits.
- **Why:** Direct sign-up, sign-in, recovery, verification and token routes need
  provider-side abuse controls. Redirect or email-policy drift can also create
  account-takeover or unintended redirect behavior even when the custom gateway
  is correct.
- **Panel/location:** Supabase Dashboard -> Authentication -> Rate Limits; Bot
  and Abuse Protection; Sign In / Providers; Email; URL Configuration;
  Multi-Factor; Attack Protection and Auth audit logs where available.
- **Variable/configuration names only:** hosted Auth rate-limit setting names,
  CAPTCHA provider/site-key reference, `SITE_URL`, redirect allowlist entries,
  email-confirmation and secure-password-change toggles. Never record CAPTCHA
  secrets, access tokens or user identifiers in evidence.
- **Authorized action:** Export or screenshot the current sanitized settings;
  review sign-in/sign-up, email, OTP, verification and refresh limits against an
  approved traffic model; enable and exercise hCaptcha or Turnstile only with
  the matching existing client flow; verify email confirmation/change and
  recent-login password-change policy; require at least eight characters and
  the reviewed character policy; enable leaked-password protection when the
  hosted plan supports it. Review MFA as an account-protection decision without
  claiming enrollment/enforcement that the existing app does not implement.
  Restrict Site URL and redirects to the exact production web and `sorita://`
  callback/reset targets; remove unused preview/wildcard entries.
- **Verification command/check:** From an isolated staging project, perform a
  bounded approved matrix for valid login, invalid login, repeated login,
  sign-up, recovery, confirmation, password change and every allowed/denied
  redirect. Confirm expected `429`/challenge behavior without enumerating
  accounts. Export sanitized settings and Auth audit/log results from the exact
  candidate test window.
- **Expected safe result:** Direct `/auth/v1` calls are bounded independently of
  the gateway; CAPTCHA-protected flows carry a valid challenge; weak/leaked
  passwords are handled according to the recorded hosted capability; email and
  password changes follow the approved confirmation/reauthentication policy;
  only exact intended redirects succeed. Unsupported plan controls remain an
  explicit accepted risk or a `NO-GO`, never an assumed pass.
- **Rollback:** Restore the exported prior Auth settings. If CAPTCHA causes a
  client lockout, restore the prior toggle while blocking promotion and repair
  the same staging flow before retrying. Do not weaken redirects or disclose a
  provider secret as a rollback shortcut.
- **Owner:** `OWNER_TBD`.
- **Evidence path:**
  `artifacts/release-evidence/manual/supabase/hosted-auth-controls/`.

## 20. Durable media-upload cleanup schedule

- **Current status:** **`UNVERIFIED / NO-GO` for hosted operation**. The
  repository defines `.github/workflows/media-upload-sweeper.yml`, a dry-run
  inventory and a bounded leased cleanup command. No protected environment,
  secret provisioning, successful scheduled run, failure alert or reconciliation
  evidence exists for a hosted project.
- **Why:** Abandoned uploads and late writes must remain eligible for repeated
  cleanup without deleting referenced media. A checked-in schedule alone does
  not prove that cleanup is running or monitored.
- **Panel/location:** GitHub Actions -> Media Upload Session Sweeper; repository
  Environments -> `production`; Supabase Storage, database RPC/logs and the
  approved incident/alert destination.
- **Variable/configuration names only:** `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SORITA_MEDIA_SWEEP_CONFIRM`.
- **Authorized action:** Protect the `production` environment, provision a
  dedicated operational secret through approved storage, run the default manual
  dry-run first, reconcile the eligible count, then approve a bounded manual
  apply in staging. Enable the hourly schedule for production only after
  same-SHA migration, reference-safety and response-loss tests pass. Confirm a
  failed workflow reaches the accountable on-call channel.
- **Verification command/check:**

  ```powershell
  npm run ops:test
  npm run ops:media-uploads:audit -- --limit 100
  gh workflow run media-upload-sweeper.yml -f apply_changes=false
  gh run view <media-sweeper-run-id> --log
  ```

  Exercise staged pending, finalizing, finalized-referenced, retained, late-write
  and failed-cleanup sessions. Run a second sweep after the lease/eligibility
  boundary to prove retry and reconciliation behavior.

- **Expected safe result:** Only eligible unreferenced paths are removed;
  referenced finalized media remains readable; every claimed row records a
  terminal/retryable result; bounded failures make the workflow fail and alert;
  the follow-up inventory reconciles with Storage and ledger counts.
- **Rollback:** Disable the GitHub schedule or revoke the operational secret,
  preserve the failure run, and repair forward from Storage backup/ledger
  evidence. Never bulk-delete paths outside the claim RPC.
- **Owner:** `OWNER_TBD`.
- **Evidence path:**
  `artifacts/release-evidence/manual/storage/media-upload-sweeper/`.

## 21. Push provider credentials, scheduler, receipts and alarms

- **Current status:** **`UNVERIFIED / NO-GO`**. Client/source and isolated DB
  tests passed locally, but FCM/APNs/Expo credential ownership, environment
  parity, hosted scheduler execution, provider ticket/receipt reconciliation,
  invalid-token cleanup and alert delivery are not evidenced.
- **Why:** Source tests cannot prove that production credentials target the
  intended package/bundle/project, that jobs continue running, or that permanent
  provider errors revoke tokens without leaking payload data.
- **Panel/location:** Expo/EAS Credentials; Firebase Console / Google Cloud IAM;
  Apple Developer APNs keys; Supabase staging Functions/Database/Cron; approved
  alert destination and secret manager.
- **Variable/configuration names only:** `EXPO_TOKEN`, FCM V1 service identity
  reference, APNs key reference/team/key IDs, Expo project association,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SYSTEM_BROADCAST_ADMIN_TOKEN`. Never record key files, token values, device
  tokens, cleanup secrets or payload bodies.
- **Authorized action:** On isolated staging, verify package/bundle/project and
  APNs sandbox/production parity; install credentials through the provider's
  approved secret path; apply the reviewed migration; confirm `pg_cron` or
  provision one least-privilege external scheduler; send only bounded synthetic
  messages to approved test devices; reconcile tickets/receipts; prove permanent
  invalid-token cleanup, transient retry, DLQ, pause/resume and alert delivery.
  Keep broadcast dry-run and explicit audience guards enabled. Do not perform a
  production bulk send for verification.
- **Verification command/check:**

  ```powershell
  eas credentials --platform android
  eas credentials --platform ios
  npm run ops:push-delivery:health
  npm run ops:push-delivery:requeue -- requeue --dead-letter-id <staging-uuid> --requeue-key <stable-uuid> --confirm REQUEUE_PUSH_DELIVERY_DLQ
  ```

  Run the scenarios in
  [`push-real-device-matrix.md`](./push-real-device-matrix.md) on the exact
  Android/iOS candidate. Sanitize all provider output before retention.

- **Expected safe result:** Credential metadata matches the intended
  app/environment; scheduler health is current; bounded synthetic sends produce
  correlated ticket and receipt outcomes; a transient error retries within the
  bounded policy; an unregistered token is revoked; a terminal job reaches a
  redacted DLQ record and alerts the accountable owner; no secret/token/payload
  appears in logs or evidence.
- **Rollback:** Pause the scheduler/broadcast path, revoke the newly introduced
  credential if compromised, restore the prior approved credential reference,
  keep DLQ rows for audit and confirm core mutations continue without push.
  Never blindly requeue the full backlog.
- **Owner:** `OWNER_TBD`.
- **Evidence path:**
  `artifacts/release-evidence/manual/push/provider-scheduler-receipts/`.

## Final external gate

Production and store release remain `NO-GO` until every applicable section has:

- sanitized evidence from the exact immutable candidate;
- a named accountable owner replacing `OWNER_TBD` in the external approval
  record (not fabricated in repository documentation);
- a successful verification result and exercised rollback where safe;
- no unresolved critical `UNVERIFIED` dependency;
- linkage in the signed release evidence packet described by
  [`docs/release-readiness.md`](./release-readiness.md).

Official operational references:

- [Cloudflare Worker custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Cloudflare Wrangler Worker commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
- [Supabase Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Supabase Auth CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha)
- [Supabase Auth redirects](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase password security](https://supabase.com/docs/guides/auth/password-security)
- [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/)
- [EAS Update](https://docs.expo.dev/build/updates/)
- [Expo application credentials](https://docs.expo.dev/app-signing/app-credentials/)
- [Expo credential security](https://docs.expo.dev/app-signing/security/)
- [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/)
- [Google Play internal testing](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en)
- [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
