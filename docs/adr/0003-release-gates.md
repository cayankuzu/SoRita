# ADR 0003: Release Gates

Status: accepted

## Context

The app needs repeatable proof before store release. Passing unit tests alone is not enough for a social app with media, privacy, native signing, and database migrations.

## Decision

Release candidates require:

- Architecture guard, TypeScript, unit/integration tests, security tests.
- High/critical production dependency audit gate.
- Secret scanning and SBOM generation in CI.
- Coverage at the configured global threshold.
- Supabase fresh/upgrade/drift/RLS evidence.
- Android/iOS release build evidence with existing credentials.
- Physical device, accessibility, load, SLO, and store privacy evidence.

## Consequences

- Some gates are code-enforced in CI.
- External gates remain manual until connected accounts and staging infrastructure are available.
- A release can be functionally improved but still remain NO-GO until evidence is complete.
