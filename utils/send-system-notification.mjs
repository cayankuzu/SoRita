#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { config as loadEnv } from 'dotenv';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function getArgValue(argv, flagNames) {
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (!flagNames.includes(current)) {
      continue;
    }

    return argv[index + 1] ?? null;
  }

  return null;
}

function getArgValues(argv, flagNames) {
  const values = [];

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (!flagNames.includes(current)) {
      continue;
    }

    const nextValue = argv[index + 1];

    if (nextValue) {
      values.push(nextValue);
    }
  }

  return values;
}

function hasFlag(argv, flagName) {
  return argv.includes(flagName);
}

function fail(message) {
  throw new Error(message);
}

export function parseBroadcastArguments(argv, createId = randomUUID) {
  const title = getArgValue(argv, ['--title'])?.trim();
  const message = getArgValue(argv, ['--message', '--body'])?.trim();
  const userIds = getArgValues(argv, ['--user-id']).map((userId) => userId.trim()).filter(Boolean);
  const dryRun = hasFlag(argv, '--dry-run');
  const retry = hasFlag(argv, '--retry');
  const providedIdempotencyKey = getArgValue(argv, ['--idempotency-key'])?.trim() || null;

  if (!title || !message) {
    fail('Kullanim: --title ve --message zorunludur.');
  }

  if (retry && !providedIdempotencyKey) {
    fail('--retry mevcut bir --idempotency-key gerektirir.');
  }

  const idempotencyKey = providedIdempotencyKey ?? createId();

  if (!UUID_PATTERN.test(idempotencyKey)) {
    fail('--idempotency-key bir UUID olmalidir.');
  }

  return {
    dryRun,
    idempotencyKey: idempotencyKey.toLowerCase(),
    message,
    retry,
    title,
    userIds: Array.from(new Set(userIds)),
  };
}

export function resolveBroadcastRuntime(environment = process.env) {
  const supabaseUrl = environment.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = environment.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const adminToken = environment.SYSTEM_BROADCAST_ADMIN_TOKEN?.trim();

  if (!supabaseUrl) {
    fail('EXPO_PUBLIC_SUPABASE_URL tanimli degil.');
  }

  if (!adminToken) {
    fail('SYSTEM_BROADCAST_ADMIN_TOKEN tanimli degil.');
  }

  const parsedUrl = new URL(supabaseUrl);
  if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password) {
    fail('EXPO_PUBLIC_SUPABASE_URL HTTPS bir origin olmalidir.');
  }

  return {
    adminToken,
    publishableKey,
    supabaseUrl: parsedUrl.origin,
  };
}

export async function runBroadcastNotification(options, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const createId = dependencies.createId ?? randomUUID;
  const writeError = dependencies.writeError ?? ((line) => process.stderr.write(`${line}\n`));
  const writeOutput = dependencies.writeOutput ?? ((line) => process.stdout.write(`${line}\n`));
  const runtime = dependencies.runtime ?? resolveBroadcastRuntime(dependencies.environment);

  const requestBody = {
    dryRun: options.dryRun,
    idempotencyKey: options.idempotencyKey,
    message: options.message,
    title: options.title,
    ...(options.userIds.length > 0 ? { userIds: options.userIds } : {}),
  };

  // Print before the request, including a failing/ambiguous network outcome.
  // Operators must copy this exact key and add --retry on every retry.
  writeOutput(`[SoRita][push] Idempotency anahtari (saklayin): ${options.idempotencyKey}`);

  let response;
  try {
    response = await fetchImpl(
      `${runtime.supabaseUrl}/functions/v1/admin-broadcast-notification`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(runtime.publishableKey ? { apikey: runtime.publishableKey } : {}),
          'x-admin-token': runtime.adminToken,
          'x-request-id': createId(),
        },
        body: JSON.stringify(requestBody),
      },
    );
  } catch {
    writeError('[SoRita][push] Iletim sonucu belirsiz. Ayni anahtar ile --retry kullanin.');
    return { outcome: 'ambiguous_network_failure', success: false };
  }

  const responseText = await response.text();
  let payload = null;

  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    // Responses are not echoed: an intermediary/provider error could contain
    // user content or secrets. Status + request id are enough for operators.
  }

  if (!response.ok) {
    writeError(`[SoRita][push] Sistem bildirimi gonderilemedi (HTTP ${response.status}). Ayni anahtar ile --retry kullanin.`);
    return { outcome: 'http_failure', status: response.status, success: false };
  }

  if (options.dryRun) {
    writeOutput(`[SoRita][push] Dry-run tamamlandi. Hedef alici sayisi: ${payload?.recipientCount ?? 0}`);
    return { outcome: 'dry_run', payload, success: true };
  }

  writeOutput(
    `[SoRita][push] Sistem bildirimi kuyruga alindi. Alici: ${payload?.recipientCount ?? 0}, eklenen bildirim: ${payload?.insertedCount ?? 0}, yinelenen: ${payload?.duplicateCount ?? 0}`,
  );
  return { outcome: 'sent', payload, success: true };
}

export async function main(argv = process.argv.slice(2), environment = process.env) {
  loadEnv();
  const options = parseBroadcastArguments(argv);
  const result = await runBroadcastNotification(options, { environment });
  if (!result.success) {
    process.exitCode = 1;
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`[SoRita][push] ${error instanceof Error ? error.message : 'Bilinmeyen hata'}\n`);
    process.exitCode = 1;
  });
}
