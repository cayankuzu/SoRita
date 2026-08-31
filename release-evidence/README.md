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
  --result feature-surface=pass \
  --result evidence-tool=pass \
  --result sast-secret-scan=pass \
  --result cloudflare-preview=unverified \
  --result signed-android-ios=unverified \
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
  --runtime-version 1.0.101
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

Schema v1 requires every named release check, even when its honest state is `unverified`. The verifier
rejects missing or unknown checks, any non-`pass` state, and artifact paths outside the repository.
