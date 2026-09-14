import assert from 'node:assert/strict';
import test from 'node:test';
import { probeHealth, validateProbeUrl } from './uptime-slo-probe.mjs';

test('synthetic probe rejects unsafe target URLs', () => {
  assert.throws(() => validateProbeUrl('http://example.com/health'));
  assert.throws(() => validateProbeUrl('https://user:pass@example.com/health'));
});

test('synthetic probe records only status, timing, and cache safety', async () => {
  const response = new Response('', { status: 200, headers: { 'cache-control': 'no-store' } });
  const result = await probeHealth({ url: 'https://health.sorita.example/health', samples: 2, fetchImpl: async () => response, clock: (() => { let tick = 0; return () => (tick += 1); })() });
  assert.equal(result.status, 'pass');
  assert.equal(result.availabilityPercent, 100);
  assert.equal(result.endpointHost, 'health.sorita.example');
  assert.equal(result.observations.length, 2);
});
