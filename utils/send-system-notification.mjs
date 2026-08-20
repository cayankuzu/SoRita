import { randomUUID } from 'node:crypto';

import { config as loadEnv } from 'dotenv';

loadEnv();

function getArgValue(flagNames) {
  for (let index = 2; index < process.argv.length; index += 1) {
    const current = process.argv[index];

    if (!flagNames.includes(current)) {
      continue;
    }

    return process.argv[index + 1] ?? null;
  }

  return null;
}

function getArgValues(flagNames) {
  const values = [];

  for (let index = 2; index < process.argv.length; index += 1) {
    const current = process.argv[index];

    if (!flagNames.includes(current)) {
      continue;
    }

    const nextValue = process.argv[index + 1];

    if (nextValue) {
      values.push(nextValue);
    }
  }

  return values;
}

function hasFlag(flagName) {
  return process.argv.includes(flagName);
}

function printUsageAndExit() {
  console.log('Kullanim: npm run notify:broadcast -- --title "Baslik" --message "Icerik" [--dry-run] [--user-id <uuid>] [--idempotency-key <uuid>]');
  process.exit(1);
}

const title = getArgValue(['--title']);
const message = getArgValue(['--message', '--body']);
const userIds = getArgValues(['--user-id']);
const dryRun = hasFlag('--dry-run');
const idempotencyKey = getArgValue(['--idempotency-key']) ?? randomUUID();

if (!title || !message) {
  printUsageAndExit();
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const adminToken = process.env.SYSTEM_BROADCAST_ADMIN_TOKEN?.trim();

if (!supabaseUrl) {
  console.error('[SoRita][push] EXPO_PUBLIC_SUPABASE_URL tanimli degil.');
  process.exit(1);
}

if (!adminToken) {
  console.error('[SoRita][push] SYSTEM_BROADCAST_ADMIN_TOKEN tanimli degil.');
  process.exit(1);
}

const functionUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/admin-broadcast-notification`;
const requestBody = {
  dryRun,
  idempotencyKey,
  message,
  title,
  ...(userIds.length > 0 ? { userIds } : {}),
};

const response = await fetch(functionUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(publishableKey ? { apikey: publishableKey } : {}),
    'x-admin-token': adminToken,
    'x-request-id': randomUUID(),
  },
  body: JSON.stringify(requestBody),
});

const responseText = await response.text();
let payload;

try {
  payload = responseText ? JSON.parse(responseText) : null;
} catch {
  payload = responseText;
}

if (!response.ok) {
  console.error('[SoRita][push] Sistem bildirimi gonderilemedi.');
  console.error(payload);
  process.exit(1);
}

if (dryRun) {
  console.log(`[SoRita][push] Dry-run tamamlandi. Hedef alici sayisi: ${payload?.recipientCount ?? 0}`);
  process.exit(0);
}

console.log(`[SoRita][push] Idempotency anahtari: ${idempotencyKey}`);
console.log(
  `[SoRita][push] Sistem bildirimi kuyruga alindi. Alici: ${payload?.recipientCount ?? 0}, eklenen bildirim: ${payload?.insertedCount ?? 0}, yinelenen: ${payload?.duplicateCount ?? 0}`,
);
