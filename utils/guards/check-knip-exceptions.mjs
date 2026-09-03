#!/usr/bin/env node

// Justifies every knip dependency exception.
//
// `ignoreDependencies` silences a real analysis. Left unattended it becomes a
// dumping ground that hides genuine dead dependencies, so every entry must be
// classified here and must still satisfy the evidence for its class. Adding an
// undocumented entry fails this guard.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const read = (relativePath) =>
  readFileSync(path.join(repositoryRoot, relativePath), 'utf8');

const readJson = (relativePath) => JSON.parse(read(relativePath));

const ROOT_MANIFEST = 'package.json';
const WORKSPACE_MANIFESTS = ['infra/cloudflare/sorita-edge/package.json'];

// Import specifiers that are protocols or virtual modules rather than packages.
// These can never appear in any manifest, so knip cannot resolve them.
const PROTOCOL_SPECIFIERS = new Map([
  [
    'npm',
    {
      reason: 'Deno npm: specifier used by Supabase Edge Functions',
      evidence: {
        files: ['supabase/functions/delete-user/index.ts'],
        pattern: /['"]npm:/u,
      },
    },
  ],
  [
    'cloudflare',
    {
      reason: 'cloudflare:test virtual module from @cloudflare/vitest-plugin',
      evidence: {
        files: ['infra/cloudflare/sorita-edge/test/security.test.ts'],
        pattern: /['"]cloudflare:/u,
      },
    },
  ],
]);

// Declared in a workspace manifest other than the root one, so the root knip
// project cannot see the declaration.
const WORKSPACE_DECLARED = new Set(['jose']);

// Declared at the root but referenced from build or app configuration rather
// than from a JS import, so knip's import graph cannot reach them.
const CONFIG_CONSUMED = new Map([
  [
    'babel-plugin-module-resolver',
    {
      reason: 'Registered by name in the Babel config',
      evidence: [
        {
          file: 'babel.config.cjs',
          pattern: /['"]module-resolver['"]/u,
          description: 'Babel config registers the module-resolver plugin',
        },
      ],
    },
  ],
  [
    'expo-updates',
    {
      // Zero JS imports exist anywhere in the tree. The package is consumed by
      // the Expo config `updates` / `runtimeVersion` blocks and by the Android
      // native manifest, and is auto-linked at build time. Knip's Expo plugin
      // could only resolve it when `app.config.ts` evaluated with an updates
      // URL present, so the gate silently flipped on whether a `.env` happened
      // to exist. Pinning the exception makes it deterministic in CI and local.
      // Owner: release-engineering.
      // Remove when: the package gains a real JS import, or OTA is retired.
      reason: 'Consumed by Expo config and the Android native manifest',
      evidence: [
        {
          file: 'app.config.ts',
          pattern: /^\s*updates:\s*\{/mu,
          description: 'Expo config declares an updates block',
        },
        {
          file: 'app.config.ts',
          pattern: /^\s*runtimeVersion:\s*\{/mu,
          description: 'Expo config declares a runtimeVersion policy',
        },
        {
          file: 'android/app/src/main/AndroidManifest.xml',
          pattern: /expo\.modules\.updates\.ENABLED/u,
          description: 'Android manifest enables the updates module',
        },
        {
          file: 'android/app/src/main/AndroidManifest.xml',
          pattern: /expo\.modules\.updates\.EXPO_UPDATE_URL/u,
          description: 'Android manifest declares the update URL',
        },
      ],
    },
  ],
]);

// Declared at the root and linked into the native build without a JS import.
// Removing them from package.json would break the native build even though no
// TypeScript file references them.
const NATIVE_AUTOLINKED = new Set([
  '@react-native-community/datetimepicker',
  'expo-video-thumbnails',
]);

function declaredIn(manifestPath, name) {
  if (!existsSync(path.join(repositoryRoot, manifestPath))) return false;
  const manifest = readJson(manifestPath);
  return Boolean(
    (manifest.dependencies ?? {})[name] ?? (manifest.devDependencies ?? {})[name],
  );
}

export function collectViolations() {
  const violations = [];
  const knip = readJson('knip.json');
  const ignored = knip.ignoreDependencies ?? [];

  // The analysis itself must stay on. Silencing one package is acceptable;
  // silencing the whole check is not.
  for (const field of ['ignore', 'ignoreExportsUsedInFile', 'ignoreWorkspaces']) {
    if (knip[field]) {
      violations.push(`knip.json must not set ${field}; it disables analysis wholesale`);
    }
  }

  const classified = new Set([
    ...PROTOCOL_SPECIFIERS.keys(),
    ...WORKSPACE_DECLARED,
    ...CONFIG_CONSUMED.keys(),
    ...NATIVE_AUTOLINKED,
  ]);

  for (const name of ignored) {
    if (!classified.has(name)) {
      violations.push(
        `undocumented knip exception: ${name} must be classified in check-knip-exceptions.mjs with its evidence`,
      );
    }
  }

  for (const name of classified) {
    if (!ignored.includes(name)) {
      violations.push(
        `${name} is classified as an exception but is missing from knip.json ignoreDependencies`,
      );
    }
  }

  for (const [name, { reason, evidence }] of PROTOCOL_SPECIFIERS) {
    if (declaredIn(ROOT_MANIFEST, name)) {
      violations.push(
        `${name} is now a real declared dependency; remove its protocol-specifier exception (${reason})`,
      );
    }
    const found = evidence.files.some((file) => {
      if (!existsSync(path.join(repositoryRoot, file))) return false;
      return evidence.pattern.test(read(file));
    });
    if (!found) {
      violations.push(
        `${name} exception is no longer justified: no ${reason} reference found`,
      );
    }
  }

  for (const name of WORKSPACE_DECLARED) {
    const found = WORKSPACE_MANIFESTS.some((manifest) => declaredIn(manifest, name));
    if (!found) {
      violations.push(
        `stale knip exception: ${name} is no longer declared in any workspace manifest`,
      );
    }
  }

  for (const [name, { evidence }] of CONFIG_CONSUMED) {
    if (!declaredIn(ROOT_MANIFEST, name)) {
      violations.push(
        `stale knip exception: ${name} is ignored but is no longer a root dependency`,
      );
      continue;
    }
    for (const { file, pattern, description } of evidence) {
      if (!existsSync(path.join(repositoryRoot, file))) {
        violations.push(`${name} justification cannot read ${file}`);
        continue;
      }
      if (!pattern.test(read(file))) {
        violations.push(
          `${name} exception is no longer justified: ${description} (${file})`,
        );
      }
    }
  }

  for (const name of NATIVE_AUTOLINKED) {
    if (!declaredIn(ROOT_MANIFEST, name)) {
      violations.push(
        `stale knip exception: ${name} is ignored but is no longer a root dependency`,
      );
    }
  }

  return violations;
}

function main() {
  const violations = collectViolations();
  if (violations.length > 0) {
    console.error(`[knip-exceptions] Failed:\n- ${violations.join('\n- ')}`);
    process.exit(1);
  }
  const knip = readJson('knip.json');
  console.log(
    `[knip-exceptions] OK (${knip.ignoreDependencies.length} exceptions, all classified and evidenced)`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
