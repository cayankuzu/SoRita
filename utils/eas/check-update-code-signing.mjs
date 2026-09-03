#!/usr/bin/env node

import { X509Certificate } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function fail(message) {
  throw new Error(message);
}

export function validateUpdateCodeSigningConfig(config, dependencies) {
  const certificatePath = config?.updates?.codeSigningCertificate;
  const metadata = config?.updates?.codeSigningMetadata;
  if (typeof certificatePath !== 'string' || !certificatePath.trim()) {
    fail('EAS Update code-signing certificate is not configured.');
  }
  if (isAbsolute(certificatePath)) fail('Code-signing certificate path must be repository-relative.');
  const absoluteCertificatePath = resolve(dependencies.repositoryRoot, certificatePath);
  const repositoryRelativePath = relative(dependencies.repositoryRoot, absoluteCertificatePath)
    .replaceAll('\\', '/');
  if (repositoryRelativePath.startsWith('../') || repositoryRelativePath === '..') {
    fail('Code-signing certificate must stay inside the repository.');
  }
  if (
    !metadata
    || typeof metadata !== 'object'
    || !/^[A-Za-z0-9._-]{1,64}$/u.test(metadata.keyid ?? '')
    || metadata.alg !== 'rsa-v1_5-sha256'
  ) {
    fail('EAS Update code-signing metadata is invalid.');
  }

  const certificate = dependencies.readCertificate(absoluteCertificatePath);
  if (certificate.publicKey?.asymmetricKeyType !== 'rsa') fail('Update certificate must use RSA.');
  const now = dependencies.now();
  if (now < Date.parse(certificate.validFrom) || now > Date.parse(certificate.validTo)) {
    fail('EAS Update code-signing certificate is outside its validity window.');
  }
  dependencies.assertTracked(repositoryRelativePath);
  return { algorithm: metadata.alg, certificatePath: repositoryRelativePath, keyId: metadata.keyid };
}

function parseArguments(argv) {
  if (argv.length !== 2 || argv[0] !== '--config') fail('Usage: check-update-code-signing.mjs --config <expo-config.json>');
  return argv[1];
}

function main() {
  const repositoryRoot = process.cwd();
  const configPath = resolve(parseArguments(process.argv.slice(2)));
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const result = validateUpdateCodeSigningConfig(config, {
    assertTracked(path) {
      execFileSync('git', ['ls-files', '--error-unmatch', '--', path], {
        cwd: repositoryRoot,
        stdio: 'ignore',
      });
    },
    now: () => Date.now(),
    readCertificate(path) {
      return new X509Certificate(readFileSync(path));
    },
    repositoryRoot,
  });
  process.stdout.write(`${JSON.stringify({ ...result, status: 'pass' })}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
