import type { QueryClient } from '@tanstack/react-query';
import { onlineManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

import {
  STARTUP_MEDIA_PREFETCH_LIMIT,
  type StartupWarmupStage,
  warmListDetailStage,
  warmStageData,
  warmUserProfileStage,
} from '@/mobile/app/app-shell/startup/startupWarmupData';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { getCurrentConnectionStatus } from '@/mobile/app/platform/network/connectivityStatus';
import { scheduleDeferredTask } from '@/mobile/app/shared/utils/deferredTask';

export type { StartupWarmupStage } from '@/mobile/app/app-shell/startup/startupWarmupData';

const IDLE_WARMUP_DELAY_MS = 1_200;
const inFlightWarmups = new Map<string, Promise<void>>();
const warmupControllers = new Map<string, AbortController>();
const adjacentStageByStage: Record<StartupWarmupStage, StartupWarmupStage | null> = {
  explore: 'map',
  home: 'explore',
  map: 'explore',
  notifications: 'home',
  profile: 'home',
};
let activeContext: { queryClient: QueryClient; userId: string } | null = null;
let activeWarmupStage: StartupWarmupStage | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let idleTask: ReturnType<typeof scheduleDeferredTask> | null = null;

type WarmScreenDataParams = {
  queryClient: QueryClient;
  stage: StartupWarmupStage;
  userId: string;
};

type StartStartupDataWarmupParams = {
  initialStage?: StartupWarmupStage | null;
  isCancelled?: () => boolean;
  prepareStage?: (stage: StartupWarmupStage) => Promise<void> | void;
  queryClient: QueryClient;
  userId: string;
};

function getWarmupKey(userId: string, stage: StartupWarmupStage) {
  return `${userId}:${stage}`;
}

function canRunBackgroundWarmup() {
  return (
    AppState.currentState !== 'background' &&
    AppState.currentState !== 'inactive' &&
    onlineManager.isOnline() &&
    getCurrentConnectionStatus() === 'online'
  );
}

function cancelIdleWarmup() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  idleTask?.cancel();
  idleTask = null;
}

export function warmScreenData({ queryClient, stage, userId }: WarmScreenDataParams) {
  const warmupKey = getWarmupKey(userId, stage);
  const existingWarmup = inFlightWarmups.get(warmupKey);

  if (existingWarmup) {
    return existingWarmup;
  }

  const controller = new AbortController();
  warmupControllers.set(warmupKey, controller);
  const warmup = warmStageData(queryClient, userId, stage, controller.signal)
    .catch((error) => {
      logger.debug('startup-warmup', `${stage} warmup failed`, error);
    })
    .finally(() => {
      inFlightWarmups.delete(warmupKey);
      warmupControllers.delete(warmupKey);
    });

  inFlightWarmups.set(warmupKey, warmup);
  return warmup;
}

function cancelWarmupStage(stage: StartupWarmupStage) {
  if (!activeContext) {
    return;
  }

  const warmupKey = getWarmupKey(activeContext.userId, stage);
  warmupControllers.get(warmupKey)?.abort();
  const queryRoot: Record<StartupWarmupStage, string> = {
    explore: 'explore',
    home: 'feed',
    map: 'map',
    notifications: 'notifications',
    profile: 'profile',
  };
  void activeContext.queryClient.cancelQueries({
    exact: false,
    queryKey: [queryRoot[stage]],
  });
}

export function prioritizeStartupWarmupStage(stage: StartupWarmupStage) {
  cancelIdleWarmup();

  if (activeWarmupStage && activeWarmupStage !== stage) {
    cancelWarmupStage(activeWarmupStage);
  }

  activeWarmupStage = stage;

  if (activeContext && canRunBackgroundWarmup()) {
    void warmScreenData({ ...activeContext, stage });
  }
}

export function getAdjacentStartupWarmupStage(current: StartupWarmupStage) {
  return adjacentStageByStage[current];
}

export function scheduleAdjacentStartupWarmup(current: StartupWarmupStage) {
  cancelIdleWarmup();
  const adjacentStage = getAdjacentStartupWarmupStage(current);

  if (!adjacentStage || !activeContext) {
    return;
  }

  idleTimer = setTimeout(() => {
    idleTimer = null;
    idleTask = scheduleDeferredTask(() => {
      idleTask = null;

      if (activeContext && canRunBackgroundWarmup()) {
        void warmScreenData({ ...activeContext, stage: adjacentStage });
      }
    });
  }, IDLE_WARMUP_DELAY_MS);
}

export function stopStartupDataWarmup(userId?: string) {
  if (userId && activeContext?.userId !== userId) {
    return;
  }

  cancelIdleWarmup();
  warmupControllers.forEach((controller, key) => {
    if (!userId || key.startsWith(`${userId}:`)) {
      controller.abort();
    }
  });
  activeContext = null;
  activeWarmupStage = null;
}

function warmIntent(key: string, task: () => Promise<void>) {
  const existingWarmup = inFlightWarmups.get(key);

  if (existingWarmup) {
    return existingWarmup;
  }

  cancelIdleWarmup();
  const warmup = task()
    .catch((error) => {
      logger.debug('intent-warmup', `${key} warmup failed`, error);
    })
    .finally(() => {
      inFlightWarmups.delete(key);
    });
  inFlightWarmups.set(key, warmup);
  return warmup;
}

export function warmListDetailData(params: {
  listId: string;
  queryClient: QueryClient;
  viewerId: string;
}) {
  return warmIntent(`${params.viewerId}:list:${params.listId}`, () =>
    warmListDetailStage(params),
  );
}

export function warmUserProfileData(params: {
  queryClient: QueryClient;
  targetUserId: string;
  viewerId: string;
}) {
  return warmIntent(`${params.viewerId}:profile:${params.targetUserId}`, () =>
    warmUserProfileStage(params),
  );
}

export async function startStartupDataWarmup({
  initialStage = 'home',
  isCancelled = () => false,
  prepareStage,
  queryClient,
  userId,
}: StartStartupDataWarmupParams) {
  activeContext = { queryClient, userId };
  const stage = initialStage ?? 'home';
  activeWarmupStage = stage;

  if (isCancelled()) {
    return;
  }

  await prepareStage?.(stage);

  if (!isCancelled() && canRunBackgroundWarmup()) {
    await warmScreenData({ queryClient, stage, userId });
  }
}

export const startupDataWarmupInternals = {
  IDLE_WARMUP_DELAY_MS,
  STARTUP_MEDIA_PREFETCH_LIMIT,
  canRunBackgroundWarmup,
  cancelIdleWarmup,
  getAdjacentStartupWarmupStage,
  getWarmupKey,
  inFlightWarmups,
  warmupControllers,
};
