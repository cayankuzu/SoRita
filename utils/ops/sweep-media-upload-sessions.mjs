#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const APPLY_CONFIRMATION = 'SWEEP_STALE_MEDIA_UPLOADS';
const DEFAULT_LIMIT = 100;
const DEFAULT_MAX_BATCHES = 10;

function fail(message) {
  throw new Error(message);
}

export function parseArguments(argv) {
  const options = {
    apply: false,
    limit: DEFAULT_LIMIT,
    maxBatches: DEFAULT_MAX_BATCHES,
    pruneBefore: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--apply') {
      options.apply = true;
      continue;
    }
    if (option === '--limit' || option === '--max-batches' || option === '--prune-before') {
      const value = argv[index + 1];
      index += 1;
      if (!value) fail(`Missing value for ${option}`);
      if (option === '--prune-before') {
        if (!Number.isFinite(Date.parse(value))) fail('--prune-before must be an ISO timestamp');
        options.pruneBefore = new Date(value).toISOString();
        continue;
      }
      if (!/^\d+$/u.test(value)) fail(`${option} must be an integer`);
      const parsed = Number(value);
      if (option === '--limit') {
        if (parsed < 1 || parsed > 500) fail('--limit must be between 1 and 500');
        options.limit = parsed;
      } else {
        if (parsed < 1 || parsed > 100) fail('--max-batches must be between 1 and 100');
        options.maxBatches = parsed;
      }
      continue;
    }
    fail(`Unknown option: ${option}`);
  }

  return options;
}

export function requireRuntimeEnvironment(options, environment = process.env) {
  const supabaseUrl = environment.SUPABASE_URL?.trim();
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  const parsedUrl = new URL(supabaseUrl);
  if (
    parsedUrl.protocol !== 'https:'
    || parsedUrl.username
    || parsedUrl.password
    || parsedUrl.pathname !== '/'
    || parsedUrl.search
    || parsedUrl.hash
  ) {
    fail('SUPABASE_URL must be a bare HTTPS origin');
  }
  if (
    options.apply
    && environment.SORITA_MEDIA_SWEEP_CONFIRM !== APPLY_CONFIRMATION
  ) {
    fail(`--apply requires SORITA_MEDIA_SWEEP_CONFIRM=${APPLY_CONFIRMATION}`);
  }
  return { serviceRoleKey, supabaseUrl: parsedUrl.origin };
}

function normalizeRows(data, operation) {
  if (!Array.isArray(data)) fail(`${operation} returned an invalid response`);
  return data;
}

async function removeSessionObjects(client, row) {
  const pathsAreIdentical =
    row.destination_bucket === row.upload_bucket
    && row.destination_path === row.upload_path;
  const removals = [];
  if (!pathsAreIdentical || row.delete_destination === true) {
    removals.push({ bucket: row.upload_bucket, path: row.upload_path });
  }
  if (row.delete_destination === true && !pathsAreIdentical) {
    removals.push({ bucket: row.destination_bucket, path: row.destination_path });
  }

  for (const removal of removals) {
    const { error } = await client.storage.from(removal.bucket).remove([removal.path]);
    if (error) return error;
  }
  return null;
}

async function recordCleanup(client, row, leaseId, cleanupError) {
  const { data, error } = await client.rpc('complete_media_upload_session_cleanup', {
    p_automatic: true,
    p_destination_retained:
      row.previous_status === 'finalized'
      && row.destination_referenced === true
      && row.delete_destination !== true,
    p_error: cleanupError?.message ?? null,
    p_lease_id: leaseId,
    p_session_id: row.session_id,
    p_success: !cleanupError,
  });
  if (error || data !== true) {
    return error ?? new Error('cleanup result was not recorded');
  }
  return cleanupError;
}

async function refreshCleanupDecision(client, row, leaseId) {
  const renewal = await client.rpc('renew_media_upload_session_cleanup', {
    p_lease_id: leaseId,
    p_lease_seconds: 300,
    p_session_id: row.session_id,
  });
  if (renewal.error || renewal.data !== true) {
    throw renewal.error ?? new Error('cleanup lease could not be renewed');
  }

  const referenceCheck = await client.rpc('check_media_upload_session_cleanup_reference', {
    p_allow_unreferenced_destination_delete: false,
    p_lease_id: leaseId,
    p_session_id: row.session_id,
  });
  if (referenceCheck.error) throw referenceCheck.error;
  const decision = normalizeRows(referenceCheck.data, 'cleanup reference check')[0];
  if (
    !decision
    || typeof decision.destination_referenced !== 'boolean'
    || typeof decision.delete_destination !== 'boolean'
    || typeof decision.previous_status !== 'string'
  ) {
    fail('cleanup reference check returned an invalid response');
  }
  return { ...row, ...decision };
}

export async function runMediaUploadSweep({ client, options }) {
  if (!options.apply) {
    const { data, error } = await client.rpc('list_stale_media_upload_sessions', {
      p_limit: options.limit,
    });
    if (error) throw error;
    const rows = normalizeRows(data, 'stale upload inventory');
    return {
      dryRun: true,
      eligible: rows.length,
      destinationDeletes: rows.filter((row) => row.delete_destination === true).length,
      referencedDestinations: rows.filter((row) => row.destination_referenced === true).length,
    };
  }

  let claimed = 0;
  let cleaned = 0;
  let failed = 0;
  let batches = 0;

  for (; batches < options.maxBatches; batches += 1) {
    const leaseId = randomUUID();
    const { data, error } = await client.rpc('claim_stale_media_upload_sessions', {
      p_lease_id: leaseId,
      p_lease_seconds: 300,
      p_limit: options.limit,
    });
    if (error) throw error;
    const rows = normalizeRows(data, 'stale upload claim');
    if (rows.length === 0) break;
    claimed += rows.length;

    for (const row of rows) {
      let currentRow = row;
      let cleanupError;
      try {
        currentRow = await refreshCleanupDecision(client, row, leaseId);
        cleanupError = await removeSessionObjects(client, currentRow);
      } catch (error) {
        cleanupError = error instanceof Error ? error : new Error(String(error));
      }
      const finalError = await recordCleanup(client, currentRow, leaseId, cleanupError);
      if (finalError) failed += 1;
      else cleaned += 1;
    }

    if (rows.length < options.limit) {
      batches += 1;
      break;
    }
  }

  let pruned = 0;
  if (options.pruneBefore) {
    const { data, error } = await client.rpc('prune_media_upload_sessions', {
      p_before: options.pruneBefore,
      p_limit: Math.min(options.limit, 500),
    });
    if (error) throw error;
    if (!Number.isInteger(data) || data < 0) fail('media upload prune returned an invalid count');
    pruned = data;
  }

  return { batches, claimed, cleaned, dryRun: false, failed, pruned };
}

export async function main(argv = process.argv.slice(2), environment = process.env) {
  const options = parseArguments(argv);
  const runtime = requireRuntimeEnvironment(options, environment);
  const client = createClient(runtime.supabaseUrl, runtime.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const result = await runMediaUploadSweep({ client, options });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.dryRun && result.failed > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
