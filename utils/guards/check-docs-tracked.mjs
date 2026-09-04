#!/usr/bin/env node

// Fails when a documentation or evidence file is silently excluded from git.
//
// `.gitignore` denies `docs/*` and re-includes each document by name. That is a
// reasonable way to keep scratch notes out of the repository, but it fails
// silently in the dangerous direction: a newly written document is ignored, so
// `git add -A` skips it, the commit looks clean, and the file only exists on one
// machine. This already happened once, to fifteen files, including documents
// other committed documents link to.
//
// The same allowlist-shaped mistake previously broke the Docker build context,
// so it is worth a gate rather than vigilance.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

// Directories whose contents are deliverables and must be committed.
const TRACKED_ROOTS = ['docs', 'quality', 'release-evidence'];
const TRACKED_EXTENSIONS = new Set(['.md', '.json']);

function collect(directory) {
  const absolute = path.join(repositoryRoot, directory);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return collect(relative);
    return TRACKED_EXTENSIONS.has(path.extname(entry.name)) ? [relative] : [];
  });
}

function ignoredPaths(candidates) {
  if (candidates.length === 0) return [];
  // check-ignore exits 1 when nothing matches, which is the healthy case.
  try {
    const output = execFileSync('git', ['check-ignore', '--', ...candidates], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });
    return output.split(/\r?\n/u).filter(Boolean);
  } catch (error) {
    if (error.status === 1) return [];
    throw error;
  }
}

function untrackedPaths(candidates) {
  const output = execFileSync(
    'git',
    ['ls-files', '--others', '--exclude-standard', '--', ...TRACKED_ROOTS],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  const untracked = new Set(output.split(/\r?\n/u).filter(Boolean));
  return candidates.filter((candidate) => untracked.has(candidate));
}

function main() {
  const candidates = TRACKED_ROOTS.flatMap((root) => collect(root)).map((entry) =>
    entry.replaceAll('\\', '/'),
  );
  if (candidates.length === 0) {
    console.error('[docs-tracked] Failed: no documentation files were found to check.');
    process.exit(1);
  }

  const violations = [];
  for (const ignored of ignoredPaths(candidates)) {
    violations.push(`${ignored} is git-ignored; add a "!" allowlist entry in .gitignore`);
  }
  for (const untracked of untrackedPaths(candidates)) {
    violations.push(`${untracked} is untracked; commit it or delete it`);
  }

  if (violations.length > 0) {
    console.error(`[docs-tracked] Failed:\n- ${violations.join('\n- ')}`);
    process.exit(1);
  }

  console.log(`[docs-tracked] OK (${candidates.length} documentation and evidence files tracked)`);
}

main();
