import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const acceptedAdvisories = new Map([
  [
    'https://github.com/advisories/GHSA-w3rx-r6r6-pgpr',
    {
      dependency: 'image-size',
      reviewBy: '2026-09-15',
    },
  ],
  [
    'https://github.com/advisories/GHSA-5p2g-fcmc-qvqq',
    {
      dependency: 'image-size',
      reviewBy: '2026-09-15',
    },
  ],
]);

function run(command, args, shell = false) {
  return spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    shell,
  });
}

function runNpm(args) {
  if (process.env.npm_execpath) {
    return run(process.execPath, [process.env.npm_execpath, ...args]);
  }

  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return run(command, args, process.platform === 'win32');
}

function fail(message, details = '') {
  console.error(`[production-audit] ${message}`);
  if (details.trim()) {
    console.error(details.trim());
  }
  process.exit(1);
}

const auditResult = runNpm(['audit', '--omit=dev', '--json']);
let audit;

try {
  audit = JSON.parse(auditResult.stdout);
} catch {
  fail('npm audit did not return valid JSON.', auditResult.stderr || auditResult.stdout);
}

if (audit.error) {
  fail('npm audit could not complete.', JSON.stringify(audit.error));
}

const vulnerabilities = audit.vulnerabilities ?? {};
const advisories = Object.entries(vulnerabilities).flatMap(([dependency, vulnerability]) =>
  (vulnerability.via ?? [])
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({ dependency, ...item })),
);
const unexpectedAdvisories = advisories.filter((advisory) => {
  const acceptance = acceptedAdvisories.get(advisory.url);
  return !acceptance || acceptance.dependency !== advisory.dependency;
});

if (unexpectedAdvisories.length > 0) {
  fail(
    'Unaccepted production advisories found.',
    unexpectedAdvisories
      .map((advisory) => `- ${advisory.severity} ${advisory.dependency}: ${advisory.title} (${advisory.url})`)
      .join('\n'),
  );
}

const activeAcceptedAdvisories = advisories.filter((advisory) => acceptedAdvisories.has(advisory.url));

if (activeAcceptedAdvisories.length > 0) {
  const today = new Date().toISOString().slice(0, 10);
  const expired = activeAcceptedAdvisories.filter(
    (advisory) => today > acceptedAdvisories.get(advisory.url).reviewBy,
  );

  if (expired.length > 0) {
    fail('A temporary advisory acceptance expired; re-evaluate the upstream dependency.');
  }

  const imageSizeVulnerability = vulnerabilities['image-size'];
  if (!imageSizeVulnerability || imageSizeVulnerability.isDirect) {
    fail('The image-size acceptance is valid only for the transitive Metro build dependency.');
  }

  const explanationResult = runNpm(['explain', 'image-size', '--json']);
  let explanation;

  try {
    explanation = JSON.parse(explanationResult.stdout);
  } catch {
    fail('Could not verify the image-size dependency path.', explanationResult.stderr);
  }

  const onlyMetroDependents = explanation.every((entry) =>
    (entry.dependents ?? []).every((dependent) => dependent.from?.name === 'metro'),
  );
  if (!onlyMetroDependents) {
    fail('image-size is no longer isolated to Metro build-time asset processing.');
  }

  const assetGuardResult = run(process.execPath, ['utils/guards/check-metro-assets.mjs']);
  if (assetGuardResult.status !== 0) {
    fail('The Metro asset compensating control failed.', assetGuardResult.stderr || assetGuardResult.stdout);
  }
  process.stdout.write(assetGuardResult.stdout);
}

const counts = audit.metadata?.vulnerabilities ?? {};
console.log(
  `[production-audit] OK (${counts.critical ?? 0} critical, ${counts.high ?? 0} high, ` +
    `${counts.moderate ?? 0} moderate; ${activeAcceptedAdvisories.length} temporary build-only advisories accepted)`,
);
