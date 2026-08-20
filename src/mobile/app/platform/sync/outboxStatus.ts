import { useSyncExternalStore } from 'react';

type OutboxEntryStatus = {
  state: string;
};

type OutboxStatus = {
  failedCount: number;
  pendingCount: number;
  syncing: boolean;
};

const EMPTY_STATUS: OutboxStatus = {
  failedCount: 0,
  pendingCount: 0,
  syncing: false,
};
const listeners = new Set<() => void>();
const statusByUser = new Map<string, OutboxStatus>();
let activeUserId: string | null = null;
let snapshot = EMPTY_STATUS;

function emitIfChanged(next: OutboxStatus) {
  if (
    next.failedCount === snapshot.failedCount &&
    next.pendingCount === snapshot.pendingCount &&
    next.syncing === snapshot.syncing
  ) {
    return;
  }

  snapshot = next;
  listeners.forEach((listener) => listener());
}

function publishActiveStatus() {
  emitIfChanged(activeUserId ? statusByUser.get(activeUserId) ?? EMPTY_STATUS : EMPTY_STATUS);
}

export function setActiveOutboxUser(userId: string | null) {
  activeUserId = userId;
  publishActiveStatus();
}

export function publishOutboxEntries(userId: string, entries: OutboxEntryStatus[]) {
  const current = statusByUser.get(userId) ?? EMPTY_STATUS;
  const next = entries.reduce<OutboxStatus>(
    (status, entry) => {
      if (entry.state !== 'cancelled' && entry.state !== 'done') {
        status.pendingCount += 1;
      }

      if (entry.state === 'blocked' || entry.state === 'failed') {
        status.failedCount += 1;
      }

      return status;
    },
    { failedCount: 0, pendingCount: 0, syncing: current.syncing },
  );

  statusByUser.set(userId, next);

  if (activeUserId === userId) {
    emitIfChanged(next);
  }
}

export function setOutboxSyncing(userId: string, syncing: boolean) {
  const current = statusByUser.get(userId) ?? EMPTY_STATUS;
  const next = { ...current, syncing };
  statusByUser.set(userId, next);

  if (activeUserId === userId) {
    emitIfChanged(next);
  }
}

export function subscribeToOutboxStatus(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOutboxStatusSnapshot() {
  return snapshot;
}

export function useOutboxStatus() {
  return useSyncExternalStore(
    subscribeToOutboxStatus,
    getOutboxStatusSnapshot,
    getOutboxStatusSnapshot,
  );
}
