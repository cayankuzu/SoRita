import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Temporary, time-bounded production advisory acceptances.
//
// Every entry must carry an owner, a reason the fix is not simply applied, an
// honest exploitability assessment and an expiry. The guard below rejects any
// acceptance that omits one of these, so an advisory cannot be silenced by
// adding a bare URL.
const acceptedAdvisories = new Map([
  [
    'https://github.com/advisories/GHSA-vcc3-ghjq-m6fr',
    {
      dependency: 'decode-uri-component',
      owner: 'mobile-platform',
      reason:
        'Only decode-uri-component 0.5.0 leaves the vulnerable range, and it is ESM-only while its consumer query-string@7 is CommonJS and calls require(). Forcing it breaks deep-link parsing at runtime. The supported fix is a React Navigation major upgrade, which needs a new native binary and is out of scope for a hardening pass.',
      exploitability:
        'Local denial of service only. Requires the user to open a crafted sorita:// deep link; worst case is CPU exhaustion in the user own app process, recovered by relaunch. No data disclosure, no privilege escalation, no cross-user or server impact. The linking config exposes four routes behind a single custom scheme.',
      reviewBy: '2026-12-01',
    },
  ],
]);

const REQUIRED_ACCEPTANCE_FIELDS = ['dependency', 'owner', 'reason', 'exploitability', 'reviewBy'];

for (const [url, acceptance] of acceptedAdvisories) {
  for (const field of REQUIRED_ACCEPTANCE_FIELDS) {
    if (typeof acceptance[field] !== 'string' || acceptance[field].trim() === '') {
      console.error(`[production-audit] Acceptance ${url} is missing ${field}.`);
      process.exit(1);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(acceptance.reviewBy)) {
    console.error(`[production-audit] Acceptance ${url} has an invalid reviewBy date.`);
    process.exit(1);
  }
}

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

// `npm audit` needs the registry advisory API. A transient registry problem
// returns an empty error object after a long stall, which previously failed the
// release gate with no usable detail. Retry a bounded number of times so a blip
// does not read as a vulnerability finding, but never treat an unreachable
// registry as a pass: exhausting the retries still fails closed.
function runAuditWithRetries(attempts = 3) {
  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = runNpm(['audit', '--omit=dev', '--json']);
    let parsed;
    try {
      parsed = JSON.parse(result.stdout);
    } catch {
      parsed = null;
    }
    if (parsed && !parsed.error) return parsed;
    last = { parsed, result };
    if (attempt < attempts) {
      const waitMs = 5_000 * attempt;
      console.warn(
        `[production-audit] audit attempt ${attempt} of ${attempts} did not complete; retrying in ${waitMs / 1000}s.`,
      );
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
    }
  }
  if (!last.parsed) {
    fail(
      'npm audit did not return valid JSON after retries.',
      last.result.stderr || last.result.stdout,
    );
  }
  fail(
    'npm audit could not complete after retries; the registry advisory API was unreachable.',
    JSON.stringify(last.parsed.error),
  );
  return null;
}

const audit = runAuditWithRetries();

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
const activeAcceptedDependencies = new Set(
  activeAcceptedAdvisories.map((advisory) => advisory.dependency),
);

if (activeAcceptedAdvisories.length > 0) {
  const today = new Date().toISOString().slice(0, 10);
  const expired = activeAcceptedAdvisories.filter(
    (advisory) => today > acceptedAdvisories.get(advisory.url).reviewBy,
  );

  if (expired.length > 0) {
    fail('A temporary advisory acceptance expired; re-evaluate the upstream dependency.');
  }
}

// Compensating controls run only for the dependencies that are actually still
// vulnerable. Scoping them this way means resolving one advisory cannot make an
// unrelated control fail, and a control cannot be skipped while its advisory is
// still live.
function assertTransitiveOnly(dependencyName, expectedParents) {
  const vulnerability = vulnerabilities[dependencyName];
  if (!vulnerability || vulnerability.isDirect) {
    fail(`The ${dependencyName} acceptance is valid only for a transitive dependency.`);
  }

  const explanationResult = runNpm(['explain', dependencyName, '--json']);
  let explanation;

  try {
    explanation = JSON.parse(explanationResult.stdout);
  } catch {
    fail(`Could not verify the ${dependencyName} dependency path.`, explanationResult.stderr);
  }

  const onlyExpectedDependents = explanation.every((entry) =>
    (entry.dependents ?? []).every((dependent) => expectedParents.includes(dependent.from?.name)),
  );
  if (!onlyExpectedDependents) {
    fail(
      `${dependencyName} is no longer isolated to ${expectedParents.join(', ')}; re-evaluate the acceptance.`,
    );
  }
}

if (activeAcceptedDependencies.has('image-size')) {
  assertTransitiveOnly('image-size', ['metro']);

  const assetGuardResult = run(process.execPath, ['utils/guards/check-metro-assets.mjs']);
  if (assetGuardResult.status !== 0) {
    fail('The Metro asset compensating control failed.', assetGuardResult.stderr || assetGuardResult.stdout);
  }
  process.stdout.write(assetGuardResult.stdout);
}

if (activeAcceptedDependencies.has('decode-uri-component')) {
  // The accepted exposure is deep-link query parsing reached through
  // query-string. If it becomes reachable from anywhere else, the exploitability
  // assessment no longer holds and the acceptance must be re-reviewed.
  assertTransitiveOnly('decode-uri-component', ['query-string']);
}

const counts = audit.metadata?.vulnerabilities ?? {};
console.log(
  `[production-audit] OK (${counts.critical ?? 0} critical, ${counts.high ?? 0} high, ` +
    `${counts.moderate ?? 0} moderate; ${activeAcceptedAdvisories.length} time-bounded advisory acceptances active)`,
);
