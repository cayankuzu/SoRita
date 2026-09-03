#!/usr/bin/env node

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const APPLY_CONFIRMATION = 'REQUEUE_PUSH_DELIVERY_DLQ';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function fail(message) {
  throw new Error(message);
}

function readValue(argv, flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1]?.trim() || null : null;
}

function requireUuid(value, flag) {
  if (!value || !UUID_PATTERN.test(value)) {
    fail(`${flag} bir UUID olmalidir.`);
  }
  return value.toLowerCase();
}

export function parsePushDeliveryDlqArguments(argv) {
  const [command = 'health'] = argv;

  if (!['health', 'requeue'].includes(command)) {
    fail('Kullanim: health | requeue');
  }

  if (command === 'health') {
    if (argv.length !== 1) {
      fail('health ek parametre kabul etmez.');
    }
    return { command: 'health' };
  }

  const deadLetterId = requireUuid(readValue(argv, '--dead-letter-id'), '--dead-letter-id');
  const requeueKey = requireUuid(readValue(argv, '--requeue-key'), '--requeue-key');

  if (readValue(argv, '--confirm') !== APPLY_CONFIRMATION) {
    fail(`requeue requires --confirm ${APPLY_CONFIRMATION}`);
  }

  return { command: 'requeue', deadLetterId, requeueKey };
}

export function requirePushDeliveryDlqRuntime(environment = process.env) {
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

  return { serviceRoleKey, supabaseUrl: parsedUrl.origin };
}

function normalizeHealth(data) {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== 'object') {
    fail('push delivery health returned an invalid response');
  }

  const candidate = row;
  if (
    typeof candidate.scheduler_mode !== 'string'
    || typeof candidate.healthy !== 'boolean'
    || !Number.isInteger(Number(candidate.pending_job_count))
    || !Number.isInteger(Number(candidate.dead_letter_count))
  ) {
    fail('push delivery health returned an invalid response');
  }

  return {
    deadLetterCount: Number(candidate.dead_letter_count),
    healthy: candidate.healthy,
    lastCompletedAt: typeof candidate.last_completed_at === 'string'
      ? candidate.last_completed_at
      : null,
    pendingJobCount: Number(candidate.pending_job_count),
    schedulerMode: candidate.scheduler_mode,
  };
}

export async function runPushDeliveryDlqCommand(options, client) {
  if (options.command === 'health') {
    const { data, error } = await client.rpc('get_push_delivery_scheduler_health');
    if (error) throw error;
    return { command: 'health', ...normalizeHealth(data) };
  }

  const { data, error } = await client.rpc('requeue_push_delivery_dead_letter', {
    p_dead_letter_id: options.deadLetterId,
    p_requeue_key: options.requeueKey,
  });
  if (error) throw error;
  if (typeof data !== 'boolean') fail('push delivery requeue returned an invalid response');

  return { command: 'requeue', requeued: data };
}

export async function main(argv = process.argv.slice(2), environment = process.env) {
  const options = parsePushDeliveryDlqArguments(argv);
  const runtime = requirePushDeliveryDlqRuntime(environment);
  const client = createClient(runtime.supabaseUrl, runtime.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const result = await runPushDeliveryDlqCommand(options, client);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.command === 'health' && !result.healthy) {
    process.exitCode = 2;
  }
  if (result.command === 'requeue' && !result.requeued) {
    process.exitCode = 3;
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
