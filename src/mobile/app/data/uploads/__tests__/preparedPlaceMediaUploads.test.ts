import { afterEach, describe, expect, it, vi } from 'vitest';

const { trackEventMock, uploadPlaceMediaAssetMock } = vi.hoisted(() => ({
  trackEventMock: vi.fn(),
  uploadPlaceMediaAssetMock: vi.fn(),
}));

vi.mock('@/mobile/app/platform/supabase/media', () => ({
  uploadPlaceMediaAsset: uploadPlaceMediaAssetMock,
}));

vi.mock('@/mobile/app/platform/analytics/analyticsEvents', () => ({
  trackEvent: trackEventMock,
}));

import {
  isLocalPlaceMediaUri,
  preparePlaceMediaUpload,
  preparedPlaceMediaUploadInternals,
  uploadPreparedPlaceMediaAsset,
} from '@/mobile/app/data/uploads/preparedPlaceMediaUploads';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const baseParams = {
  durationMs: 60_000,
  mediaType: 'video' as const,
  prefix: 'drafts/draft-1/0',
  uri: 'file:///video.mp4',
  userId: 'user-1',
};

describe('preparedPlaceMediaUploads', () => {
  afterEach(() => {
    preparedPlaceMediaUploadInternals.reset();
    uploadPlaceMediaAssetMock.mockReset();
    trackEventMock.mockReset();
    vi.useRealTimers();
  });

  it('starts video upload early and reuses it with current progress on save', async () => {
    const deferred = createDeferred<string | undefined>();
    let reportProgress: ((progress: { sentBytes: number; totalBytes: number }) => void) | undefined;
    uploadPlaceMediaAssetMock.mockImplementation((params) => {
      reportProgress = params.onProgress;
      return deferred.promise;
    });
    const onProgress = vi.fn();

    preparePlaceMediaUpload(baseParams);
    reportProgress?.({ sentBytes: 50, totalBytes: 100 });
    const claim = uploadPreparedPlaceMediaAsset({
      ...baseParams,
      onProgress,
      prefix: 'list-1/place-1/0',
    });

    expect(uploadPlaceMediaAssetMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith({
      name: 'upload_prepared_claimed',
      params: { mediaType: 'video' },
    });
    expect(onProgress).toHaveBeenCalledWith({ sentBytes: 50, totalBytes: 100 });
    deferred.resolve('sorita-storage://place-media-private/user-1/draft.mp4');
    await expect(claim).resolves.toContain('draft.mp4');
  });

  it('lets a cancelled save leave the prepared upload available for retry', async () => {
    const deferred = createDeferred<string | undefined>();
    uploadPlaceMediaAssetMock.mockReturnValue(deferred.promise);
    preparePlaceMediaUpload(baseParams);
    const controller = new AbortController();
    const cancelledClaim = uploadPreparedPlaceMediaAsset({ ...baseParams, signal: controller.signal });
    controller.abort();

    await expect(cancelledClaim).rejects.toMatchObject({ name: 'AbortError' });
    deferred.resolve('sorita-storage://place-media-private/user-1/retry.mp4');
    await deferred.promise;
    await expect(uploadPreparedPlaceMediaAsset(baseParams)).resolves.toContain('retry.mp4');
    expect(uploadPlaceMediaAssetMock).toHaveBeenCalledTimes(1);
  });

  it('cleans a completed preparation that was never claimed', async () => {
    vi.useFakeTimers();
    const onUnusedUpload = vi.fn();
    uploadPlaceMediaAssetMock.mockResolvedValue('sorita-storage://place-media-private/user-1/unused.mp4');

    preparePlaceMediaUpload({ ...baseParams, onUnusedUpload });
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(preparedPlaceMediaUploadInternals.PREPARED_UPLOAD_TTL_MS);

    expect(onUnusedUpload).toHaveBeenCalledWith(
      'sorita-storage://place-media-private/user-1/unused.mp4',
    );
  });

  it('ignores remote preparation and delegates remote claims', async () => {
    uploadPlaceMediaAssetMock.mockResolvedValue('https://cdn.example.com/video.mp4');
    expect(isLocalPlaceMediaUri('content://video/1')).toBe(true);
    expect(isLocalPlaceMediaUri('https://cdn.example.com/video.mp4')).toBe(false);

    preparePlaceMediaUpload({ ...baseParams, uri: 'https://cdn.example.com/video.mp4' });
    expect(uploadPlaceMediaAssetMock).not.toHaveBeenCalled();
    await expect(uploadPreparedPlaceMediaAsset({
      ...baseParams,
      uri: 'https://cdn.example.com/video.mp4',
    })).resolves.toContain('video.mp4');
  });

  it('drops failed and empty preparations so the next save can retry', async () => {
    uploadPlaceMediaAssetMock
      .mockRejectedValueOnce(new Error('upload failed'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('sorita-storage://place-media-private/user-1/recovered.mp4');

    await expect(uploadPreparedPlaceMediaAsset(baseParams)).rejects.toThrow('upload failed');
    await expect(uploadPreparedPlaceMediaAsset(baseParams)).resolves.toBeUndefined();
    await expect(uploadPreparedPlaceMediaAsset(baseParams)).resolves.toContain('recovered.mp4');
    expect(uploadPlaceMediaAssetMock).toHaveBeenCalledTimes(3);
  });

  it('deduplicates repeated preparation and normalizes optional key fields', async () => {
    const deferred = createDeferred<string | undefined>();
    uploadPlaceMediaAssetMock.mockReturnValue(deferred.promise);

    preparePlaceMediaUpload(baseParams);
    preparePlaceMediaUpload({ ...baseParams, prefix: 'drafts/another-prefix/0' });

    expect(uploadPlaceMediaAssetMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledTimes(1);
    expect(isLocalPlaceMediaUri()).toBe(false);
    expect(preparedPlaceMediaUploadInternals.getPreparedUploadKey({} as never)).toBe(
      '["","","","",0,0,0]',
    );
    deferred.resolve(undefined);
    await deferred.promise;
  });
});
