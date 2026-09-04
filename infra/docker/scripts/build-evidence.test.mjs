import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { extractBuildkitAttestations } from './extract-buildkit-attestations.mjs';
import { recordImageBuildEvidence } from './record-image-build-evidence.mjs';

const temporaryDirectories = [];
const temporaryDirectory = () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sorita-build-evidence-test-'));
  temporaryDirectories.push(directory);
  return directory;
};

test.after(() => {
  for (const directory of temporaryDirectories) rmSync(directory, { force: true, recursive: true });
});

const writeBlob = (layout, value) => {
  const content = Buffer.from(JSON.stringify(value));
  const checksum = createHash('sha256').update(content).digest('hex');
  writeFileSync(path.join(layout, 'blobs', 'sha256', checksum), content);
  return `sha256:${checksum}`;
};

const makeLayout = ({ mismatchedSubject = false } = {}) => {
  const layout = temporaryDirectory();
  const output = temporaryDirectory();
  mkdirSync(path.join(layout, 'blobs', 'sha256'), { recursive: true });
  writeFileSync(path.join(layout, 'oci-layout'), '{"imageLayoutVersion":"1.0.0"}\n');

  const configDigest = writeBlob(layout, { architecture: 'amd64', os: 'linux', rootfs: { diff_ids: [], type: 'layers' } });
  const imageDigest = writeBlob(layout, {
    config: { digest: configDigest, mediaType: 'application/vnd.oci.image.config.v1+json', size: 1 },
    layers: [],
    schemaVersion: 2,
  });
  const subjectChecksum = mismatchedSubject ? 'f'.repeat(64) : imageDigest.slice('sha256:'.length);
  const subject = [{ digest: { sha256: subjectChecksum }, name: 'synthetic-image' }];
  const provenanceDigest = writeBlob(layout, {
    _type: 'https://in-toto.io/Statement/v0.1',
    predicate: {
      builder: { id: 'https://github.com/docker/buildx' },
      buildType: 'https://mobyproject.org/buildkit@v1',
      materials: [{ digest: { sha256: '1'.repeat(64) }, uri: 'pkg:generic/source' }],
    },
    predicateType: 'https://slsa.dev/provenance/v0.2',
    subject,
  });
  const sbomDigest = writeBlob(layout, {
    _type: 'https://in-toto.io/Statement/v0.1',
    predicate: { packages: [], spdxVersion: 'SPDX-2.3' },
    predicateType: 'https://spdx.dev/Document',
    subject,
  });
  const attestationDigest = writeBlob(layout, {
    config: { digest: configDigest, mediaType: 'application/vnd.oci.empty.v1+json', size: 1 },
    layers: [
      { digest: provenanceDigest, mediaType: 'application/vnd.in-toto+json', size: 1 },
      { digest: sbomDigest, mediaType: 'application/vnd.in-toto+json', size: 1 },
    ],
    schemaVersion: 2,
  });
  writeFileSync(
    path.join(layout, 'index.json'),
    JSON.stringify({
      manifests: [
        { digest: imageDigest, mediaType: 'application/vnd.oci.image.manifest.v1+json', size: 1 },
        {
          annotations: {
            'vnd.docker.reference.digest': imageDigest,
            'vnd.docker.reference.type': 'attestation-manifest',
          },
          digest: attestationDigest,
          mediaType: 'application/vnd.oci.image.manifest.v1+json',
          size: 1,
        },
      ],
      schemaVersion: 2,
    }),
  );
  return { imageDigest, layout, output };
};

test('extractBuildkitAttestations verifies and writes full provenance and SPDX statements', () => {
  const fixture = makeLayout();
  const summary = extractBuildkitAttestations(fixture.layout, fixture.output);

  assert.equal(summary.imageDigest, fixture.imageDigest);
  assert.equal(summary.provenance.predicateType, 'https://slsa.dev/provenance/v0.2');
  assert.equal(summary.sbom.predicateType, 'https://spdx.dev/Document');
  assert.equal(
    JSON.parse(readFileSync(path.join(fixture.output, 'buildkit-sbom.spdx.intoto.json'), 'utf8'))
      .predicate.spdxVersion,
    'SPDX-2.3',
  );
});

test('extractBuildkitAttestations rejects an attestation for another image', () => {
  const fixture = makeLayout({ mismatchedSubject: true });
  assert.throws(
    () => extractBuildkitAttestations(fixture.layout, fixture.output),
    /subject does not match/u,
  );
});



// Mirrors what `docker buildx build --output type=oci --provenance=mode=max
// --sbom=true` actually produces on current BuildKit: the real manifest list is
// nested one level below index.json, statements are in-toto v1, and an unnamed
// OCI export carries an empty subject list. The original flat, v0.1 fixture did
// not match any of that, which is why a broken extractor passed its own tests.
const makeModernLayout = ({ orphanAttestation = false } = {}) => {
  const layout = temporaryDirectory();
  const output = temporaryDirectory();
  mkdirSync(path.join(layout, 'blobs', 'sha256'), { recursive: true });
  writeFileSync(path.join(layout, 'oci-layout'), '{"imageLayoutVersion":"1.0.0"}\n');

  const configDigest = writeBlob(layout, {
    architecture: 'amd64',
    os: 'linux',
    rootfs: { diff_ids: [], type: 'layers' },
  });
  const imageDigest = writeBlob(layout, {
    config: { digest: configDigest, mediaType: 'application/vnd.oci.image.config.v1+json', size: 1 },
    layers: [],
    schemaVersion: 2,
  });

  const provenanceDigest = writeBlob(layout, {
    _type: 'https://in-toto.io/Statement/v1',
    predicate: {
      buildDefinition: {
        buildType: 'https://github.com/moby/buildkit/blob/master/docs/attestations/slsa-definitions.md',
        externalParameters: {},
        internalParameters: { buildConfig: {}, builderPlatform: 'linux/amd64' },
        resolvedDependencies: [{ uri: 'pkg:docker/node', digest: { sha256: '1'.repeat(64) } }],
      },
      runDetails: {
        builder: { id: '' },
        metadata: { invocationId: 'synthetic', startedOn: '2026-09-03T00:00:00Z' },
      },
    },
    predicateType: 'https://slsa.dev/provenance/v1',
    subject: [],
  });
  const sbomDigest = writeBlob(layout, {
    _type: 'https://in-toto.io/Statement/v1',
    predicate: { packages: [], spdxVersion: 'SPDX-2.3' },
    predicateType: 'https://spdx.dev/Document',
    subject: [],
  });
  const attestationDigest = writeBlob(layout, {
    config: { digest: configDigest, mediaType: 'application/vnd.oci.empty.v1+json', size: 1 },
    layers: [
      { digest: sbomDigest, mediaType: 'application/vnd.in-toto+json', size: 1 },
      { digest: provenanceDigest, mediaType: 'application/vnd.in-toto+json', size: 1 },
    ],
    schemaVersion: 2,
  });

  const nestedIndexDigest = writeBlob(layout, {
    manifests: [
      {
        digest: imageDigest,
        mediaType: 'application/vnd.oci.image.manifest.v1+json',
        platform: { architecture: 'amd64', os: 'linux' },
        size: 1,
      },
      {
        annotations: {
          'vnd.docker.reference.digest': orphanAttestation
            ? 'sha256:' + 'f'.repeat(64)
            : imageDigest,
          'vnd.docker.reference.type': 'attestation-manifest',
        },
        digest: attestationDigest,
        mediaType: 'application/vnd.oci.image.manifest.v1+json',
        platform: { architecture: 'unknown', os: 'unknown' },
        size: 1,
      },
    ],
    mediaType: 'application/vnd.oci.image.index.v1+json',
    schemaVersion: 2,
  });

  writeFileSync(
    path.join(layout, 'index.json'),
    JSON.stringify({
      manifests: [
        {
          digest: nestedIndexDigest,
          mediaType: 'application/vnd.oci.image.index.v1+json',
          size: 1,
        },
      ],
      schemaVersion: 2,
    }),
  );
  return { imageDigest, layout, output };
};

test('extractBuildkitAttestations reads a nested OCI index with in-toto v1 statements', () => {
  const fixture = makeModernLayout();
  const summary = extractBuildkitAttestations(fixture.layout, fixture.output);

  assert.equal(summary.imageDigest, fixture.imageDigest);
  assert.equal(summary.provenance.predicateType, 'https://slsa.dev/provenance/v1');
  assert.equal(summary.sbom.predicateType, 'https://spdx.dev/Document');
  assert.equal(
    JSON.parse(readFileSync(path.join(fixture.output, 'buildkit-provenance.intoto.json'), 'utf8'))
      .predicate.buildDefinition.resolvedDependencies.length,
    1,
  );
});

test('extractBuildkitAttestations still rejects an attestation bound to another image', () => {
  const fixture = makeModernLayout({ orphanAttestation: true });
  assert.throws(
    () => extractBuildkitAttestations(fixture.layout, fixture.output),
    /does not reference the built image digest/u,
  );
});

const summaryFixture = (overrides = {}) => ({
  imageConfigDigest: `sha256:${'a'.repeat(64)}`,
  imageDigest: `sha256:${'b'.repeat(64)}`,
  provenance: { digest: `sha256:${'c'.repeat(64)}`, predicateType: 'https://slsa.dev/provenance/v1' },
  sbom: { digest: `sha256:${'d'.repeat(64)}`, predicateType: 'https://spdx.dev/Document' },
  schemaVersion: 2,
  ...overrides,
});

const inspectFixture = (revision) => ({
  Config: { Labels: { 'org.opencontainers.image.revision': revision } },
  Id: `sha256:${'e'.repeat(64)}`,
  RootFS: { Layers: [`sha256:${'f'.repeat(64)}`] },
});

const writeEvidenceFixture = (summary, inspect) => {
  const directory = temporaryDirectory();
  const summaryPath = path.join(directory, 'summary.json');
  const inspectPath = path.join(directory, 'inspect.json');
  const outputPath = path.join(directory, 'evidence.json');
  writeFileSync(summaryPath, JSON.stringify(summary));
  writeFileSync(inspectPath, JSON.stringify(inspect));
  return { inspectPath, outputPath, summaryPath };
};

test('recordImageBuildEvidence records attested digests and the commit binding', () => {
  const commitSha = 'a'.repeat(40);
  const fixture = writeEvidenceFixture(summaryFixture(), inspectFixture(commitSha));
  const evidence = recordImageBuildEvidence({
    attestationSummaryPath: fixture.summaryPath,
    commitSha,
    imageInspectPath: fixture.inspectPath,
    outputPath: fixture.outputPath,
    sourceDateEpoch: '1788134400',
  });

  assert.equal(evidence.commitSha, commitSha);
  assert.equal(evidence.attested.imageConfigDigest, `sha256:${'a'.repeat(64)}`);
  assert.equal(evidence.loaded.revisionLabel, commitSha);
  assert.deepEqual(JSON.parse(readFileSync(fixture.outputPath, 'utf8')), evidence);
  // The honest limitation must stay recorded, not quietly dropped.
  assert.ok(evidence.doesNotProve.some((entry) => entry.includes('rebuild determinism')));
});

test('recordImageBuildEvidence rejects an image built from another commit', () => {
  const fixture = writeEvidenceFixture(summaryFixture(), inspectFixture('b'.repeat(40)));
  assert.throws(
    () =>
      recordImageBuildEvidence({
        attestationSummaryPath: fixture.summaryPath,
        commitSha: 'a'.repeat(40),
        imageInspectPath: fixture.inspectPath,
        outputPath: fixture.outputPath,
        sourceDateEpoch: '1788134400',
      }),
    /revision label/u,
  );
});

test('recordImageBuildEvidence rejects a summary without provenance or SBOM', () => {
  const commitSha = 'a'.repeat(40);
  for (const [overrides, pattern] of [
    [{ provenance: { digest: `sha256:${'c'.repeat(64)}`, predicateType: 'https://slsa.dev/provenance/v0.2' } }, /SLSA v1 provenance/u],
    [{ sbom: { digest: `sha256:${'d'.repeat(64)}`, predicateType: 'https://example.invalid/other' } }, /SPDX SBOM/u],
  ]) {
    const fixture = writeEvidenceFixture(summaryFixture(overrides), inspectFixture(commitSha));
    assert.throws(
      () =>
        recordImageBuildEvidence({
          attestationSummaryPath: fixture.summaryPath,
          commitSha,
          imageInspectPath: fixture.inspectPath,
          outputPath: fixture.outputPath,
          sourceDateEpoch: '1788134400',
        }),
      pattern,
    );
  }
});
