#!/usr/bin/env node

// The app reaches the database through named RPCs. When a migration stops
// exposing one in the public schema, PostgREST answers PGRST202 and the feature
// fails only in production, for every user. This gate compares the two sides.

import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = fileURLToPath(new URL('../..', import.meta.url));
const sourceRoot = join(workspace, 'src');
const migrationsRoot = join(workspace, 'supabase/migrations');
const RPC_CALL_PATTERN = /\.rpc\(\s*'([a-z0-9_]+)'/gu;
const PUBLIC_FUNCTION_PATTERN =
  /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(/giu;
const DROP_FUNCTION_PATTERN = /drop\s+function\s+(?:if\s+exists\s+)?public\.([a-z0-9_]+)\s*\(/giu;

async function collectFiles(directory, extensions) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return collectFiles(path, extensions);
      return extensions.includes(extname(entry.name)) ? [path] : [];
    }),
  );
  return files.flat();
}

export function collectCalledRpcNames(sources) {
  const names = new Set();

  for (const source of sources) {
    for (const match of source.matchAll(RPC_CALL_PATTERN)) {
      names.add(match[1]);
    }
  }

  return names;
}

/** Later migrations win, so a name dropped after its last definition is gone. */
export function collectExposedRpcNames(migrationsInOrder) {
  const exposed = new Set();

  for (const migration of migrationsInOrder) {
    const events = [
      ...[...migration.matchAll(PUBLIC_FUNCTION_PATTERN)].map((match) => ({
        index: match.index ?? 0,
        name: match[1],
        exposes: true,
      })),
      ...[...migration.matchAll(DROP_FUNCTION_PATTERN)].map((match) => ({
        index: match.index ?? 0,
        name: match[1],
        exposes: false,
      })),
    ].sort((left, right) => left.index - right.index);

    for (const event of events) {
      if (event.exposes) exposed.add(event.name);
      else exposed.delete(event.name);
    }
  }

  return exposed;
}

export function findUnexposedRpcNames(called, exposed) {
  return [...called].filter((name) => !exposed.has(name)).sort();
}

async function main() {
  const [sourcePaths, migrationPaths] = await Promise.all([
    collectFiles(sourceRoot, ['.ts', '.tsx']),
    collectFiles(migrationsRoot, ['.sql']),
  ]);
  const sources = await Promise.all(
    sourcePaths
      .filter((path) => !/(?:__tests__|\.test\.tsx?$)/u.test(path))
      .map((path) => readFile(path, 'utf8')),
  );
  const migrations = await Promise.all(
    migrationPaths.sort().map((path) => readFile(path, 'utf8')),
  );

  const called = collectCalledRpcNames(sources);
  const exposed = collectExposedRpcNames(migrations);
  const missing = findUnexposedRpcNames(called, exposed);

  if (missing.length > 0) {
    console.error('[rpc-contract] The app calls database functions no migration exposes:');
    for (const name of missing) console.error(`- public.${name}`);
    console.error('Add the public function (or wrapper) in a migration, or stop calling it.');
    process.exit(1);
  }

  console.log(`[rpc-contract] OK (${called.size} app RPCs, all exposed by migrations)`);
}

const isDirectExecution = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

if (isDirectExecution) {
  await main();
}
