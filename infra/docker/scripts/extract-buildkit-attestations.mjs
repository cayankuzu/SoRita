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
  // Full (mode=max) provenance is distinguished from mode=min by the resolved
  // dependency list and the internal build config. builder.id is deliberately
  // not used: it is empty for an unnamed local OCI export, so requiring it
  // would pass in CI and fail locally for the same artifact.
  return Boolean(
    predicate.buildDefinition?.buildType &&
      Array.isArray(predicate.buildDefinition.resolvedDependencies) &&
      predicate.buildDefinition.resolvedDependencies.length > 0 &&
      predicate.buildDefinition.internalParameters?.buildConfig &&
      predicate.runDetails?.metadata,
  );
};

const validateSpdx = (statement) =>
  statement.predicateType === 'https://spdx.dev/Document' &&
  /^SPDX-2\./u.test(statement.predicate?.spdxVersion || '') &&
  Array.isArray(statement.predicate?.packages);

export const extractBuildkitAttestations = (layoutDirectory, outputDirectory) => {
  const layout = path.resolve(layoutDirectory);
  const output = path.resolve(outputDirectory);
  const rootIndex = readJson(path.join(layout, 'index.json'));
  if (rootIndex.schemaVersion !== 2 || !Array.isArray(rootIndex.manifests)) {
    throw new Error('OCI layout index must use schema version 2 and contain manifests.');
  }

  // `docker buildx build --output type=oci` nests the real manifest list one
  // level below index.json, so descend until the attestation descriptors are
  // visible instead of assuming a flat layout.
  const indexMediaTypes = new Set([
    'application/vnd.oci.image.index.v1+json',
    'application/vnd.docker.distribution.manifest.list.v2+json',
  ]);
  const resolveManifestList = (manifests, depth = 0) => {
    if (depth > 4) throw new Error('OCI layout nests image indexes too deeply.');
    const hasAttestation = manifests.some(
      (descriptor) =>
        descriptor.annotations?.['vnd.docker.reference.type'] === attestationType,
    );
    if (hasAttestation) return manifests;
    const nested = manifests.filter((descriptor) =>
      indexMediaTypes.has(descriptor.mediaType),
    );
    if (nested.length !== 1) return manifests;
    const child = JSON.parse(readBlob(layout, nested[0].digest).toString('utf8'));
    if (!Array.isArray(child.manifests)) return manifests;
    return resolveManifestList(child.manifests, depth + 1);
  };
  const manifestList = resolveManifestList(rootIndex.manifests);

  const attestationDescriptors = manifestList.filter(
    (descriptor) =>
      descriptor.annotations?.['vnd.docker.reference.type'] === attestationType,
  );
  const imageDescriptors = manifestList.filter(
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
      // BuildKit emits in-toto Statement v0.1 on older releases and v1 on
      // current ones. Both are valid; rejecting v1 would fail every modern build.
      if (
        statement._type !== 'https://in-toto.io/Statement/v0.1' &&
        statement._type !== 'https://in-toto.io/Statement/v1'
      ) {
        throw new Error('BuildKit attestation is not a supported in-toto Statement document.');
      }
      // An unnamed OCI export carries no image reference, so BuildKit emits an
      // empty subject list. The attestation manifest was already bound to the
      // image through its `vnd.docker.reference.digest` annotation above, so
      // only enforce subject matching when the statement actually names one.
      const subjects = Array.isArray(statement.subject) ? statement.subject : [];
      if (subjects.length > 0 && !statementSubjectMatches(statement, imageDigest)) {
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
    // The OCI export reports an index digest, not an image config digest, so
    // the config digest is resolved from the image manifest here. That is the
    // value that is genuinely comparable with `containerimage.config.digest`
    // from a `--load` build; comparing an index or attestation digest against
    // it would be comparing two different things.
    imageConfigDigest: imageManifest.config.digest,
    imageDigest,
    provenance: { digest: provenance.digest, predicateType: provenance.statement.predicateType },
    sbom: { digest: sbom.digest, predicateType: sbom.statement.predicateType },
    schemaVersion: 2,
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
