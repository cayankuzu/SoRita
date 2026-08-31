#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const PUBLIC_BUCKET = 'place-media';
const PRIVATE_BUCKET = 'place-media-private';
const APPLY_CONFIRMATION = 'MOVE_PRIVATE_LIST_COVERS';
const DEFAULT_MAXIMUM_ROWS = 100;
const PAGE_SIZE = 50;
const MAXIMUM_OBJECT_BYTES = 150 * 1024 * 1024;
const SAFE_IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/u;
const SAFE_STORAGE_PATH = /^[A-Za-z0-9/_.,-]{1,512}$/u;

function fail(message) {
  throw new Error(message);
}

function hashText(value) {
  return createHash('sha256').update(value).digest('hex');
}

function safeDecodePath(encodedPath) {
  let segments;
  try {
    segments = encodedPath.split('/').map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        segment.includes('/') ||
        segment.includes('\\') ||
        Array.from(segment).some((character) => {
          const codePoint = character.codePointAt(0);
          return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
        }),
    )
  ) {
    return null;
  }
  return segments.join('/');
}

export function parsePublicCoverReference(value, supabaseUrl) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const candidate = value.trim();
  const storagePrefix = `sorita-storage://${PUBLIC_BUCKET}/`;

  if (candidate.startsWith(storagePrefix)) {
    const path = safeDecodePath(candidate.slice(storagePrefix.length));
    return path ? { bucket: PUBLIC_BUCKET, path } : null;
  }

  let url;
  let expectedOrigin;
  try {
    url = new URL(candidate);
    expectedOrigin = new URL(supabaseUrl).origin;
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.origin !== expectedOrigin || url.search || url.hash) return null;

  const publicPrefix = `/storage/v1/object/public/${PUBLIC_BUCKET}/`;
  if (!url.pathname.startsWith(publicPrefix)) return null;
  const path = safeDecodePath(url.pathname.slice(publicPrefix.length));
  return path ? { bucket: PUBLIC_BUCKET, path } : null;
}

function extensionFromPath(path) {
  return path.match(/\.[a-zA-Z0-9]{1,8}$/u)?.[0]?.toLowerCase() ?? '';
}

export function buildPrivateDestination({ listId, ownerId, sourcePath }) {
  if (!SAFE_IDENTIFIER.test(listId) || !SAFE_IDENTIFIER.test(ownerId)) {
    fail('List and owner identifiers are not safe storage path segments');
  }
  const sourceSegments = sourcePath.split('/');
  const canPreserveSourcePath =
    sourceSegments[0] === ownerId &&
    SAFE_STORAGE_PATH.test(sourcePath) &&
    !sourceSegments.some((segment) => segment === '.' || segment === '..');
  const path = canPreserveSourcePath
    ? sourcePath
    : `${ownerId}/lists/${listId}/cover-migrated-${hashText(sourcePath).slice(0, 16)}${extensionFromPath(sourcePath)}`;
  const storageUri = `sorita-storage://${PRIVATE_BUCKET}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
  return { path, storageUri };
}

export function buildPublicCoverReferenceVariants({ original, sourcePath, supabaseUrl }) {
  const encodedPath = sourcePath.split('/').map(encodeURIComponent).join('/');
  return Array.from(new Set([
    original,
    `sorita-storage://${PUBLIC_BUCKET}/${encodedPath}`,
    `${new URL(supabaseUrl).origin}/storage/v1/object/public/${PUBLIC_BUCKET}/${encodedPath}`,
  ].filter((value) => typeof value === 'string' && value.length > 0)));
}

export function parseArguments(argv) {
  const options = { apply: false, maximumRows: DEFAULT_MAXIMUM_ROWS };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--apply') {
      options.apply = true;
      continue;
    }
    if (option === '--max') {
      const value = argv[index + 1];
      index += 1;
      if (!value || !/^\d+$/u.test(value)) fail('--max must be an integer');
      options.maximumRows = Number(value);
      if (options.maximumRows < 1 || options.maximumRows > 1000) {
        fail('--max must be between 1 and 1000');
      }
      continue;
    }
    fail(`Unknown option: ${option}`);
  }
  return options;
}

function requireRuntimeEnvironment(options) {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  const parsedUrl = new URL(supabaseUrl);
  if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password) {
    fail('SUPABASE_URL must be HTTPS without credentials');
  }
  if (options.apply && process.env.SORITA_PRIVATE_COVER_MIGRATION_CONFIRM !== APPLY_CONFIRMATION) {
    fail(`--apply requires SORITA_PRIVATE_COVER_MIGRATION_CONFIRM=${APPLY_CONFIRMATION}`);
  }
  return { serviceRoleKey, supabaseUrl: parsedUrl.origin };
}

async function sha256Blob(blob) {
  return createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex');
}

async function uploadOrVerifyExisting({ client, destinationPath, sourceBlob }) {
  const upload = await client.storage.from(PRIVATE_BUCKET).upload(destinationPath, sourceBlob, {
    cacheControl: '3600',
    contentType: sourceBlob.type || 'application/octet-stream',
    upsert: false,
  });
  if (!upload.error) return { created: true };

  const existing = await client.storage.from(PRIVATE_BUCKET).download(destinationPath);
  if (existing.error || !existing.data) fail('Destination upload failed and no identical object exists');
  if (existing.data.size !== sourceBlob.size) fail('Existing destination object has a different size');
  const [existingHash, sourceHash] = await Promise.all([
    sha256Blob(existing.data),
    sha256Blob(sourceBlob),
  ]);
  if (existingHash !== sourceHash) fail('Existing destination object has different content');
  return { created: false };
}

async function migrateOne({ client, row, source, supabaseUrl }) {
  const destination = buildPrivateDestination({
    listId: row.id,
    ownerId: row.owner_id,
    sourcePath: source.path,
  });
  const downloaded = await client.storage.from(PUBLIC_BUCKET).download(source.path);
  if (downloaded.error || !downloaded.data) fail('Source object could not be downloaded');
  if (downloaded.data.size > MAXIMUM_OBJECT_BYTES) fail('Source object exceeds the migration safety limit');

  const upload = await uploadOrVerifyExisting({
    client,
    destinationPath: destination.path,
    sourceBlob: downloaded.data,
  });
  const updated = await client
    .from('lists')
    .update({ cover_image_url: destination.storageUri })
    .eq('id', row.id)
    .eq('owner_id', row.owner_id)
    .eq('is_public', false)
    .eq('cover_image_url', row.cover_image_url)
    .select('id');
  if (updated.error) {
    if (upload.created) await client.storage.from(PRIVATE_BUCKET).remove([destination.path]);
    fail('Conditional list update failed');
  }
  if (!updated.data || updated.data.length !== 1) {
    if (upload.created) await client.storage.from(PRIVATE_BUCKET).remove([destination.path]);
    return { outcome: 'race_skipped' };
  }

  const remainingReferences = await client
    .from('lists')
    .select('id')
    .in('cover_image_url', buildPublicCoverReferenceVariants({
      original: row.cover_image_url,
      sourcePath: source.path,
      supabaseUrl,
    }))
    .limit(1);
  if (remainingReferences.error) {
    return {
      outcome: 'cleanup_deferred',
      critical: false,
      failure: {
        destinationPath: destination.path,
        listId: row.id,
        originalCover: row.cover_image_url,
        sourcePath: source.path,
      },
    };
  }

  if ((remainingReferences.data ?? []).length > 0) {
    return { outcome: 'shared_source_preserved' };
  }

  const removedSource = await client.storage.from(PUBLIC_BUCKET).remove([source.path]);
  if (!removedSource.error) return { outcome: 'migrated' };

  return {
    outcome: 'cleanup_deferred',
    critical: false,
    failure: {
      destinationPath: destination.path,
      listId: row.id,
      originalCover: row.cover_image_url,
      sourcePath: source.path,
    },
  };
}

function writeFailureJournal(failures) {
  if (failures.length === 0) return null;
  const journalPath = resolve('artifacts/private-cover-migration-failures.json');
  mkdirSync(dirname(journalPath), { recursive: true });
  writeFileSync(journalPath, `${JSON.stringify({ failures }, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600,
  });
  return journalPath.replaceAll('\\', '/');
}

export async function runMigration({ argv = process.argv.slice(2) } = {}) {
  const options = parseArguments(argv);
  const runtime = requireRuntimeEnvironment(options);
  const client = createClient(runtime.supabaseUrl, runtime.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'X-Client-Info': 'sorita-private-cover-migration/1' } },
  });
  const summary = {
    mode: options.apply ? 'apply' : 'dry-run',
    scanned: 0,
    eligible: 0,
    migrated: 0,
    raceSkipped: 0,
    sharedSourcePreserved: 0,
    cleanupDeferred: 0,
    unsupported: 0,
    failures: 0,
    criticalFailures: 0,
    failureJournal: null,
  };
  const failures = [];

  let cursor = null;
  while (summary.scanned < options.maximumRows) {
    const remaining = options.maximumRows - summary.scanned;
    const pageLength = Math.min(PAGE_SIZE, remaining);
    let query = client
      .from('lists')
      .select('id,owner_id,cover_image_url')
      .eq('is_public', false)
      .not('cover_image_url', 'is', null)
      .or(
        'cover_image_url.like.sorita-storage://place-media/*,'
          + 'cover_image_url.like.*/storage/v1/object/public/place-media/*',
      )
      .order('id', { ascending: true })
      .limit(pageLength);
    if (cursor) query = query.gt('id', cursor);
    const result = await query;
    if (result.error) fail('Private-list inventory query failed');
    const rows = result.data ?? [];
    if (rows.length === 0) break;
    cursor = rows.at(-1)?.id ?? cursor;

    for (const row of rows) {
      summary.scanned += 1;
      const source = parsePublicCoverReference(row.cover_image_url, runtime.supabaseUrl);
      if (!source) {
        if (!String(row.cover_image_url).startsWith(`sorita-storage://${PRIVATE_BUCKET}/`)) {
          summary.unsupported += 1;
        }
        continue;
      }
      summary.eligible += 1;
      if (!options.apply) continue;

      try {
        const result = await migrateOne({
          client,
          row,
          source,
          supabaseUrl: runtime.supabaseUrl,
        });
        if (result.outcome === 'migrated') summary.migrated += 1;
        else if (result.outcome === 'race_skipped') summary.raceSkipped += 1;
        else if (result.outcome === 'shared_source_preserved') {
          summary.migrated += 1;
          summary.sharedSourcePreserved += 1;
        }
        else {
          summary.failures += 1;
          summary.cleanupDeferred += 1;
          if (result.critical) summary.criticalFailures += 1;
          failures.push(result.failure);
        }
      } catch {
        summary.failures += 1;
      }
    }
    if (rows.length < pageLength) break;
  }

  summary.failureJournal = writeFailureJournal(failures);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (summary.failures > 0 || summary.unsupported > 0) process.exitCode = 1;
  return summary;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  runMigration().catch((error) => {
    process.stderr.write(`private-cover-migration: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
