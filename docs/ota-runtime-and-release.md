# SoRita OTA Runtime And Release Contract

Last repository verification: 2026-09-17.

JavaScript, TypeScript and runtime-asset changes reach installed apps through EAS Update on the
`production` channel, without a new AAB or IPA. Native changes still need store binaries. This
document is the operating contract for both paths; `quality/ota-binaries.json` is the source of truth
for which installed binaries an update can reach.

## Checked-in runtime contract

| Concern | Repository contract |
| --- | --- |
| Runtime version | `app.config.ts` sets `runtimeVersion` to the literal app `version`. EAS Update refuses runtime policies (such as `appVersion`) in this bare project, so the value is explicit and `npm run native-parity:check` keeps it equal to `version`. An update reaches only binaries whose embedded runtime equals it. |
| Update URL | `https://u.expo.dev/<EXPO_PUBLIC_EXPO_PROJECT_ID>`. Production config fails closed without a valid project ID. |
| Launch behavior | Checked on every launch with zero wait. A downloaded update runs on the next cold start; the cached or embedded update is the fallback. |
| Android parity | `strings.xml` `expo_runtime_version` must equal `versionName`. `npm run native-parity:check` and the Gradle `verifyExpoRuntimeVersion` task (a dependency of every release bundle/assemble task) both fail otherwise. |
| iOS parity | `app.config.ts` is the source of truth for EAS iOS builds; `npm run ota:record-binary` reads the channel and runtime EAS recorded for the build. |
| Channels | `development`, `preview` and `production` EAS profiles use matching channel and EAS environment names. A channel is fixed inside a binary. |
| Environment | Store builds and updates both read the EAS `production` environment, so the public config inside an update matches the binary it lands on. |
| Update code signing | **Not used.** EAS Update code signing is unavailable on the account's current plan. Updates are served over HTTPS by Expo; their integrity rests on the security of the Expo account. See [Code signing decision](#code-signing-decision). |

## Ship a JavaScript change (no store build)

1. Commit the change on `main` and push it.
2. Run:

   ```bash
   npm run ota:publish -- --message "<one-line release note>"
   ```

   Options: `--platform android|ios` (default both), `--rollout <1-100>` (default 100),
   `--dry-run` (run every gate, print the `eas update` command, publish nothing).

`utils/eas/publish-ota.mjs` refuses to publish unless all of these hold:

- the working tree is clean, the branch is `main` and `HEAD` equals `origin/main`;
- each target platform has a binary recorded in `quality/ota-binaries.json` whose runtime equals the
  current app version (otherwise the update would reach nobody);
- the recorded binary commit is an ancestor of `HEAD` and the classifier reports `OTA_SAFE` for
  `binary commit...HEAD`;
- `eas whoami` succeeds and `npm run check:release` passes.

It then publishes one update group with `--channel production --environment production`, verifies
that EAS returned exactly one group for the expected platforms and runtime, and prints the group ID
with the rollout-widening or rollback command. Users download the update on their next app start and
run it on the start after that.

If backend files under `supabase/` or `infra/` changed in the same range, the publisher lists them:
deploy the backend first so the new JavaScript never calls a contract that is not live yet.

## Ship a native change (store build required)

Anything the classifier reports as `NATIVE_BUILD_REQUIRED` (dependencies, `app.config.ts`,
`android/`, config plugins, permissions, native assets) must ship in new binaries:

1. Raise `version` in `package.json`, `version` and `runtimeVersion` in `app.config.ts`, `versionName` and `versionCode` in
   `android/app/build.gradle`, `expo_runtime_version` in `strings.xml`, and `ios.buildNumber`.
   Raising the version gives the new binaries a new runtime, so updates for the old JavaScript can
   never reach the new native code and the reverse.
2. Run `npm run check:release`, commit and push.
3. Build from that commit:
   - Android (Git Bash on Windows; `eas env:exec` runs its command through `cmd`, so set variables
     on the outer process):

     ```bash
     env -u SENTRY_AUTH_TOKEN EXPO_PUBLIC_RELEASE_ENVIRONMENT=production \
       eas env:exec production "android\\gradlew.bat -p android :app:bundleRelease" --non-interactive
     ```

     The bundle is written to `C:/t/sorita-gradle-build/app/outputs/bundle/release/app-release.aab`,
     and the build uploads its source maps to Sentry. EAS `Secret` variables never reach
     `eas env:exec`, so the upload authenticates with `SENTRY_AUTH_TOKEN` from the local `.env`.
     `env -u` stops any machine-wide `SENTRY_AUTH_TOKEN` from shadowing it: sentry-cli does not let
     `.env` override a variable that is already set, and a stale machine-wide token fails with HTTP 401.
   - iOS: `eas build --platform ios --profile production --non-interactive`.
4. Record each binary; the recorder inspects the real artifact and refuses a wrong runtime, channel
   or EAS project:

   ```bash
   npm run ota:record-binary -- --platform android --aab <app-release.aab> --source-sha <commit>
   npm run ota:record-binary -- --platform ios --eas-build-id <build-id>
   ```

5. Commit and push `quality/ota-binaries.json`, then upload/submit the binaries to the stores.

Users who have not installed the new store version keep their old runtime and receive no further
updates until they update from the store.

## OTA change classifier

```bash
npm run ota:classify -- --base <BINARY_SOURCE_SHA> --head <TARGET_SHA>
```

| Result | Meaning |
| --- | --- |
| `OTA_SAFE` | At least one runtime file (`App.tsx`, `index.js`, `src/**` code or assets, `assets/runtime/**`) changed and nothing native or unknown did. Tests, docs, root Markdown, `.github/`, `supabase/`, `infra/`, `utils/`, `quality/` and other non-shipping paths may change alongside. |
| `NATIVE_BUILD_REQUIRED` | Native projects, app/EAS/Metro/Babel config, dependencies or lockfiles, plugins, permissions, signing material or native assets changed. A `package.json` change counts as non-shipping only when the range proves that nothing but `scripts` differs. |
| `MANUAL_REVIEW_REQUIRED` | Nothing app-facing changed, a path is malformed, or a path matches no known surface. The publisher refuses it. |

Mixed ranges take the most restrictive result.

## Code signing decision

On 2026-09-17 the owner directed that JavaScript changes ship over the air on the current plan.
Consequences that remain true until a plan with EAS Update code signing is adopted:

- Updates are not end-to-end signed. Anyone who controls the Expo account can publish code to
  installed apps, so the account needs strong authentication and no long-lived `EXPO_TOKEN` should
  exist outside the owner's machine.
- `.github/workflows/eas-update-preview.yml` and `eas-update-production.yml` remain the signed,
  evidence-gated path. They still require `utils/eas/check-update-code-signing.mjs` to pass and
  therefore cannot publish on the current plan; they are not the operating path.
- Adopting code signing later requires new binaries that embed the public certificate.

## Verification record

2026-09-17, Android emulator (API 30, x86), release APK built from `8f49266` with channel `preview`
and runtime `1.0.107`, published from `8add24a` with the publisher's own argument builder and output
check:

| Step | Observed |
| --- | --- |
| Before publishing | Embedded bundle launched; the update server answered 404 for the missing `preview` channel. |
| Publish | Group `dc52e48c-1e38-4f7f-8ba9-3b0720590c40`, Android update `01a0ad06-ae69-7830-ab38-864ec52db256`, runtime `1.0.107`. |
| Next launch | `CheckCompleteAvailable` → `Download` → `DownloadComplete` with the update pending. |
| Following cold launch | `CheckCompleteUnavailable`, no crash, sign-in screen rendered. |
| `update:roll-back-to-embedded` | Directive group `ffba4bee-ab98-434d-9502-dbe88e913f37` received on the next launch, no crash. |

The first attempt exposed that `eas update` rejects runtime policies in this bare project, which is
why `runtimeVersion` is now explicit. Not yet evidenced: iOS delivery, a physical device, and a
production-channel update.

## Rollback

Use [`ota-rollback-runbook.md`](./ota-rollback-runbook.md). The publisher prints the exact command for
the group it created.

## Authoritative references

- [Expo: runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)
- [Expo: deploy updates and gradual rollouts](https://docs.expo.dev/eas-update/deployment/)
- [Expo: rollouts](https://docs.expo.dev/eas-update/rollouts/)
- [Expo: SDK 55 EAS environment variables](https://docs.expo.dev/eas/environment-variables/usage/)
- [Expo: update code signing](https://docs.expo.dev/eas-update/code-signing/)
- [Expo: CLI reference](https://docs.expo.dev/eas/cli/)
