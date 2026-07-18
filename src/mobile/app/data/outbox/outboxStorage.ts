import AsyncStorage from '@react-native-async-storage/async-storage';

import { createUuid } from '@/shared/utils/id';

const OUTBOX_VERSION = 1;
const OUTBOX_STORAGE_PREFIX = 'sorita.outbox';

export type OutboxEntryState =
  | 'blocked'
  | 'cancelled'
  | 'done'
  | 'failed'
  | 'pending'
  | 'running';

export type OutboxEntryKind =
  | 'comment-create'
  | 'follow-toggle'
  | 'notification-read'
  | 'place-like-toggle'
  | 'upload';

export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type OutboxEntry<TPayload extends JsonValue = JsonValue> = {
  attempt: number;
  createdAt: string;
  dependencies: string[];
  id: string;
  idempotencyKey: string;
  kind: OutboxEntryKind;
  lastError?: string;
  nextAttemptAt: string;
  payloadRef: TPayload;
  state: OutboxEntryState;
  updatedAt: string;
  userId: string;
};

type PersistedOutbox = {
  entries: OutboxEntry[];
  savedAt: number;
  userId: string;
  version: number;
};

type EnqueueOutboxEntryInput<TPayload extends JsonValue> = {
  dependencies?: string[];
  id?: string;
  idempotencyKey?: string;
  kind: OutboxEntryKind;
  nextAttemptAt?: string;
  payloadRef: TPayload;
  state?: OutboxEntryState;
  userId: string;
};

function getStorageKey(userId: string) {
  return `${OUTBOX_STORAGE_PREFIX}.${OUTBOX_VERSION}.${userId}`;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isOutboxEntry(value: unknown, userId: string): value is OutboxEntry {
  if (!isJsonObject(value)) {
    return false;
  }

  const candidate = value as Partial<OutboxEntry>;

  return (
    candidate.userId === userId &&
    typeof candidate.id === 'string' &&
    typeof candidate.idempotencyKey === 'string' &&
    typeof candidate.kind === 'string' &&
    typeof candidate.payloadRef !== 'undefined' &&
    Array.isArray(candidate.dependencies) &&
    typeof candidate.attempt === 'number' &&
    typeof candidate.nextAttemptAt === 'string' &&
    typeof candidate.state === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string'
  );
}

function normalizeEntries(entries: OutboxEntry[]) {
  return entries
    .slice()
    .sort(
      (left, right) =>
        new Date(left.nextAttemptAt).getTime() - new Date(right.nextAttemptAt).getTime() ||
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
}

async function writeOutbox(userId: string, entries: OutboxEntry[]) {
  const payload: PersistedOutbox = {
    entries: normalizeEntries(entries),
    savedAt: Date.now(),
    userId,
    version: OUTBOX_VERSION,
  };

  await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(payload));
}

export async function readOutboxEntries(userId: string) {
  const key = getStorageKey(userId);
  const rawValue = await AsyncStorage.getItem(key);

  if (!rawValue) {
    return [];
  }

  try {
    const payload = JSON.parse(rawValue) as Partial<PersistedOutbox>;

    if (
      payload.version !== OUTBOX_VERSION ||
      payload.userId !== userId ||
      !Array.isArray(payload.entries) ||
      !payload.entries.every((entry) => isOutboxEntry(entry, userId))
    ) {
      await AsyncStorage.removeItem(key);
      return [];
    }

    return normalizeEntries(payload.entries);
  } catch {
    await AsyncStorage.removeItem(key);
    return [];
  }
}

export async function enqueueOutboxEntry<TPayload extends JsonValue>(
  input: EnqueueOutboxEntryInput<TPayload>,
) {
  const now = new Date().toISOString();
  const entry: OutboxEntry<TPayload> = {
    attempt: 0,
    createdAt: now,
    dependencies: input.dependencies || [],
    id: input.id || createUuid(),
    idempotencyKey: input.idempotencyKey || createUuid(),
    kind: input.kind,
    nextAttemptAt: input.nextAttemptAt || now,
    payloadRef: input.payloadRef,
    state: input.state || 'pending',
    updatedAt: now,
    userId: input.userId,
  };
  const entries = await readOutboxEntries(input.userId);
  const nextEntries = entries.filter((item) => item.idempotencyKey !== entry.idempotencyKey);

  nextEntries.push(entry);
  await writeOutbox(input.userId, nextEntries);

  return entry;
}

export async function updateOutboxEntry(
  userId: string,
  entryId: string,
  patch: Partial<Pick<
    OutboxEntry,
    'attempt' | 'lastError' | 'nextAttemptAt' | 'payloadRef' | 'state'
  >>,
) {
  const entries = await readOutboxEntries(userId);
  const now = new Date().toISOString();
  const nextEntries = entries.map((entry) =>
    entry.id === entryId
      ? {
          ...entry,
          ...patch,
          updatedAt: now,
        }
      : entry,
  );

  await writeOutbox(userId, nextEntries);
}

export async function removeOutboxEntry(userId: string, entryId: string) {
  const entries = await readOutboxEntries(userId);

  await writeOutbox(userId, entries.filter((entry) => entry.id !== entryId));
}

export async function readDueOutboxEntries(userId: string, now = new Date()) {
  const nowTime = now.getTime();
  const entries = await readOutboxEntries(userId);
  const completedStates = new Set<OutboxEntryState>(['cancelled', 'done']);

  return entries.filter(
    (entry) =>
      !completedStates.has(entry.state) &&
      new Date(entry.nextAttemptAt).getTime() <= nowTime &&
      entry.dependencies.every((dependencyId) =>
        entries.some((candidate) => candidate.id === dependencyId && candidate.state === 'done'),
      ),
  );
}

export async function clearOutboxForUser(userId: string) {
  await AsyncStorage.removeItem(getStorageKey(userId));
}

export async function clearAllOutboxEntries() {
  const keys = await AsyncStorage.getAllKeys();
  const matchingKeys = keys.filter((key) => key.startsWith(`${OUTBOX_STORAGE_PREFIX}.`));

  if (matchingKeys.length > 0) {
    await AsyncStorage.multiRemove(matchingKeys);
  }
}
