#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const confirmation = 'APPROVED_EXTERNAL_PROBE';

function fail(message) { throw new Error(message); }

export function validateProbeUrl(raw) {
  if (!raw?.trim()) fail('SORITA_UPTIME_HEALTH_URL or --url is required.');
  let url;
  try { url = new URL(raw); } catch { fail('Health URL must be a valid HTTPS URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) {
    fail('Health URL must be a public HTTPS URL without credentials, query, or fragment.');
  }
  return url;
}

function parseArguments(argv) {
  const options = { samples: 3 };
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]; const value = argv[index + 1];
    if (!name?.startsWith('--') || !value || value.startsWith('--')) fail(`Invalid or missing value for ${name ?? 'argument'}.`);
    options[name.slice(2)] = value;
  }
  if (options.samples !== 3) options.samples = Number(options.samples);
  if (!Number.isInteger(options.samples) || options.samples < 1 || options.samples > 10) fail('--samples must be an integer from 1 through 10.');
  return options;
}

export async function probeHealth({ url, samples, fetchImpl = fetch, clock = () => performance.now() }) {
  const target = validateProbeUrl(url);
  const observations = [];
  for (let index = 0; index < samples; index += 1) {
    const start = clock();
    try {
      const response = await fetchImpl(target, { redirect: 'error', signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' } });
      const durationMs = Math.round((clock() - start) * 100) / 100;
      observations.push({ durationMs, noStore: (response.headers.get('cache-control') ?? '').toLowerCase().includes('no-store'), status: response.status, success: response.status >= 200 && response.status < 300 });
    } catch {
      observations.push({ durationMs: Math.round((clock() - start) * 100) / 100, noStore: false, status: null, success: false });
    }
  }
  const successful = observations.filter((item) => item.success);
  return {
    availabilityPercent: Math.round((successful.length / samples) * 10_000) / 100,
    checkedAt: new Date().toISOString(),
    endpointHost: target.hostname,
    observedNoStoreOnSuccessfulResponses: successful.every((item) => item.noStore),
    observations,
    schemaVersion: 1,
    scope: 'synthetic-health-probe',
    status: successful.length === samples ? 'pass' : 'fail',
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (process.env.SORITA_UPTIME_RUN_CONFIRM !== confirmation) fail(`External probe requires SORITA_UPTIME_RUN_CONFIRM=${confirmation}.`);
  const result = await probeHealth({ url: options.url ?? process.env.SORITA_UPTIME_HEALTH_URL, samples: options.samples });
  if (options.output) {
    const output = resolve(options.output);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  }
  process.stdout.write(`Synthetic health probe for ${result.endpointHost}: ${result.status.toUpperCase()} (${result.availabilityPercent}%).\n`);
  if (result.status !== 'pass') process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
