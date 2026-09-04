# ADR 0004: Native Source of Truth

Status: accepted

## Context

The repository contains Android native sources while Expo configuration also defines runtime and native-adjacent settings. Treating both generated config and checked-in native files as equally authoritative creates drift risk, especially around package identity, signing, permissions, edge-to-edge behavior, and native module linkage.

## Decision

Use the checked-in native project as the authoritative source for native behavior.

- `android/` changes are reviewed as production source changes.
- `app.config.ts` remains the source for Expo runtime metadata and values consumed by Expo tooling.
- Config-plugin expectations must be mirrored deliberately into native files when the native project is checked in.
- Package name, bundle identifier, scheme, versioning, and signing-related files stay under release-owner control and require explicit review evidence.
- Clean prebuild output can be used as a drift signal, but it is not allowed to overwrite native source without review.

## Consequences

- Expo SDK/package alignment must be done in an isolated maintenance change with `expo-doctor`, `expo install --check`, TypeScript, security, and device smoke evidence.
- Native permission, manifest, Gradle, and dependency changes are release-affecting even when initiated from JS package upgrades.
- iOS native source remains a separate release task if the project moves from managed/EAS-only iOS builds to checked-in iOS sources.

## Current State

The source-of-truth decision is now explicit. Package patch alignment, clean Android/iOS build evidence, and physical-device verification remain release gates.

## Expo Doctor's `appConfigFieldsNotSyncedCheck`

That check is disabled in `package.json`. It exists to warn when `app.config.ts`
diverges from a native project Expo expects to regenerate, and under this ADR
the native project is authoritative and deliberately *does* diverge — so the
check reports intentional decisions as failures and trains the reader to ignore
it.

Disabling it, however, removed the only automated comparison between the Expo
config and the native project. `utils/guards/check-native-config-parity.mjs`
replaces it with a narrower and more accurate one, run as `native-parity:check`
in the `lint` chain. It fails when:

- `android.package` disagrees with the Gradle `applicationId` or `namespace`;
- `version` disagrees with `versionName`, or `android.versionCode` with
  `versionCode`;
- `ios.bundleIdentifier` drifts away from `android.package`, splitting the app's
  identity across platforms;
- the deep link scheme in `app.config.ts` is not registered in
  `AndroidManifest.xml`, which would make advertised links silently fail to open
  the app.

It deliberately does not diff everything Expo would regenerate. Under this ADR
most of that divergence is the decision, not a defect; a guard that flags
intended state is a guard people switch off.

Each of the three failure paths above was verified by introducing the drift and
confirming the guard goes red.
