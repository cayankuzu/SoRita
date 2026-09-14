import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDomain, verifyHostedAssociation, verifyTemplates } from './verify-app-link-association.mjs';

const fingerprint = 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';

test('app-link templates remain explicit and non-provider-specific', () => {
  assert.doesNotThrow(() => verifyTemplates());
  assert.equal(normalizeDomain('links.sorita.example'), 'links.sorita.example');
  assert.throws(() => normalizeDomain('https://links.sorita.example/path'));
});

test('hosted association verification requires both platform identities', async () => {
  const fetchImpl = async (url) => new Response(JSON.stringify(url.includes('apple-app') ? {
    applinks: { details: [{ appID: 'HBRG8P523Z.com.cayan.sorita.socialmap' }] },
  } : [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: 'com.cayan.sorita.socialmap', sha256_cert_fingerprints: [fingerprint] },
  }]), { status: 200, headers: { 'content-type': 'application/json' } });
  const result = await verifyHostedAssociation({ domain: 'links.sorita.example', androidFingerprint: fingerprint, fetchImpl });
  assert.equal(result.domain, 'links.sorita.example');
});
