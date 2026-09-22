# SoRita OTA Runtime And Release Contract

Last repository verification: 2026-09-17.

JavaScript, TypeScript and runtime-asset changes reach installed apps through EAS Update on the
`production` channel, without a new AAB or IPA. Native changes still need store binaries. This
document is the operating contract for both paths; `quality/ota-binaries.json` is the source of truth
for which installed binaries an update can reach.

## Checked-in runtime contract

| Concern | Repository contract |
| --- | --- |
| Runtime version | `app.config.ts` declares `const nativeRuntimeVersion` and sets `runtimeVersion` from it. EAS Update refuses runtime policies (such as `appVersion`) in this bare project, so the value is an explicit literal. It describes the native surface, **not** the release: it stays put across JavaScript-only releases, because an update reaches only binaries whose embedded runtime equals it. |
| Update URL | `https://u.expo.dev/<EXPO_PUBLIC_EXPO_PROJECT_ID>`. Production config fails closed without a valid project ID. |
| Launch behavior | Checked on every launch with zero wait. A downloaded update runs on the next cold start; the cached or embedded update is the fallback. |
| Android parity | `strings.xml` `expo_runtime_version` must equal `app.config.ts` `nativeRuntimeVersion`. `npm run native-parity:check` and the Gradle `verifyExpoRuntimeVersion` task (a dependency of every release bundle/assemble task) both fail otherwise. |
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

1. Raise `version` in `package.json` and `app.config.ts`, `versionName` and `versionCode` in
   `android/app/build.gradle`, and `ios.buildNumber`.

   **Leave `nativeRuntimeVersion` alone unless the native surface actually changed.** The runtime
   string is the contract between a binary and an update: an update reaches only the binaries that
   embed the same one. This step used to say to raise it with the version, and that is what stranded
   the installed base on 2026-09-21 — Play was serving 1.0.108, which embeds runtime 1.0.108, while
   updates went to 1.0.109, so every store user was told there was no update. Raise it only when the
   new binaries genuinely cannot run the old JavaScript (a new or removed native module, a changed
   native config), and when you do, raise it in `app.config.ts` and `strings.xml` together and
   rebuild every platform before publishing again.
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

This only cuts anybody off when the runtime actually moved. If the release kept
`nativeRuntimeVersion` — which is the normal case — the old and new binaries share a runtime and
both keep receiving updates. When the runtime does move, users who have not installed the new store
version keep the old one and receive no further updates until they update from the store, so publish
for the runtime that is still in the field until the new build has rolled out.

## Turning OTA on for iOS

Android receives updates today; iOS does not, and the reason is not
configuration. The App Store build is 1.0.102 (build 87, EAS build
`012be71b-b694-4e9b-98ca-42995aa0b575`) and it embeds runtime **1.0.102**. Since
the commit it was built from (`b347f7f`) the JavaScript has come to depend on
native modules that binary does not contain:

| Package | Then | Now |
| --- | --- | --- |
| `expo-application` | absent | `~55.0.19` |
| `expo-localization` | absent | `~55.0.19` |
| `posthog-react-native` | absent | `^4.71.0` |
| `@react-native-firebase/app` / `messaging` | `^25.1.0` | `26.4.0` |

`npm run ota:classify -- --base b347f7f2ff91becec0db97f83088c017d6e7d1ed --head HEAD`
returns `NATIVE_BUILD_REQUIRED`, and that verdict is correct: an update published
for runtime 1.0.102 would launch JavaScript that calls into modules the binary
never linked. **Do not publish for 1.0.102.** iOS needs one store build to catch
up, after which both platforms sit on the same runtime and a single publish
serves them together.

1. Build and submit from a commit whose `nativeRuntimeVersion` is the shared
   runtime (currently `1.0.108`). Everything else is already in place: the
   production profile carries `channel: production`, and `ios.privacyManifests`,
   the Info.plist strings and the associated domain are declared in
   `app.config.ts`.

   ```bash
   eas build --platform ios --profile production --non-interactive
   eas submit --platform ios --profile production --latest
   ```

2. Record the finished build. The recorder reads the channel and runtime EAS
   itself stored for it and refuses a build that is not a production store build
   on the expected runtime:

   ```bash
   npm run ota:record-binary -- --platform ios --eas-build-id <BUILD_ID>
   ```

3. Commit `quality/ota-binaries.json`. From then on `npm run ota:publish`
   publishes to both platforms in one group; until then iOS must be left out
   with `--platform android`.

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
why the runtime is an explicit literal.

2026-09-21, physical device (Redmi Note 9 Pro, Android 10), the **Play-installed** build 1.0.108
(versionCode 114, installer `com.android.vending`) on the production channel:

| Step | Observed |
| --- | --- |
| Embedded runtime, read from the store APK | `aapt2 dump resources` → `string/expo_runtime_version = "1.0.108"`, channel `production`. |
| Before the fix | `dev.expo.updates` logged `onBackgroundUpdateFinished: No update available` — the repository was publishing for runtime 1.0.109. |
| Publish for 1.0.108 | Group `3735c414-87fd-4eb5-b088-3859720a6c01`, Android update `01a0c59d-0fd0-7d1f-8c98-e763c6de7046`, 100%. |
| Next launch | `onBackgroundUpdateFinished: Update available` → `DownloadComplete`, `isUpdatePending=true`, manifest `runtimeVersion "1.0.108"`. |
| Following cold launch | New bundle running: the map preview renders its Google attribution uncropped and tab labels hold the 1.3x chrome cap at 1.5x system font scale. |

This is the first evidenced production-channel delivery to a physical, store-installed device. Still
not evidenced: iOS delivery.

2026-09-22, same device and build, second production delivery (the touch-target fix):

| Step | Observed |
| --- | --- |
| Classify | `OTA_SAFE` for `53d8d90...HEAD`; the `package.json` change is `scripts` only. |
| Publish | Group `cb294ec6-3a66-4259-9417-d7a540469db7`, Android update `01a0c5ee-c179-762d-b143-caf1ce1297b9`, runtime `1.0.108`, 100%. |
| Next launch | `onBackgroundUpdateFinished: Update available` → `DownloadComplete`, `downloadProgress=1.0`, `isUpdatePending=true`, manifest runtime `1.0.108`. |

Two consecutive deliveries on the corrected runtime confirm the 1.0.108 contract holds rather than
having worked once.

2026-09-22, third delivery, the design-system consolidation:

| Step | Observed |
| --- | --- |
| Publish | Group `cf19978d-f42e-49aa-88d7-27b811b918b4`, Android update `01a0c6c6-5df2-790c-98cd-87e2f9d96372`, runtime `1.0.108`, 100%. `check:release` passed inside the publisher. |
| Next launch | `CheckCompleteAvailable` → `Download` → `DownloadComplete`. |
| Following cold launch | New bundle running, and the feed renders **pixel-identical** to the pre-refactor capture — which is the point: `spacing.card` and `spacing.md` are both 10, so replacing 21 raw paddings had to change nothing on screen, and on hardware it did not. |

2026-09-22, fourth delivery, the content error boundary:

| Step | Observed |
| --- | --- |
| Publish | Group `7c991ea1-2117-4dbc-b66e-0b8c7cf45b55`, Android update `01a0c6de-a2e5-7753-bf5a-a0488a488f84`, runtime `1.0.108`, 100%. |
| Next launch | `Download` → `DownloadComplete`. |
| Following cold launch | New bundle running, feed unchanged — correct, because a boundary is invisible until something throws. |

Four consecutive production deliveries on runtime 1.0.108, all verified on the store-installed handset.

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
