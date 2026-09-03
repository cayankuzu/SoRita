#!/usr/bin/env node

// Fail-closed UTF-8 and mojibake guard.
//
// The product ships Turkish copy, so text corruption is a realistic and
// user-visible defect rather than a theoretical one. The three failure modes
// this catches are:
//
//   1. Bytes that are not valid UTF-8 at all.
//   2. U+FFFD, which means a decoder already gave up on this text.
//   3. Mojibake, where UTF-8 bytes were decoded as Latin-1 and re-encoded, so
//      "ü" becomes "Ã¼" and "ı" becomes "Ä±".
//
// Legitimate Turkish characters are untouched by all three checks.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.json', '.md', '.sql']);
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.expo',
  '.wrangler',
  'coverage',
  'android',
  'ios',
  'dist',
  'build',
]);

// A leading byte of a multi-byte UTF-8 sequence, decoded as Latin-1, followed by
// a continuation byte decoded the same way. This pair does not occur in
// correctly encoded Turkish or English prose.
const MOJIBAKE_PATTERN = /[Â-ÅÐÑ][-¿]/u;
const REPLACEMENT_CHARACTER = '�';

export function inspectText(text) {
  const problems = [];
  const lines = text.split(/\r?\n/u);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (line.includes(REPLACEMENT_CHARACTER)) {
      problems.push({ lineNumber, reason: 'Unicode replacement character' });
    }
    const mojibake = MOJIBAKE_PATTERN.exec(line);
    if (mojibake) {
      problems.push({
        lineNumber,
        reason: `mojibake sequence ${JSON.stringify(mojibake[0])}`,
      });
    }
  });

  return problems;
}

export function inspectBuffer(buffer) {
  // Strict decoding throws on malformed byte sequences.
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return [{ lineNumber: 0, reason: 'file is not valid UTF-8' }];
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return [{ lineNumber: 1, reason: 'UTF-8 byte order mark' }];
  }
  return inspectText(text);
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') && entry.name !== '.github') return [];
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED_DIRECTORIES.has(entry.name) ? [] : walk(entryPath);
    }
    return SCANNED_EXTENSIONS.has(path.extname(entry.name)) ? [entryPath] : [];
  });
}

function main() {
  const targets = process.argv.slice(2);
  const files =
    targets.length > 0
      ? targets
          .map((target) => path.resolve(repositoryRoot, target))
          .filter((target) => statSync(target).isFile())
      : walk(repositoryRoot);

  const violations = [];
  for (const filePath of files) {
    const relativePath = path
      .relative(repositoryRoot, filePath)
      .replaceAll('\\', '/');
    for (const problem of inspectBuffer(readFileSync(filePath))) {
      violations.push(`${relativePath}:${problem.lineNumber} ${problem.reason}`);
    }
  }

  if (violations.length > 0) {
    console.error(`[text-encoding] Failed:\n- ${violations.join('\n- ')}`);
    process.exit(1);
  }

  console.log(`[text-encoding] OK (${files.length} files, valid UTF-8, no mojibake)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
