import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { extractBuildkitAttestations } from './extract-buildkit-attestations.mjs';
import { verifyImageReproducibility } from './verify-image-reproducibility.mjs';

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

test('verifyImageReproducibility binds two matching image config digests to source and SHA', () => {
  const directory = temporaryDirectory();
  const firstMetadataPath = path.join(directory, 'first.json');
  const secondMetadataPath = path.join(directory, 'second.json');
  const outputPath = path.join(directory, 'evidence.json');
  const configDigest = `sha256:${'2'.repeat(64)}`;
  writeFileSync(firstMetadataPath, JSON.stringify({ 'containerimage.config.digest': configDigest }));
  writeFileSync(secondMetadataPath, JSON.stringify({ 'containerimage.config.digest': configDigest }));

  const evidence = verifyImageReproducibility({
    commitSha: 'a'.repeat(40),
    firstMetadataPath,
    outputPath,
    secondMetadataPath,
    sourceDateEpoch: '1788134400',
  });
  assert.equal(evidence.matches, true);
  assert.equal(evidence.firstConfigDigest, configDigest);
  assert.deepEqual(JSON.parse(readFileSync(outputPath, 'utf8')), evidence);
});

test('verifyImageReproducibility rejects different config/rootfs digests', () => {
  const directory = temporaryDirectory();
  const firstMetadataPath = path.join(directory, 'first.json');
  const secondMetadataPath = path.join(directory, 'second.json');
  writeFileSync(
    firstMetadataPath,
    JSON.stringify({ 'containerimage.config.digest': `sha256:${'3'.repeat(64)}` }),
  );
  writeFileSync(
    secondMetadataPath,
    JSON.stringify({ 'containerimage.config.digest': `sha256:${'4'.repeat(64)}` }),
  );

  assert.throws(
    () =>
      verifyImageReproducibility({
        commitSha: 'a'.repeat(40),
        firstMetadataPath,
        outputPath: path.join(directory, 'evidence.json'),
        secondMetadataPath,
        sourceDateEpoch: '1788134400',
      }),
    /different image config\/rootfs digests/u,
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
