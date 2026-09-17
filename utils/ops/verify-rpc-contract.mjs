#!/usr/bin/env node

// Migrations describe the database the app expects; the deployed project is what
// users actually get. When the two drift, PostgREST answers PGRST202 and a
// feature fails for everyone while every repository check still passes. This
// asks the deployed project, without a session, which functions it can resolve.

import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = fileURLToPath(new URL('../..', import.meta.url));
const migrationsRoot = join(workspace, 'supabase/migrations');
const NULL_UUID = '00000000-0000-0000-0000-000000000000';
const FUNCTION_SIGNATURE_PATTERN =
  /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(([^)]*)\)\s*returns\s+([a-z ]+)/giu;
const DROP_FUNCTION_PATTERN = /drop\s+function\s+(?:if\s+exists\s+)?public\.([a-z0-9_]+)\s*\(/giu;

export function parseParameterNames(rawParameters) {
  return rawParameters
    .split(',')
    .map((parameter) => parameter.trim())
    .filter(Boolean)
    .map((parameter) => parameter.split(/\s+/u)[0])
    .filter((name) => /^[a-z_][a-z0-9_]*$/u.test(name));
}

/** Later migrations win, so a dropped name only counts if something re-creates it. */
export function collectPublicFunctionSignatures(migrationsInOrder) {
  const signatures = new Map();

  for (const migration of migrationsInOrder) {
    const events = [
      ...[...migration.matchAll(FUNCTION_SIGNATURE_PATTERN)]
        // A trigger function is not callable over the API, so its absence there proves nothing.
        .filter((match) => !/^trigger\b/iu.test(match[3].trim()))
        .map((match) => ({
          index: match.index ?? 0,
          name: match[1],
          parameters: parseParameterNames(match[2]),
          creates: true,
        })),
      ...[...migration.matchAll(DROP_FUNCTION_PATTERN)].map((match) => ({
        index: match.index ?? 0,
        name: match[1],
        parameters: [],
        creates: false,
      })),
    ].sort((left, right) => left.index - right.index);

    for (const event of events) {
      if (event.creates) signatures.set(event.name, event.parameters);
      else signatures.delete(event.name);
    }
  }

  return signatures;
}

export function isMissingResponse(status, code) {
  return status === 404 && code === 'PGRST202';
}

async function collectMigrations() {
  const entries = await readdir(migrationsRoot, { withFileTypes: true });
  const paths = entries
    .filter((entry) => entry.isFile() && extname(entry.name) === '.sql')
    .map((entry) => join(migrationsRoot, entry.name))
    .sort();
  return Promise.all(paths.map((path) => readFile(path, 'utf8')));
}

function readPublicEnv() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (the public client values).',
    );
  }

  return { key, url: url.replace(/\/+$/u, '') };
}

async function probeFunction({ key, name, parameters, url }) {
  // Null arguments with no session: every privileged function refuses before it
  // can touch a row, so this resolves names without changing data.
  const body = Object.fromEntries(
    parameters.map((parameter) => [parameter, /uuid|_id$/u.test(parameter) ? NULL_UUID : null]),
  );
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let code;

  try {
    code = JSON.parse(text).code ?? '';
  } catch {
    code = '';
  }

  return { code, missing: isMissingResponse(response.status, code), name, status: response.status };
}

async function main() {
  const { key, url } = readPublicEnv();
  const signatures = collectPublicFunctionSignatures(await collectMigrations());
  const results = [];

  for (const [name, parameters] of signatures) {
    results.push(await probeFunction({ key, name, parameters, url }));
  }

  const missing = results.filter((result) => result.missing);

  for (const result of results) {
    console.log(
      `${result.missing ? 'MISSING' : 'present'} public.${result.name} (http ${result.status}${result.code ? `, ${result.code}` : ''})`,
    );
  }

  if (missing.length > 0) {
    console.error(
      `\n[rpc-contract] ${missing.length} function(s) the migrations define are not deployed: ${missing
        .map((result) => result.name)
        .join(', ')}`,
    );
    process.exit(1);
  }

  console.log(`\n[rpc-contract] OK (${results.length} public functions resolve on the deployed project)`);
}

const isDirectExecution = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

if (isDirectExecution) {
  await main();
}
