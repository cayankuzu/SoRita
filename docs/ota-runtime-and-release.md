# SoRita OTA Runtime And Release Contract

Last repository verification: 2026-08-30. This document describes the checked-in contract; it is
not evidence that any provider-side build, update, channel, secret, or deployment exists.

> **Production OTA release: NO-GO.** Do not publish to the production channel until every
> `UNVERIFIED` item in the evidence gate below is replaced by retained, reviewer-approved evidence.

## Checked-in runtime contract

| Concern | Repository contract |
| --- | --- |
| App/runtime version | Expo app version `1.0.101`; `runtimeVersion.policy` is `appVersion`. |
| Update URL | Derived only as `https://u.expo.dev/<EXPO_PUBLIC_EXPO_PROJECT_ID>`. Production config fails closed when the project ID is absent or malformed. |
| Launch behavior | Updates are checked on load with zero launch wait. The cached or embedded update starts immediately; a newly downloaded update normally applies on the next cold start. |
| Embedded fallback | `useEmbeddedUpdate` is enabled. This is a fallback mechanism, not proof that a remote rollback has been tested. |
| Android native parity | `expo-updates` is enabled and the committed manifest references the checked-in update URL and runtime string resources. |
| iOS native parity | `app.config.ts` is the prebuild/EAS source of truth. There is no checked-in `ios/` project, so the resulting signed iOS binary must be inspected and tested before release. |
| Build channels | `development`, `preview`, and `production` EAS profiles use matching, isolated channel and EAS environment names. A channel is embedded in its binary and cannot be changed after that binary is built. |
| Update code signing | No verified update-signing certificate/private-key chain is claimed. Never add `--private-key-path` to an update command until a matching public certificate has been embedded in new binaries and the signing ceremony is evidenced. |

The app-version policy is intentionally simple: a native-runtime change requires an app-version
change and new Android and iOS binaries. Changing a build number alone does not create a new OTA
runtime. Forgetting to change the app version after a native change can make an incompatible bundle
look compatible, so the classifier and binary-source evidence remain mandatory.

## First OTA-capable binary is mandatory

No OTA update can safely precede the binaries that contain its update URL, runtime, channel, and
embedded fallback. Before the first preview or production OTA for runtime `1.0.101`, retain all of:

1. One immutable binary source SHA.
2. An OTA-enabled Android build ID and signed AAB/installable artifact produced from that SHA.
3. An OTA-enabled iOS build ID and signed IPA/TestFlight artifact produced from that same SHA.
4. Inspection evidence showing runtime `1.0.101`, the expected EAS project, and the intended channel
   in each artifact.
5. Real-device evidence that the embedded update starts offline, an update downloads, and the new
   update applies after a cold restart on both platforms.

The workflows bind this evidence to the native baseline using this exact non-secret format:

```text
android=<build-id>;ios=<build-id>;runtime=1.0.101;source=<40-character-binary-source-sha>
```

The complete value must match the environment-scoped approval secret:

- Preview: `EAS_PREVIEW_OTA_BINARY_READY`
- Production: `EAS_PRODUCTION_OTA_BINARY_READY`

This secret gate records an approval; it does not independently prove that the provider artifact is
valid. Keep the artifact inspection report and device evidence with the release record.

## OTA change classifier

Run the classifier against the OTA-enabled binary source SHA, not merely the previous OTA commit:

```bash
npm run ota:classify -- --base <BINARY_SOURCE_SHA> --head <TARGET_SHA>
```

Standard output is exactly one of these values:

| Result | Meaning and required action |
| --- | --- |
| `OTA_SAFE` | The range contains approved JavaScript/TypeScript/runtime-asset changes, optionally with tests. It is the only result that either update workflow accepts. |
| `NATIVE_BUILD_REQUIRED` | The range touches native projects, app/EAS/Metro/Babel/native config, dependencies or lockfiles, config plugins, permissions/entitlements, signing material, or native assets. Change the app version as required, build both platforms, and establish a new binary source SHA. Do not publish OTA. |
| `MANUAL_REVIEW_REQUIRED` | The range is empty, test-only, backend/infra/docs/tooling-only, malformed, or contains an unknown surface. The classifier fails closed. A reviewer may choose a non-OTA release path, but cannot override the update workflows into publishing. |

Mixed ranges use the most restrictive result: any native change requires a binary; otherwise any
unknown change requires manual review.

## Release sequence

### 1. Establish the native baseline

From the immutable binary source SHA:

1. Run `npm ci --ignore-scripts` and `npm run check:release`.
2. Build Android and iOS with the intended EAS build profile only after signing credentials and
   provider ownership are approved.
3. Inspect both artifacts and perform the embedded/offline/update/cold-start device checks.
4. Store the evidence string above in the matching GitHub environment secret. Production must use a
   protected GitHub environment with required reviewers.

Never reuse evidence after the app version, native code, native dependency, permission, config
plugin, channel, update certificate, or binary source SHA changes.

### 2. Publish and verify preview

Manually dispatch `.github/workflows/eas-update-preview.yml` from the target ref with:

- `base_sha`: the approved binary source SHA;
- `ota_binary_evidence`: the approved evidence string;
- `message`: a one-line release note.

The workflow checks out `github.sha`, proves the base is its ancestor, requires the evidence secret,
requires `OTA_SAFE`, runs the complete release quality gate, and only then publishes with
`--channel preview --environment preview`. Record its successful workflow run ID and EAS update
group ID.

On OTA-enabled Android and iOS preview binaries from the same runtime, retain evidence for:

- embedded launch while offline;
- background download without replacing the running bundle;
- application of the update after a full cold restart;
- cold/warm/foreground/background recovery and critical user flows;
- update/runtime identity, crash-free sessions, API errors, latency, and media/auth behavior.

### 3. Approve the exact same SHA for production

Manually dispatch `.github/workflows/eas-update-production.yml` from the repository default branch.
Provide the same binary source SHA, the successful preview run ID, the production-approved binary
evidence, a release note, and explicit production confirmation.

The protected production job queries GitHub for the referenced preview run and requires all of:

- completed with `success`;
- the preview workflow's exact workflow ID;
- the same repository;
- the same `github.sha` as the production run.

It then repeats classification and the complete release gate. No branch rebuild, manually entered
target SHA, or unverified preview claim can substitute for this check.

### 4. Canary 5 -> 20 -> 50 -> 100

The production workflow uses EAS CLI's supported per-update rollout flag and publishes the verified
group to 5%:

```bash
eas update --channel production --environment production --platform all \
  --rollout-percentage 5 --message "<RELEASE_NOTE> [sha:<TARGET_SHA>]" \
  --json --non-interactive
```

The workflow does not advance later stages. After each approved observation window, inspect the EAS
group/channel dashboards and the product SLOs, then run exactly one next step:

```bash
eas update:edit <GROUP_ID> --rollout-percentage 20 --non-interactive
eas update:edit <GROUP_ID> --rollout-percentage 50 --non-interactive
eas update:edit <GROUP_ID> --rollout-percentage 100 --non-interactive
```

Before every increase, retain Android and iOS sample counts and confirm crash-free sessions remain
at least 99.8%, no critical error-budget burn exists, feed p95 is below 1.5 seconds, mutation p95 is
below 2 seconds, upload success is above 98%, and auth/media/edge error rates show no regression.
Stop on missing data; absence of evidence is not a pass. Use
[`ota-rollback-runbook.md`](./ota-rollback-runbook.md) for containment.

## Evidence gate

| Evidence | Status on 2026-08-30 | Release effect |
| --- | --- | --- |
| Local app/runtime/native parity tests | Verified locally | Necessary, not sufficient. |
| Local classifier and workflow-contract tests | Verified locally | Necessary, not sufficient. |
| EAS project ownership, channel-to-branch mapping, and environment variables in provider UI | **UNVERIFIED** | **NO-GO** |
| Protected GitHub production environment, required reviewers, and scoped secrets | **UNVERIFIED** | **NO-GO** |
| OTA-enabled Android and iOS provider build records from one source SHA | **UNVERIFIED** | **NO-GO** |
| Signed AAB/IPA provenance, signature verification, and retained artifact hashes | **UNVERIFIED** | **NO-GO** |
| EAS Update code-signing certificate embedded in both binaries and secure private-key ceremony | **UNVERIFIED / not claimed** | **NO-GO for claiming signed OTA artifacts** |
| Preview update group and exact same-SHA production approval | **UNVERIFIED** | **NO-GO** |
| Physical Android/iOS embedded, offline, download, cold-start, and rollback evidence | **UNVERIFIED** | **NO-GO** |
| EAS, store, Sentry, Supabase, and Cloudflare dashboards/alerts | **UNVERIFIED** | **NO-GO** |
| Deployed Cloudflare production version/routes/bindings/secrets and stable API hostname | **UNVERIFIED** | **NO-GO** |

## Authoritative references

- [Expo: runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)
- [Expo: deploy updates and gradual rollouts](https://docs.expo.dev/eas-update/deployment/)
- [Expo: rollouts](https://docs.expo.dev/eas-update/rollouts/)
- [Expo: SDK 55 EAS environment variables](https://docs.expo.dev/eas/environment-variables/usage/)
- [Expo: update code signing](https://docs.expo.dev/eas-update/code-signing/)
- [Expo: CLI reference](https://docs.expo.dev/eas/cli/)
