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
const MIN_TRANSITIONS_FOR_PREDICTION = 2;
const MIN_PREDICTION_CONFIDENCE = 0.6;
const inFlightWarmups = new Map<string, Promise<void>>();
const transitionCounts = new Map<StartupWarmupStage, Map<StartupWarmupStage, number>>();
let activeContext: { queryClient: QueryClient; userId: string } | null = null;
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

  const warmup = warmStageData(queryClient, userId, stage)
    .catch((error) => {
      logger.debug('startup-warmup', `${stage} warmup failed`, error);
    })
    .finally(() => {
      inFlightWarmups.delete(warmupKey);
    });

  inFlightWarmups.set(warmupKey, warmup);
  return warmup;
}

export function prioritizeStartupWarmupStage(stage: StartupWarmupStage) {
  cancelIdleWarmup();

  if (activeContext && canRunBackgroundWarmup()) {
    void warmScreenData({ ...activeContext, stage });
  }
}

export function recordStartupWarmupTransition(
  previous: StartupWarmupStage | null,
  next: StartupWarmupStage,
) {
  if (!previous || previous === next) {
    return;
  }

  const targets = transitionCounts.get(previous) ?? new Map();
  targets.set(next, (targets.get(next) ?? 0) + 1);
  transitionCounts.set(previous, targets);
}

function getPredictedStage(current: StartupWarmupStage) {
  const targets = transitionCounts.get(current);

  if (!targets) {
    return null;
  }

  const ranked = [...targets.entries()].sort((left, right) => right[1] - left[1]);
  const total = ranked.reduce((sum, [, count]) => sum + count, 0);
  const winner = ranked[0];

  if (
    !winner ||
    total < MIN_TRANSITIONS_FOR_PREDICTION ||
    winner[1] / total < MIN_PREDICTION_CONFIDENCE
  ) {
    return null;
  }

  return winner[0];
}

export function schedulePredictedStartupWarmup(current: StartupWarmupStage) {
  cancelIdleWarmup();
  const predicted = getPredictedStage(current);

  if (!predicted || !activeContext) {
    return;
  }

  idleTimer = setTimeout(() => {
    idleTimer = null;
    idleTask = scheduleDeferredTask(() => {
      idleTask = null;

      if (activeContext && canRunBackgroundWarmup()) {
        void warmScreenData({ ...activeContext, stage: predicted });
      }
    });
  }, IDLE_WARMUP_DELAY_MS);
}

export function stopStartupDataWarmup(userId?: string) {
  if (userId && activeContext?.userId !== userId) {
    return;
  }

  cancelIdleWarmup();
  activeContext = null;
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
  getPredictedStage,
  getWarmupKey,
  inFlightWarmups,
  transitionCounts,
};
