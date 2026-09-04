#!/usr/bin/env node

// Records what the attested build actually proves about the tooling image.
//
// This deliberately does NOT claim a rebuild-reproducibility comparison.
//
// The workflow builds twice: once as an OCI export carrying provenance and SBOM
// attestations, and once with `--load` so the test profiles have an image in the
// daemon. It is tempting to compare a digest across those two, but nothing is
// comparable across that boundary:
//
//   * `docker image inspect .Id` is the daemon's own recomputed config digest.
//     It differs from the OCI image config digest for the same build.
//   * `RootFS.Layers` from the daemon differs from the OCI config's
//     `rootfs.diff_ids`, because the daemon re-tars layers on import.
//   * `containerimage.digest` is an index digest on both sides, and the two
//     indexes differ because only one carries attestations.
//
// All three were measured on a real build before this file was written. A check
// comparing any of them would either fail on a correct build or, worse, be
// rewritten until it passed and prove nothing. So this records the verifiable
// facts and leaves rebuild determinism explicitly unproven.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sha256Pattern = /^sha256:[a-f0-9]{64}$/u;
const commitPattern = /^[a-f0-9]{40}$/u;

export const recordImageBuildEvidence = ({
  attestationSummaryPath,
  commitSha,
  imageInspectPath,
  outputPath,
  sourceDateEpoch,
}) => {
  if (!commitPattern.test(commitSha || '')) {
    throw new Error('A full lowercase commit SHA is required.');
  }
  if (!/^\d{10}$/u.test(sourceDateEpoch || '')) {
    throw new Error('SOURCE_DATE_EPOCH must be a ten-digit Unix timestamp.');
  }

  const summary = JSON.parse(readFileSync(attestationSummaryPath, 'utf8'));
  const inspect = JSON.parse(readFileSync(imageInspectPath, 'utf8'));

  if (!sha256Pattern.test(summary.imageConfigDigest || '')) {
    throw new Error('Attestation summary is missing the OCI image config digest.');
  }
  if (!sha256Pattern.test(summary.imageDigest || '')) {
    throw new Error('Attestation summary is missing the OCI image manifest digest.');
  }
  if (summary.provenance?.predicateType !== 'https://slsa.dev/provenance/v1') {
    throw new Error('Attestation summary does not record SLSA v1 provenance.');
  }
  if (summary.sbom?.predicateType !== 'https://spdx.dev/Document') {
    throw new Error('Attestation summary does not record an SPDX SBOM.');
  }
  if (!sha256Pattern.test(inspect.Id || '')) {
    throw new Error('Docker image inspect output is missing an image ID.');
  }

  const revisionLabel = inspect.Config?.Labels?.['org.opencontainers.image.revision'];
  if (revisionLabel !== commitSha) {
    throw new Error(
      `Loaded image revision label is '${revisionLabel ?? '<missing>'}', expected ${commitSha}.`,
    );
  }

  const evidence = {
    attested: {
      imageConfigDigest: summary.imageConfigDigest,
      imageDigest: summary.imageDigest,
      provenanceDigest: summary.provenance.digest,
      sbomDigest: summary.sbom.digest,
    },
    commitSha,
    loaded: {
      // Daemon-side identity. Recorded for traceability only; it is not
      // comparable with the attested OCI digests above.
      imageId: inspect.Id,
      revisionLabel,
      rootfsLayerCount: Array.isArray(inspect.RootFS?.Layers)
        ? inspect.RootFS.Layers.length
        : 0,
    },
    proves: [
      'the attested build produced full SLSA v1 provenance',
      'the attested build produced an SPDX SBOM',
      'the loaded image carries this commit as its revision label',
    ],
    doesNotProve: [
      'rebuild determinism: no second independent build is compared, so a '
        + 'non-deterministic build step would not be detected here',
    ],
    schemaVersion: 2,
    sourceDateEpoch,
  };

  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
};

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  const [attestationSummaryPath, imageInspectPath, outputPath] = process.argv.slice(2);
  if (!attestationSummaryPath || !imageInspectPath || !outputPath) {
    throw new Error(
      'Usage: node record-image-build-evidence.mjs <attestation-summary> <image-inspect> <output>',
    );
  }
  const evidence = recordImageBuildEvidence({
    attestationSummaryPath,
    commitSha: process.env.TARGET_SHA,
    imageInspectPath,
    outputPath,
    sourceDateEpoch: process.env.SOURCE_DATE_EPOCH,
  });
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
}
