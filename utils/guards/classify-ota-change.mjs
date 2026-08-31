#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const OTA_SAFE = 'OTA_SAFE';
export const NATIVE_BUILD_REQUIRED = 'NATIVE_BUILD_REQUIRED';
export const MANUAL_REVIEW_REQUIRED = 'MANUAL_REVIEW_REQUIRED';

const nativeRootFiles = new Set([
  'app.json',
  'eas.json',
  'google-services.json',
  'googleservice-info.plist',
  'package-lock.json',
  'package.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lock',
  'bun.lockb',
  'npm-shrinkwrap.json',
  'credentials.json',
  'expo-env.d.ts',
]);

const nativeRootPrefixes = [
  'app.config.',
  'babel.config.',
  'metro.config.',
  'react-native.config.',
  'sentry.properties',
];

const nativeDirectoryPrefixes = [
  'android/',
  'ios/',
  'windows/',
  'assets/app-icons_background_not_removed/',
  'assets/app-icons_background_removed/',
  'assets/notifications/',
  'assets/splash/',
  'config-plugins/',
  'modules/',
  'node_modules/',
  'patches/',
  'plugins/',
  'vendor/',
];

const nativeCredentialExtensions = [
  '.cer',
  '.jks',
  '.keystore',
  '.mobileprovision',
  '.p12',
  '.p8',
  '.pem',
  '.provisionprofile',
];

const runtimeExtensions = new Set([
  '.avif',
  '.gif',
  '.jpeg',
  '.jpg',
  '.js',
  '.json',
  '.jsx',
  '.lottie',
  '.m4a',
  '.mp3',
  '.mp4',
  '.otf',
  '.png',
  '.svg',
  '.ts',
  '.tsx',
  '.ttf',
  '.wav',
  '.webp',
]);

const supportRootFiles = new Set([
  'tsconfig.tests.json',
  'vitest.config.ts',
  'vitest.setup.ts',
]);

function fileExtension(file) {
  const basename = file.slice(file.lastIndexOf('/') + 1);
  const dotIndex = basename.lastIndexOf('.');
  return dotIndex === -1 ? '' : basename.slice(dotIndex).toLowerCase();
}

function normalizeChangedFile(file) {
  if (typeof file !== 'string' || file.includes('\0')) return undefined;

  const normalized = file.replaceAll('\\', '/').replace(/^\.\/+/, '');
  const segments = normalized.split('/');

  if (
    !normalized ||
    normalized.startsWith('/') ||
    /^[a-z]:\//iu.test(normalized) ||
    segments.includes('..') ||
    segments.includes('')
  ) {
    return undefined;
  }

  return normalized;
}

function isNativeChange(file) {
  const lowerFile = file.toLowerCase();

  return (
    nativeRootFiles.has(lowerFile) ||
    nativeRootPrefixes.some((prefix) => lowerFile.startsWith(prefix)) ||
    nativeDirectoryPrefixes.some((prefix) => lowerFile.startsWith(prefix)) ||
    /^tsconfig(?:\.[^/]+)?\.json$/u.test(lowerFile) ||
    nativeCredentialExtensions.some((extension) => lowerFile.endsWith(extension))
  );
}

function isSupportOnlyChange(file) {
  const lowerFile = file.toLowerCase();

  return (
    supportRootFiles.has(lowerFile) ||
    lowerFile.startsWith('tests/') ||
    lowerFile.startsWith('e2e/') ||
    lowerFile.includes('/__tests__/') ||
    lowerFile.includes('/__mocks__/') ||
    /\.(?:spec|test)\.[cm]?[jt]sx?$/u.test(lowerFile) ||
    lowerFile.endsWith('.d.ts')
  );
}

function isOtaRuntimeChange(file) {
  const lowerFile = file.toLowerCase();

  if (lowerFile === 'app.tsx' || lowerFile === 'index.js') return true;
  if (!lowerFile.startsWith('src/') && !lowerFile.startsWith('assets/runtime/')) return false;

  return runtimeExtensions.has(fileExtension(lowerFile));
}

export function classifyChangedFilesDetailed(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return {
      status: MANUAL_REVIEW_REQUIRED,
      native: [],
      runtime: [],
      support: [],
      unknown: files ?? [],
    };
  }

  const buckets = {
    native: [],
    runtime: [],
    support: [],
    unknown: [],
  };

  for (const candidate of files) {
    const file = normalizeChangedFile(candidate);

    if (!file) {
      buckets.unknown.push(candidate);
    } else if (isNativeChange(file)) {
      buckets.native.push(file);
    } else if (isSupportOnlyChange(file)) {
      buckets.support.push(file);
    } else if (isOtaRuntimeChange(file)) {
      buckets.runtime.push(file);
    } else {
      buckets.unknown.push(file);
    }
  }

  let status = OTA_SAFE;

  if (buckets.native.length) {
    status = NATIVE_BUILD_REQUIRED;
  } else if (buckets.unknown.length || buckets.runtime.length === 0) {
    status = MANUAL_REVIEW_REQUIRED;
  }

  return { status, ...buckets };
}

export function classifyChangedFiles(files) {
  return classifyChangedFilesDetailed(files).status;
}

function isSafeGitRevision(revision) {
  return (
    typeof revision === 'string' &&
    /^[a-z0-9][a-z0-9._/~^{}-]{0,255}$/iu.test(revision) &&
    !revision.includes('..') &&
    !revision.includes('@{')
  );
}

export function collectGitChangedFiles(base, head, cwd = process.cwd()) {
  if (!isSafeGitRevision(base) || !isSafeGitRevision(head)) {
    throw new Error('Both --base and --head must be safe Git revisions.');
  }

  const result = spawnSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACDMRTUXB', '-z', `${base}...${head}`, '--'],
    {
      cwd,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git diff failed with exit code ${result.status ?? 'unknown'}.`);
  }

  return result.stdout.split('\0').filter(Boolean);
}

function parseArguments(argv) {
  const parsed = { base: undefined, head: undefined, files: [], explain: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--explain') {
      parsed.explain = true;
      continue;
    }

    if (argument !== '--base' && argument !== '--head' && argument !== '--file') {
      throw new Error(`Unknown argument: ${argument}`);
    }

    const value = argv[index + 1];
    if (!value) throw new Error(`${argument} requires a value.`);
    index += 1;

    if (argument === '--base') parsed.base = value;
    if (argument === '--head') parsed.head = value;
    if (argument === '--file') parsed.files.push(value);
  }

  const usesRevisions = Boolean(parsed.base || parsed.head);
  if (usesRevisions && (!parsed.base || !parsed.head || parsed.files.length > 0)) {
    throw new Error('Use --base with --head, or one or more --file arguments.');
  }
  if (!usesRevisions && parsed.files.length === 0) {
    throw new Error('No changes supplied. Use --base/--head or --file.');
  }

  return parsed;
}

export function runClassifierCli(argv = process.argv.slice(2)) {
  try {
    const options = parseArguments(argv);
    const files = options.base
      ? collectGitChangedFiles(options.base, options.head)
      : options.files;
    const result = classifyChangedFilesDetailed(files);

    if (options.explain) process.stderr.write(`${JSON.stringify(result)}\n`);
    process.stdout.write(`${result.status}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown classifier failure.';
    process.stderr.write(`[ota-classifier] ${message}\n`);
    process.stdout.write(`${MANUAL_REVIEW_REQUIRED}\n`);
  }
}

const isDirectExecution = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

if (isDirectExecution) runClassifierCli();
