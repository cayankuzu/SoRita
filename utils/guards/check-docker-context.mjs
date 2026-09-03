import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ignorePaths = [
  '.dockerignore',
  'infra/docker/.dockerignore',
  'infra/docker/Dockerfile.tooling.dockerignore',
];
const requiredSecretPatterns = [
  '.env',
  '.env.*',
  '**/.dev.vars',
  'credentials.json',
  'credentials/',
  '*.p8',
  '*.p12',
  '*.pem',
  '*.key',
  '*.jks',
  '*.keystore',
  '*.mobileprovision',
  '*service-account*.json',
  '*firebase-admin*.json',
  'google-services.json',
  'GoogleService-Info.plist',
  'android/app/google-services.json',
];
const requiredContextPatterns = [
  '**',
  '!.dockerignore',
  '!package.json',
  '!package-lock.json',
  '!infra/cloudflare/sorita-edge/**',
  '!infra/docker/**',
  '!utils/guards/check-docker-context.mjs',
  '**/node_modules/**',
  '**/.wrangler/**',
  '**/coverage/**',
];

const ignoreLineSets = new Map();
const normalizedIgnores = ignorePaths.map((relativePath) => {
  const lines = readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  for (const line of lines) {
    assert.ok(
      !/^[+-]/u.test(line),
      `${relativePath} contains a diff-marker artifact instead of a pattern: ${line}`,
    );
  }
  const lineSet = new Set(lines);
  for (const pattern of requiredSecretPatterns) {
    assert.ok(lineSet.has(pattern), `${relativePath} must exclude ${pattern}`);
  }
  for (const pattern of requiredContextPatterns) {
    assert.ok(lineSet.has(pattern), `${relativePath} must enforce ${pattern}`);
  }
  assert.equal(lines[0], '**', `${relativePath} must deny the repository before allowlisting inputs`);
  ignoreLineSets.set(relativePath, lineSet);
  return [...lineSet].sort();
});

assert.deepEqual(
  normalizedIgnores[1],
  normalizedIgnores[0],
  'infra/docker/.dockerignore must match the effective root ignore contract',
);
assert.deepEqual(
  normalizedIgnores[2],
  normalizedIgnores[0],
  'Dockerfile.tooling.dockerignore must match the effective root ignore contract',
);

const dockerfile = readFileSync(
  path.join(repositoryRoot, 'infra/docker/Dockerfile.tooling'),
  'utf8',
);
assert.match(
  dockerfile,
  /^ARG NODE_IMAGE=node:[^\s]+@sha256:[a-f0-9]{64}$/mu,
  'Docker tooling base image must be immutable-digest pinned',
);
assert.match(dockerfile, /^FROM \$\{NODE_IMAGE\} AS root-dependencies$/mu);
assert.match(dockerfile, /^FROM \$\{NODE_IMAGE\} AS worker-dependencies$/mu);
assert.match(dockerfile, /^FROM \$\{NODE_IMAGE\} AS tooling$/mu);
assert.match(dockerfile, /^USER node$/mu, 'Docker tooling runtime must be non-root');
assert.doesNotMatch(
  dockerfile,
  /^COPY(?:\s+--\S+)*\s+\.\s+\.$/mu,
  'Dockerfile must copy only explicit source paths',
);
assert.doesNotMatch(
  dockerfile,
  /(?:AuthKey|credentials\.json|google-services|GoogleService-Info|keystore)/iu,
  'Dockerfile must never copy credential paths',
);


// Every build-context COPY source must be explicitly re-included by each
// ignore file. Without this the image silently loses required inputs and the
// build only fails later, deep inside BuildKit.
const contextCopySources = dockerfile
  .split(/\r?\n/u)
  .filter((line) => /^COPY\s/u.test(line) && !/\s--from=/u.test(line))
  .flatMap((line) => {
    const args = line
      .replace(/^COPY\s+/u, '')
      .split(/\s+/u)
      .filter((argument) => argument && !argument.startsWith('--'));
    return args.slice(0, -1);
  });

assert.ok(contextCopySources.length > 0, 'Dockerfile must copy explicit context sources');

const isReIncluded = (lineSet, source) => {
  if (lineSet.has(`!${source}`)) return true;
  if (lineSet.has(`!${source}/`) || lineSet.has(`!${source}/**`)) {
    return statSync(path.join(repositoryRoot, source)).isDirectory();
  }
  const segments = source.split('/');
  for (let index = segments.length - 1; index > 0; index -= 1) {
    const ancestor = segments.slice(0, index).join('/');
    if (lineSet.has(`!${ancestor}/**`)) return true;
  }
  return false;
};

for (const [relativePath, lineSet] of ignoreLineSets) {
  for (const source of contextCopySources) {
    statSync(path.join(repositoryRoot, source));
    assert.ok(
      isReIncluded(lineSet, source),
      `${relativePath} does not re-include the Dockerfile COPY source ${source}`,
    );
  }
}

process.stdout.write(
  `${JSON.stringify({
    ignoreFiles: ignorePaths,
    requiredContextPatterns,
    requiredSecretPatterns,
    status: 'pass',
  })}\n`,
);
