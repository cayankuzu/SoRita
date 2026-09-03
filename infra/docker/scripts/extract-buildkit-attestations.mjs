import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const digestPattern = /^sha256:([a-f0-9]{64})$/u;
const attestationType = 'attestation-manifest';

const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));

const readBlob = (layoutDirectory, digest) => {
  const match = digestPattern.exec(digest || '');
  if (!match) throw new Error(`Invalid OCI sha256 descriptor: ${digest || '<missing>'}`);

  const blob = readFileSync(path.join(layoutDirectory, 'blobs', 'sha256', match[1]));
  const actualDigest = createHash('sha256').update(blob).digest('hex');
  if (actualDigest !== match[1]) throw new Error(`OCI blob checksum mismatch for ${digest}.`);
  return blob;
};

const statementSubjectMatches = (statement, imageDigest) => {
  const expected = digestPattern.exec(imageDigest)?.[1];
  return statement.subject?.some((subject) => subject?.digest?.sha256 === expected) === true;
};

const validateProvenance = (statement) => {
  if (!/^https:\/\/slsa\.dev\/provenance\/v(?:0\.2|1)$/u.test(statement.predicateType || '')) {
    return false;
  }
  const predicate = statement.predicate;
  if (!predicate || typeof predicate !== 'object') return false;

  if (statement.predicateType.endsWith('/v0.2')) {
    return Boolean(
      predicate.builder?.id &&
        predicate.buildType &&
        Array.isArray(predicate.materials) &&
        predicate.materials.length > 0,
    );
  }
  return Boolean(predicate.buildDefinition && predicate.runDetails?.builder?.id);
};

const validateSpdx = (statement) =>
  statement.predicateType === 'https://spdx.dev/Document' &&
  /^SPDX-2\./u.test(statement.predicate?.spdxVersion || '') &&
  Array.isArray(statement.predicate?.packages);

export const extractBuildkitAttestations = (layoutDirectory, outputDirectory) => {
  const layout = path.resolve(layoutDirectory);
  const output = path.resolve(outputDirectory);
  const index = readJson(path.join(layout, 'index.json'));
  if (index.schemaVersion !== 2 || !Array.isArray(index.manifests)) {
    throw new Error('OCI layout index must use schema version 2 and contain manifests.');
  }

  const attestationDescriptors = index.manifests.filter(
    (descriptor) =>
      descriptor.annotations?.['vnd.docker.reference.type'] === attestationType,
  );
  const imageDescriptors = index.manifests.filter(
    (descriptor) =>
      descriptor.annotations?.['vnd.docker.reference.type'] !== attestationType,
  );
  if (imageDescriptors.length !== 1) {
    throw new Error(`Expected one image descriptor, found ${imageDescriptors.length}.`);
  }
  if (attestationDescriptors.length < 1) {
    throw new Error('OCI layout does not contain a BuildKit attestation manifest.');
  }

  const imageDigest = imageDescriptors[0].digest;
  const imageManifest = JSON.parse(readBlob(layout, imageDigest).toString('utf8'));
  if (imageManifest.schemaVersion !== 2 || !imageManifest.config || !Array.isArray(imageManifest.layers)) {
    throw new Error('Built image descriptor does not reference a valid OCI image manifest.');
  }
  const statements = [];
  for (const descriptor of attestationDescriptors) {
    const referenceDigest = descriptor.annotations?.['vnd.docker.reference.digest'];
    if (referenceDigest !== imageDigest) {
      throw new Error('Attestation manifest does not reference the built image digest.');
    }
    const manifest = JSON.parse(readBlob(layout, descriptor.digest).toString('utf8'));
    if (manifest.schemaVersion !== 2 || !Array.isArray(manifest.layers)) {
      throw new Error('Attestation manifest must contain OCI layers.');
    }
    for (const layer of manifest.layers) {
      if (layer.mediaType !== 'application/vnd.in-toto+json') continue;
      const statement = JSON.parse(readBlob(layout, layer.digest).toString('utf8'));
      if (statement._type !== 'https://in-toto.io/Statement/v0.1') {
        throw new Error('BuildKit attestation is not an in-toto Statement v0.1 document.');
      }
      if (!statementSubjectMatches(statement, imageDigest)) {
        throw new Error('BuildKit attestation subject does not match the built image digest.');
      }
      statements.push({ digest: layer.digest, statement });
    }
  }

  const provenance = statements.find(({ statement }) => validateProvenance(statement));
  const sbom = statements.find(({ statement }) => validateSpdx(statement));
  if (!provenance) throw new Error('Full SLSA BuildKit provenance was not found.');
  if (!sbom) throw new Error('BuildKit SPDX SBOM attestation was not found.');

  mkdirSync(output, { recursive: true });
  writeFileSync(
    path.join(output, 'buildkit-provenance.intoto.json'),
    `${JSON.stringify(provenance.statement, null, 2)}\n`,
  );
  writeFileSync(
    path.join(output, 'buildkit-sbom.spdx.intoto.json'),
    `${JSON.stringify(sbom.statement, null, 2)}\n`,
  );

  const summary = {
    imageDigest,
    provenance: { digest: provenance.digest, predicateType: provenance.statement.predicateType },
    sbom: { digest: sbom.digest, predicateType: sbom.statement.predicateType },
    schemaVersion: 1,
  };
  writeFileSync(
    path.join(output, 'buildkit-attestation-summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  return summary;
};

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  if (process.argv.length !== 4) {
    throw new Error('Usage: node extract-buildkit-attestations.mjs <oci-layout-directory> <output-directory>');
  }
  process.stdout.write(`${JSON.stringify(extractBuildkitAttestations(process.argv[2], process.argv[3]))}\n`);
}
