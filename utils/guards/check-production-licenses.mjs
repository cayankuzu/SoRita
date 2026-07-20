import { readFile } from 'node:fs/promises';

const lockfile = JSON.parse(
  await readFile(new URL('../../package-lock.json', import.meta.url), 'utf8'),
);
const packages = new Map();

for (const [packagePath, metadata] of Object.entries(lockfile.packages || {})) {
  if (!packagePath.startsWith('node_modules/') || metadata?.dev === true) {
    continue;
  }

  const name = packagePath.slice(packagePath.lastIndexOf('node_modules/') + 'node_modules/'.length);
  const key = `${name}@${metadata?.version || 'unknown'}`;
  packages.set(key, String(metadata?.license || '').trim());
}

const deniedPattern = /(?:AGPL|\bGPL|\bLGPL|SSPL|BUSL|UNLICENSED|PROPRIETARY|SEE LICENSE)/i;
function isDeniedLicense(license) {
  if (!license) {
    return true;
  }

  const alternatives = license.replace(/[()]/g, '').split(/\s+OR\s+/i);
  return alternatives.every((alternative) => deniedPattern.test(alternative));
}

const invalid = Array.from(packages.entries())
  .filter(([, license]) => isDeniedLicense(license))
  .sort(([left], [right]) => left.localeCompare(right));

if (invalid.length > 0) {
  console.error('[license-check] Denied or missing production licenses:');
  invalid.forEach(([name, license]) => console.error(`- ${name}: ${license || 'missing'}`));
  process.exit(1);
}

console.log(`[license-check] OK (${packages.size} locked production packages)`);
