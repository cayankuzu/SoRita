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
