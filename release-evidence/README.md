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
  --runtime-version 1.0.106
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
  detached Ed25519 signatures, receipts, identities, freshness, file sizes, and checksums, and only then uploads
  `final-release-evidence-<sha>`.

Production Cloudflare and EAS workflows accept only the `final-release-evidence-<sha>` artifact.
The partial artifact therefore cannot become a deployment approval by changing a dispatch string.

## Provider and physical-device trust boundary

`Provider and Device Runtime Evidence` runs only on a runner labelled
`self-hosted`, `macOS`, and `sorita-runtime-evidence`, behind the protected
`production-evidence` environment. The dispatcher can supply only the candidate SHA and runtime
version; there is no result/status input.

The external probe harness writes one fresh canonical JSON receipt and one sibling detached
signature per check below `$RUNTIME_EVIDENCE_SOURCE_ROOT/<candidate-sha>/`: `<check>.json` and
`<check>.sig`. Receipt schema v3 records the real external producer `id`, semantic `version`, source
tree SHA-256, executed artifact SHA-256, immutable HTTPS build-provenance URI, unique execution ID,
and signing-key ID. It no longer misidentifies the repository validator as the probe source.

The harness serializes the receipt with the RFC 8785 JSON Canonicalization Scheme rules (object keys
sorted by UTF-16 code units, ECMAScript JSON primitive serialization, no insignificant whitespace or
trailing newline). It signs these exact bytes with Ed25519 after the binary domain separator
`sorita-runtime-evidence-receipt-v3` followed by one NUL byte. The `.sig` file is the canonical
base64 encoding of the 64-byte detached signature followed by one LF. The signed receipt contains
the byte count and SHA-256 of every raw scenario artifact, so a valid signature binds the parsed JSON
semantics and the retained raw evidence bytes.

The private signing key is not a repository file, GitHub secret, workflow environment value, or
credential available to the Actions runner identity. A separately administered harness identity
must run the probes and sign through protected OS/KMS/Secure Enclave storage. It alone has write
access to the source directory; the `sorita-runtime-evidence` Actions account has read-only access and
cannot invoke the signer as an oracle. The protected `production-evidence` GitHub environment holds
only `RUNTIME_EVIDENCE_SOURCE_ROOT`, the public
`RUNTIME_EVIDENCE_ED25519_PUBLIC_KEY_SPKI_BASE64`, and
`RUNTIME_EVIDENCE_EXPECTED_KEY_ID` (`sha256:<lowercase SHA-256 of SPKI DER>`).

`runtime-evidence.mjs stage` validates the eleven exact receipt/signature pairs against
[`runtime-receipt.schema.json`](./runtime-receipt.schema.json), requires canonical JSON, verifies the
Ed25519 signature and expected key fingerprint, fixed probe and subject matrices, one consistent
harness identity, and unique execution IDs, and rejects stale (>72 hours), mismatched, oversized,
symlinked, duplicate, or extra-shaped data. Runtime manifest schema v2 records independent paths,
byte counts, and SHA-256 values for every receipt and signature, bound to the current GitHub run ID
and attempt. `release-evidence.yml` independently repeats signature verification using the same
protected public-key variables. Legacy unsigned receipt schema v2 is rejected fail-closed.

The required probe subjects include both physical platforms, both store tracks, signed EAS builds,
the OTA certificate, Cloudflare preview, staging restore, backup/restore, preview rollback on both
devices, Cloudflare/EAS/Supabase/Sentry control planes, alert delivery, and the security report.
Screenshots, free-form operator notes, a user-supplied `pass`, a packet from another workflow, or a
same-name artifact from another run are not accepted.

Until the protected runner/harness produces all fresh receipts for the same candidate, only the
partial NO-GO artifact can exist. This is intentional: repository automation does not invent
provider or physical-device proof.

For key rotation, add the new public SPKI and matching derived key ID to the protected environment
only after the external harness has switched. Rotation invalidates any not-yet-promoted packet under
the prior single-key contract; generate fresh same-candidate receipts rather than copying or
re-signing old evidence. Preserve the approved public-key fingerprint, harness build provenance, KMS
identity/ACL review, and rotation time as sanitized manual evidence.
