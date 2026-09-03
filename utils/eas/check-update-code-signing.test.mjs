import assert from 'node:assert/strict';
import test from 'node:test';

import { validateUpdateCodeSigningConfig } from './check-update-code-signing.mjs';

const validConfig = {
  updates: {
    codeSigningCertificate: 'certificates/eas-update.pem',
    codeSigningMetadata: { alg: 'rsa-v1_5-sha256', keyid: 'production-2026' },
  },
};

function dependencies(overrides = {}) {
  return {
    assertTracked() {},
    now: () => Date.parse('2026-08-31T00:00:00Z'),
    readCertificate: () => ({
      publicKey: { asymmetricKeyType: 'rsa' },
      validFrom: '2026-01-01T00:00:00Z',
      validTo: '2027-01-01T00:00:00Z',
    }),
    repositoryRoot: 'C:/repo',
    ...overrides,
  };
}

test('accepts a tracked, valid RSA EAS Update certificate contract', () => {
  assert.deepEqual(validateUpdateCodeSigningConfig(validConfig, dependencies()), {
    algorithm: 'rsa-v1_5-sha256',
    certificatePath: 'certificates/eas-update.pem',
    keyId: 'production-2026',
  });
});

test('fails closed when signing is absent, escapes the repo, or uses an expired certificate', () => {
  assert.throws(
    () => validateUpdateCodeSigningConfig({ updates: {} }, dependencies()),
    /certificate is not configured/u,
  );
  assert.throws(
    () => validateUpdateCodeSigningConfig({
      updates: { ...validConfig.updates, codeSigningCertificate: '../private.pem' },
    }, dependencies()),
    /inside the repository/u,
  );
  assert.throws(
    () => validateUpdateCodeSigningConfig(validConfig, dependencies({
      now: () => Date.parse('2028-01-01T00:00:00Z'),
    })),
    /validity window/u,
  );
});
