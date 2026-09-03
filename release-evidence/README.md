# Release evidence contract

This directory defines the evidence format; it does not contain a release attestation. A production
attestation is generated under ignored `artifacts/release-evidence/` by CI only after checking out an
immutable commit with a clean tree.

Generate a manifest by listing every retained command log or signed artifact explicitly:

```bash
node utils/release-evidence/manifest.mjs create \
  --manifest artifacts/release-evidence/manifest.json \
  --artifact artifacts/release-evidence/quality.log \
  --result quality=pass \
  --result database-local=pass \
  --result docker-validation=pass \
  --result feature-surface=pass \
  --result evidence-tool=pass \
  --result sast-secret-scan=pass \
  --result cloudflare-preview=unverified \
  --result signed-android-ios=unverified \
  --result ota-code-signing=unverified \
  --result physical-device-matrix=unverified \
  --result provider-dashboards=unverified \
  --result staging-restore=unverified \
  --result store-internal-tracks=unverified \
  --result ota-preview-rollback=unverified \
  --result backup-pitr=unverified \
  --result observability-alerts=unverified \
  --result security-review=unverified \
  --environment preview \
  --channel preview \
  --runtime-version 1.0.102
```

Verify the same files against the current clean commit:

```bash
node utils/release-evidence/manifest.mjs verify \
  --manifest artifacts/release-evidence/manifest.json
```

The generator deliberately has no dirty-tree override. A test file, dashboard screenshot, device
recording, signed binary, database restore log, or rollout report is release evidence only when it is
listed in the manifest and its checksum still matches. Missing provider/device/store evidence remains
`UNVERIFIED` and keeps production at `NO-GO`.

Schema v2 requires every named release check, including Docker validation and OTA code signing, even
when its honest state is `unverified`. `manifest.mjs` compiles
[`manifest.schema.json`](./manifest.schema.json) with Ajv and then applies the repository/SHA/file
checksum checks. The verifier rejects schema violations, missing or unknown checks, any non-`pass`
state, and artifact paths outside the repository.

## Partial and final workflow artifacts

`Release Evidence` has two fail-closed modes:

- with an empty `runtime_evidence_run_id`, it uploads
  `partial-release-evidence-<sha>` and proves that the production verifier rejects the packet;
- with a numeric `runtime_evidence_run_id`, it accepts only a successful
  `.github/workflows/runtime-evidence.yml` run from the same repository, exact candidate SHA, and
  `workflow_dispatch` event. It downloads exactly one `runtime-evidence-<sha>` artifact, compares
  the downloaded archive with GitHub's SHA-256 artifact digest, verifies the inner manifest,
  receipts, identities, freshness, file sizes, and checksums, and only then uploads
  `final-release-evidence-<sha>`.

Production Cloudflare and EAS workflows accept only the `final-release-evidence-<sha>` artifact.
The partial artifact therefore cannot become a deployment approval by changing a dispatch string.

## Provider and physical-device trust boundary

`Provider and Device Runtime Evidence` runs only on a runner labelled
`self-hosted`, `macOS`, and `sorita-runtime-evidence`, behind the protected
`production-evidence` environment. The dispatcher can supply only the candidate SHA and runtime
version; there is no result/status input.

The protected runner's probe harness writes one fresh JSON receipt per check below
`$RUNTIME_EVIDENCE_SOURCE_ROOT/<candidate-sha>/`. The workflow never copies that directory as an
opaque archive. Instead, `runtime-evidence.mjs stage` reads the eleven exact receipt names,
validates them against [`runtime-receipt.schema.json`](./runtime-receipt.schema.json), requires the
fixed probe ID and subject matrix, rejects stale (>72 hours), mismatched, oversized, symlinked,
duplicate, or extra-shaped data, and rewrites only canonical sanitized JSON. It then creates a
[`runtime-manifest.schema.json`](./runtime-manifest.schema.json) packet bound to the current GitHub
run ID and attempt.

The required probe subjects include both physical platforms, both store tracks, signed EAS builds,
the OTA certificate, Cloudflare preview, staging restore, backup/restore, preview rollback on both
devices, Cloudflare/EAS/Supabase/Sentry control planes, alert delivery, and the security report.
Screenshots, free-form operator notes, a user-supplied `pass`, a packet from another workflow, or a
same-name artifact from another run are not accepted.

Until the protected runner/harness produces all fresh receipts for the same candidate, only the
partial NO-GO artifact can exist. This is intentional: repository automation does not invent
provider or physical-device proof.
