type StorageAssetRef = {
  bucket: string;
  path: string;
};

export type SignedReadRequestSession = {
  accessToken: string;
  userId: string;
};

type SignedReadScope = {
  generation: number;
  userId: string;
};

type PendingSignedReadRequest = {
  ref: StorageAssetRef;
  reject: (error: unknown) => void;
  requestSession: SignedReadRequestSession;
  resolve: (signedUrl: string) => void;
  scope: SignedReadScope;
};

type SignedReadUrlManagerDependencies = {
  getRequestSession: () => Promise<SignedReadRequestSession>;
  requestSignedUrls: (params: {
    paths: string[];
    requestSession: SignedReadRequestSession;
    signal: AbortSignal;
  }) => Promise<{
    expiresInSeconds?: number;
    items: Array<{ path: string; signedUrl: string }>;
  }>;
};

const SIGNED_READ_URL_CACHE_TTL_MS = 4 * 60 * 1000;
const SIGNED_READ_URL_BATCH_SIZE = 64;

export function createPrivateSignedReadUrlManager(
  dependencies: SignedReadUrlManagerDependencies,
) {
  const cache = new Map<string, { expiresAt: number; signedUrl: string }>();
  const inFlight = new Map<string, Promise<string>>();
  const pending = new Map<string, PendingSignedReadRequest>();
  const activeBatches = new Set<{
    controller: AbortController;
    entries: Array<[string, PendingSignedReadRequest]>;
  }>();
  let batchScheduled = false;
  let sessionGeneration = 0;
  let userId: string | null = null;

  const createStaleRequestError = () =>
    new Error('Private media authorization state changed.');

  const reset = (nextUserId: string | null) => {
    const staleRequestError = createStaleRequestError();

    sessionGeneration += 1;
    userId = nextUserId;
    cache.clear();
    inFlight.clear();
    pending.forEach((entry) => entry.reject(staleRequestError));
    pending.clear();
    batchScheduled = false;
    activeBatches.forEach((batch) => {
      batch.entries.forEach(([, entry]) => entry.reject(staleRequestError));
      batch.controller.abort();
    });
    activeBatches.clear();
  };

  const isCurrentScope = (scope: SignedReadScope) =>
    scope.generation === sessionGeneration && scope.userId === userId;

  const activateScope = (nextUserId: string, observedGeneration: number) => {
    if (observedGeneration !== sessionGeneration) {
      throw createStaleRequestError();
    }

    if (userId !== nextUserId) {
      reset(nextUserId);
    }

    return { generation: sessionGeneration, userId: nextUserId };
  };

  const resolveRequestSession = async () => {
    const observedGeneration = sessionGeneration;
    const requestSession = await dependencies.getRequestSession();
    const scope = activateScope(requestSession.userId, observedGeneration);
    return { requestSession, scope };
  };

  const cacheUrl = (cacheKey: string, signedUrl: string, expiresInSeconds?: number) => {
    const ttlMs = Math.max(60, expiresInSeconds ?? 300) * 1000;
    cache.set(cacheKey, {
      expiresAt: Date.now() + Math.min(ttlMs, SIGNED_READ_URL_CACHE_TTL_MS),
      signedUrl,
    });
  };

  const flushBatch = async () => {
    batchScheduled = false;
    const pendingEntries = Array.from(pending.entries());
    pending.clear();

    for (let offset = 0; offset < pendingEntries.length; offset += SIGNED_READ_URL_BATCH_SIZE) {
      const batch = pendingEntries.slice(offset, offset + SIGNED_READ_URL_BATCH_SIZE);
      const scope = batch[0]?.[1].scope;

      if (!scope || !isCurrentScope(scope)) {
        const staleRequestError = createStaleRequestError();
        batch.forEach(([, entry]) => entry.reject(staleRequestError));
        continue;
      }

      const controller = new AbortController();
      const activeBatch = { controller, entries: batch };
      activeBatches.add(activeBatch);

      try {
        const result = await dependencies.requestSignedUrls({
          paths: batch.map(([, entry]) => entry.ref.path),
          requestSession: batch[0][1].requestSession,
          signal: controller.signal,
        });

        if (!isCurrentScope(scope)) {
          throw createStaleRequestError();
        }

        const signedUrlsByPath = new Map(
          result.items.map((item) => [item.path, item.signedUrl]),
        );
        batch.forEach(([cacheKey, entry]) => {
          if (!isCurrentScope(entry.scope)) {
            entry.reject(createStaleRequestError());
            return;
          }

          const signedUrl = signedUrlsByPath.get(entry.ref.path);

          if (!signedUrl) {
            entry.reject(new Error('Private media URL response was incomplete.'));
            return;
          }

          cacheUrl(cacheKey, signedUrl, result.expiresInSeconds);
          entry.resolve(signedUrl);
        });
      } catch (error) {
        batch.forEach(([, entry]) => entry.reject(error));
      } finally {
        activeBatches.delete(activeBatch);
      }
    }
  };

  const enqueue = (
    ref: StorageAssetRef,
    requestSession: SignedReadRequestSession,
    scope: SignedReadScope,
  ) => {
    if (!isCurrentScope(scope)) {
      return Promise.reject(createStaleRequestError());
    }

    const cacheKey = `${scope.userId}:${scope.generation}:${ref.bucket}/${ref.path}`;
    const cached = cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now() + 30_000) {
      return Promise.resolve(cached.signedUrl);
    }

    const existingRequest = inFlight.get(cacheKey);

    if (existingRequest) {
      return existingRequest;
    }

    let request: Promise<string>;
    request = new Promise<string>((resolve, reject) => {
      pending.set(cacheKey, { ref, reject, requestSession, resolve, scope });

      if (!batchScheduled) {
        batchScheduled = true;
        void Promise.resolve().then(flushBatch);
      }
    }).finally(() => {
      if (inFlight.get(cacheKey) === request) {
        inFlight.delete(cacheKey);
      }
    });
    inFlight.set(cacheKey, request);
    return request;
  };

  const resolveMany = async (refs: StorageAssetRef[]) => {
    if (refs.length === 0) {
      return [];
    }

    const { requestSession, scope } = await resolveRequestSession();
    return Promise.all(refs.map((ref) => enqueue(ref, requestSession, scope)));
  };

  return {
    purge() {
      reset(null);
    },
    async resolve(ref: StorageAssetRef) {
      const resolvedUrl = (await resolveMany([ref]))[0];

      if (!resolvedUrl) {
        throw new Error('Private media URL response was incomplete.');
      }

      return resolvedUrl;
    },
    resolveMany,
  };
}
