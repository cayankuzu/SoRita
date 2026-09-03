import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sha256Pattern = /^sha256:[a-f0-9]{64}$/u;
const commitPattern = /^[a-f0-9]{40}$/u;

export const verifyImageReproducibility = ({
  commitSha,
  firstMetadataPath,
  outputPath,
  secondMetadataPath,
  sourceDateEpoch,
}) => {
  const first = JSON.parse(readFileSync(firstMetadataPath, 'utf8'));
  const second = JSON.parse(readFileSync(secondMetadataPath, 'utf8'));
  const firstConfigDigest = first['containerimage.config.digest'];
  const secondConfigDigest = second['containerimage.config.digest'];

  if (!commitPattern.test(commitSha || '')) throw new Error('A full lowercase commit SHA is required.');
  if (!/^\d{10}$/u.test(sourceDateEpoch || '')) {
    throw new Error('SOURCE_DATE_EPOCH must be a ten-digit Unix timestamp.');
  }
  if (!sha256Pattern.test(firstConfigDigest || '') || !sha256Pattern.test(secondConfigDigest || '')) {
    throw new Error('Both Buildx metadata files must contain image config digests.');
  }
  if (firstConfigDigest !== secondConfigDigest) {
    throw new Error('Independent builds produced different image config/rootfs digests.');
  }

  const evidence = {
    commitSha,
    comparison: 'containerimage.config.digest',
    firstConfigDigest,
    matches: true,
    schemaVersion: 1,
    secondConfigDigest,
    sourceDateEpoch,
  };
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
};

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  const [firstMetadataPath, secondMetadataPath, outputPath] = process.argv.slice(2);
  if (!firstMetadataPath || !secondMetadataPath || !outputPath) {
    throw new Error(
      'Usage: node verify-image-reproducibility.mjs <first-metadata> <second-metadata> <output>',
    );
  }
  const evidence = verifyImageReproducibility({
    commitSha: process.env.TARGET_SHA,
    firstMetadataPath,
    outputPath,
    secondMetadataPath,
    sourceDateEpoch: process.env.SOURCE_DATE_EPOCH,
  });
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
}
