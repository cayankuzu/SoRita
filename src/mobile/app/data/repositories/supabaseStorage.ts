import type { Place, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import {
  getBlockStateForUsers,
  getHiddenUserIdsFor,
  getVisibleListsFor,
  getVisibleUsersFor,
} from '@/mobile/app/data/repositories/storage/storageSelectors';
import { deepClone } from '@/mobile/app/data/repositories/storage/storageUtils';
import { createStorageListsRepository } from '@/mobile/app/data/repositories/storage/storageLists';
import { createStorageMediaRepository } from '@/mobile/app/data/repositories/storage/storageMedia';
import { createStorageModerationRepository } from '@/mobile/app/data/repositories/storage/storageModeration';
import { createStorageProfileRepository } from '@/mobile/app/data/repositories/storage/storageProfile';
import { createStorageReadsRepository } from '@/mobile/app/data/repositories/storage/storageReads';
import {
  createStorageRelationshipsRepository,
  type FollowStateResult,
} from '@/mobile/app/data/repositories/storage/storageRelationships';
import { createStorageSocialRepository } from '@/mobile/app/data/repositories/storage/storageSocial';
import type { UserBlockRow } from '@/mobile/app/platform/supabase/databaseTypes';
import { env } from '@/mobile/app/platform/config/env';
import {
  loadPersistedStorageSnapshot,
  RUNTIME_CACHE_VERSION,
  savePersistedStorageSnapshot,
} from '@/mobile/app/platform/storage/runtimeCache';
import { supabase } from '@/mobile/app/platform/supabase/client';

let currentUserCache: User | null = null;
let usersCache: User[] = [];
let listsCache: PlaceList[] = [];
let blockRowsCache: UserBlockRow[] = [];
let storageVersion = 0;
let mutationQueue: Promise<void> = Promise.resolve();
const storageListeners = new Set<() => void>();
const bootstrapPromises = new Map<string, Promise<void>>();
let storagePersistTimer: ReturnType<typeof setTimeout> | null = null;
let storagePersistPromise: Promise<void> = Promise.resolve();

export type { FollowStateResult } from '@/mobile/app/data/repositories/storage/storageRelationships';
type StorageSnapshot = {
  currentUserCache: User | null;
  usersCache: User[];
  listsCache: PlaceList[];
  blockRowsCache: UserBlockRow[];
};
type PersistedStorageSnapshot = {
  version: number;
  userId: string;
  users: User[];
  lists: PlaceList[];
  blockRows: UserBlockRow[];
  cachedAt: string;
};

function schedulePersistedStorageSnapshot() {
  const userId = currentUserCache?.id;

  if (!userId) {
    return;
  }

  if (storagePersistTimer) {
    clearTimeout(storagePersistTimer);
  }

  storagePersistTimer = setTimeout(() => {
    storagePersistTimer = null;

    const snapshotUserId = currentUserCache?.id;

    if (!snapshotUserId) {
      return;
    }

    const nextSnapshot = {
      version: RUNTIME_CACHE_VERSION,
      userId: snapshotUserId,
      users: deepClone(usersCache),
      lists: deepClone(listsCache),
      blockRows: deepClone(blockRowsCache),
      cachedAt: new Date().toISOString(),
    };

    storagePersistPromise = storagePersistPromise
      .catch(() => undefined)
      .then(() => savePersistedStorageSnapshot(nextSnapshot))
      .catch(() => undefined);
  }, 180);
}

function emitStorageChange() {
  storageVersion += 1;
  schedulePersistedStorageSnapshot();
  storageListeners.forEach((listener) => listener());
}

function subscribeToStorage(listener: () => void) {
  storageListeners.add(listener);

  return () => {
    storageListeners.delete(listener);
  };
}

function getViewerCacheKey(userId?: string | null) {
  return userId || '__public__';
}

function captureStorageSnapshot(): StorageSnapshot {
  return {
    currentUserCache: currentUserCache ? deepClone(currentUserCache) : null,
    usersCache: deepClone(usersCache),
    listsCache: deepClone(listsCache),
    blockRowsCache: deepClone(blockRowsCache),
  };
}

function restoreStorageSnapshot(snapshot: StorageSnapshot) {
  currentUserCache = snapshot.currentUserCache;
  usersCache = snapshot.usersCache;
  listsCache = snapshot.listsCache;
  blockRowsCache = snapshot.blockRowsCache;
}

function syncCurrentUserCache() {
  if (!currentUserCache) {
    return;
  }

  currentUserCache = usersCache.find((item) => item.id === currentUserCache?.id) || currentUserCache;
}

function resetStorageCaches() {
  currentUserCache = null;
  usersCache = [];
  listsCache = [];
  blockRowsCache = [];
  emitStorageChange();
}

function queueMutation<T>(task: () => Promise<T>) {
  const runTask = async () => task();
  const nextTask = mutationQueue.then(runTask, runTask);
  mutationQueue = nextTask.then(
    () => undefined,
    () => undefined,
  );
  return nextTask;
}

async function runOptimisticMutation<T>(
  applyOptimistic: () => void,
  task: () => Promise<T>,
  onError?: (error: unknown) => Promise<void> | void,
) {
  const snapshot = captureStorageSnapshot();
  applyOptimistic();
  syncCurrentUserCache();
  emitStorageChange();

  try {
    const result = await queueMutation(task);
    syncCurrentUserCache();
    emitStorageChange();
    return result;
  } catch (error) {
    restoreStorageSnapshot(snapshot);
    syncCurrentUserCache();
    emitStorageChange();
    await onError?.(error);
    throw error;
  }
}

function isMissingFollowRequestsSchemaError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const normalizedMessage = error?.message?.toLowerCase() ?? '';

  return (
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    normalizedMessage.includes('follow_requests') ||
    normalizedMessage.includes('follow_request_id') ||
    normalizedMessage.includes('notifications_follow_request_id_fkey')
  );
}

function isMissingUserBlocksSchemaError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const normalizedMessage = error?.message?.toLowerCase() ?? '';

  return (
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    normalizedMessage.includes('user_blocks')
  );
}

function isMissingPlaceCommentLikeSchemaError(
  error: { code?: string | null; message?: string | null; details?: string | null } | null | undefined,
) {
  const normalizedMessage = error?.message?.toLowerCase() ?? '';
  const normalizedDetails = error?.details?.toLowerCase() ?? '';

  return (
    error?.code === 'PGRST200' ||
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    error?.code === '42703' ||
    normalizedMessage.includes('list_place_comment_likes') ||
    normalizedMessage.includes('parent_comment_id') ||
    normalizedDetails.includes('list_place_comment_likes')
  );
}

function isMissingListPlaceUpdatedAtSchemaError(
  error: { code?: string | null; message?: string | null; details?: string | null } | null | undefined,
) {
  const normalizedMessage = error?.message?.toLowerCase() ?? '';
  const normalizedDetails = error?.details?.toLowerCase() ?? '';

  return (
    error?.code === '42703' ||
    (normalizedMessage.includes('list_places') && normalizedMessage.includes('updated_at')) ||
    (normalizedDetails.includes('list_places') && normalizedDetails.includes('updated_at'))
  );
}

const mediaRepository = createStorageMediaRepository({
  supabase,
});

const readsRepository = createStorageReadsRepository({
  supabase,
  getUsersCache: () => usersCache,
  setUsersCache: (nextUsers) => {
    usersCache = nextUsers;
  },
  setListsCache: (nextLists) => {
    listsCache = nextLists;
  },
  getCurrentUserCache: () => currentUserCache,
  setCurrentUserCache: (user) => {
    currentUserCache = user;
  },
  setBlockRowsCache: (nextBlockRows) => {
    blockRowsCache = nextBlockRows;
  },
  repairListCoverImage: (list) => mediaRepository.repairListCoverImage(list),
  isMissingFollowRequestsSchemaError,
  isMissingUserBlocksSchemaError,
  isMissingPlaceCommentLikeSchemaError,
  isMissingListPlaceUpdatedAtSchemaError,
});

async function refreshUsers() {
  await readsRepository.refreshUsers();
}

async function refreshListsLegacy(currentUserId?: string) {
  await readsRepository.refreshListsLegacy(currentUserId);
}

async function refreshLists(currentUserId?: string) {
  await readsRepository.refreshLists(currentUserId);
}

const listsRepository = createStorageListsRepository({
  supabase,
  getListsCache: () => listsCache,
  setListsCache: (nextLists) => {
    listsCache = nextLists;
  },
  getCurrentViewerId: () => currentUserCache?.id,
  runOptimisticMutation,
  refreshLists,
  uploadListCoverImage: (params) => mediaRepository.uploadListCoverImage(params),
  uploadPlacePhotos: (params) => mediaRepository.uploadPlacePhotos(params),
  deleteUnreferencedPlaceMediaUrls: (urls) => mediaRepository.deleteUnreferencedPlaceMediaUrls(urls),
  isMissingListPlaceUpdatedAtSchemaError,
});

const profileRepository = createStorageProfileRepository({
  supabase,
  getUsersCache: () => usersCache,
  setUsersCache: (nextUsers) => {
    usersCache = nextUsers;
  },
  getCurrentUserCache: () => currentUserCache,
  setCurrentUserCache: (user) => {
    currentUserCache = user;
  },
  runOptimisticMutation,
  refreshUsers,
  refreshLists,
  uploadUserMedia: (userId, profilePhoto, coverPhoto) =>
    mediaRepository.uploadUserMedia(userId, profilePhoto, coverPhoto),
  deleteUnreferencedProfileMediaUrls: (urls) => mediaRepository.deleteUnreferencedProfileMediaUrls(urls),
});

const moderationRepository = createStorageModerationRepository({
  env,
  supabase,
  getListsCache: () => listsCache,
  clearCache: resetStorageCaches,
});

const relationshipsRepository = createStorageRelationshipsRepository({
  supabase,
  getUsersCache: () => usersCache,
  setUsersCache: (nextUsers) => {
    usersCache = nextUsers;
  },
  getBlockRowsCache: () => blockRowsCache,
  setBlockRowsCache: (nextBlockRows) => {
    blockRowsCache = nextBlockRows;
  },
  getCurrentUserCache: () => currentUserCache,
  setCurrentUserCache: (user) => {
    currentUserCache = user;
  },
  getBlockState: (currentUserId, targetUserId) =>
    getBlockStateForUsers(blockRowsCache, currentUserId, targetUserId),
  runOptimisticMutation,
  refreshUsers,
  refreshLists,
});

const socialRepository = createStorageSocialRepository({
  supabase,
  getUsersCache: () => usersCache,
  getListsCache: () => listsCache,
  setListsCache: (nextLists) => {
    listsCache = nextLists;
  },
  runOptimisticMutation,
  isMissingPlaceCommentLikeSchemaError,
});

export const storage = {
  async hydratePersistedCache(userId: string) {
    const snapshot = await loadPersistedStorageSnapshot<PersistedStorageSnapshot>(userId);

    if (!snapshot) {
      return false;
    }

    usersCache = snapshot.users;
    listsCache = snapshot.lists;
    blockRowsCache = snapshot.blockRows;
    currentUserCache = snapshot.users.find((item) => item.id === userId) || null;
    emitStorageChange();

    return Boolean(currentUserCache);
  },

  async bootstrap(userId?: string) {
    const cacheKey = getViewerCacheKey(userId);
    const existingPromise = bootstrapPromises.get(cacheKey);

    if (existingPromise) {
      return existingPromise;
    }

    const task = (async () => {
      await refreshUsers();
      try {
        await refreshLists(userId);
      } catch (error) {
        if (isMissingPlaceCommentLikeSchemaError(error as { code?: string | null; message?: string | null; details?: string | null })) {
          await refreshListsLegacy(userId);
        } else {
          throw error;
        }
      }
      currentUserCache = userId ? usersCache.find((item) => item.id === userId) || null : null;
      emitStorageChange();
    })();

    bootstrapPromises.set(cacheKey, task);

    try {
      await task;
    } finally {
      if (bootstrapPromises.get(cacheKey) === task) {
        bootstrapPromises.delete(cacheKey);
      }
    }
  },

  async refreshVisibleData(userId?: string) {
    await this.bootstrap(userId);
  },

  subscribe(listener: () => void) {
    return subscribeToStorage(listener);
  },

  getVersion() {
    return storageVersion;
  },

  getUsers(): User[] {
    return getVisibleUsersFor(usersCache, blockRowsCache, currentUserCache?.id);
  },

  findUserByEmail(email: string): User | undefined {
    return usersCache.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
  },

  findUserById(userId: string): User | undefined {
    const hiddenUserIds = getHiddenUserIdsFor(blockRowsCache, currentUserCache?.id);

    if (userId !== currentUserCache?.id && hiddenUserIds.has(userId)) {
      return undefined;
    }

    return usersCache.find((item) => item.id === userId);
  },

  findUserByIdIncludingBlocked(userId: string): User | undefined {
    return usersCache.find((item) => item.id === userId);
  },

  getCurrentUser(): User | null {
    return currentUserCache;
  },

  setCurrentUser(user: User | null): void {
    currentUserCache = user;
  },

  clearCache(): void {
    resetStorageCaches();
  },

  getLists(): PlaceList[] {
    return getVisibleListsFor(listsCache, blockRowsCache, currentUserCache?.id);
  },

  getListsByUserId(userId: string): PlaceList[] {
    return getVisibleListsFor(listsCache, blockRowsCache, currentUserCache?.id).filter((item) => item.userId === userId);
  },

  getPublicLists(): PlaceList[] {
    return getVisibleListsFor(listsCache, blockRowsCache, currentUserCache?.id).filter((item) => item.isPublic);
  },

  getListById(listId: string): PlaceList | undefined {
    return getVisibleListsFor(listsCache, blockRowsCache, currentUserCache?.id).find((item) => item.id === listId);
  },

  findPlaceById(placeId: string): Place | undefined {
    return getVisibleListsFor(listsCache, blockRowsCache, currentUserCache?.id)
      .flatMap((list) => list.places)
      .find((place) => place.id === placeId);
  },

  getBlockedUsers(userId: string): User[] {
    const sourceUser = usersCache.find((item) => item.id === userId);
    const blockedUserIds = sourceUser?.blockedUsers || [];

    return blockedUserIds
      .map((blockedUserId) => usersCache.find((item) => item.id === blockedUserId))
      .filter((item): item is User => Boolean(item));
  },

  getBlockState(currentUserId: string, targetUserId: string) {
    return getBlockStateForUsers(blockRowsCache, currentUserId, targetUserId);
  },

  async createList(list: PlaceList): Promise<void> {
    await listsRepository.createList(list);
  },

  async updateLists(lists: PlaceList[]): Promise<void> {
    await listsRepository.updateLists(lists);
  },

  async updateList(list: PlaceList): Promise<void> {
    await listsRepository.updateList(list);
  },

  async deleteList(listId: string): Promise<void> {
    await listsRepository.deleteList(listId);
  },

  async deletePlace(placeId: string): Promise<void> {
    await listsRepository.deletePlace(placeId);
  },

  async updateUser(user: User): Promise<User> {
    return profileRepository.updateUser(user);
  },

  async followUser(currentUserId: string, targetUserId: string): Promise<FollowStateResult> {
    return relationshipsRepository.followUser(currentUserId, targetUserId);
  },

  async blockUser(currentUserId: string, targetUserId: string): Promise<void> {
    await relationshipsRepository.blockUser(currentUserId, targetUserId);
  },

  async unblockUser(currentUserId: string, targetUserId: string): Promise<void> {
    await relationshipsRepository.unblockUser(currentUserId, targetUserId);
  },

  async reportUser(reporterUserId: string, targetUserId: string, reason: string): Promise<void> {
    await moderationRepository.reportUser(reporterUserId, targetUserId, reason);
  },

  async reportList(reporterUserId: string, listId: string, reason: string): Promise<void> {
    await moderationRepository.reportList(reporterUserId, listId, reason);
  },

  async reportPlace(reporterUserId: string, placeId: string, reason: string): Promise<void> {
    await moderationRepository.reportPlace(reporterUserId, placeId, reason);
  },

  async respondToFollowRequest(
    requestId: string,
    decision: 'accept' | 'reject',
  ): Promise<'accepted' | 'rejected'> {
    return relationshipsRepository.respondToFollowRequest(requestId, decision);
  },

  async toggleLikeList(listId: string, userId: string): Promise<void> {
    await socialRepository.toggleLikeList(listId, userId);
  },

  async toggleLikePlace(placeId: string, userId: string): Promise<void> {
    await socialRepository.toggleLikePlace(placeId, userId);
  },

  async createPlaceComment(
    placeId: string,
    userId: string,
    content: string,
    parentCommentId?: string | null,
  ): Promise<void> {
    await socialRepository.createPlaceComment(placeId, userId, content, parentCommentId);
  },

  async toggleLikePlaceComment(commentId: string, userId: string): Promise<void> {
    await socialRepository.toggleLikePlaceComment(commentId, userId);
  },

  async updatePlaceComment(commentId: string, userId: string, content: string): Promise<void> {
    await socialRepository.updatePlaceComment(commentId, userId, content);
  },

  async deletePlaceComment(commentId: string): Promise<void> {
    await socialRepository.deletePlaceComment(commentId);
  },

  async reportPlaceComment(commentId: string, reporterUserId: string, reason: string): Promise<void> {
    await moderationRepository.reportPlaceComment(commentId, reporterUserId, reason);
  },

  async deleteUser(): Promise<void> {
    await moderationRepository.deleteUser();
  },
};
