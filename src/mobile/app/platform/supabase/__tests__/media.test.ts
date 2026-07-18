import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const getSessionMock = vi.fn();
const refreshSessionMock = vi.fn();
const readAsStringAsyncMock = vi.fn();
const getInfoAsyncMock = vi.fn();
const makeDirectoryAsyncMock = vi.fn();
const copyAsyncMock = vi.fn();
const deleteAsyncMock = vi.fn();
const uploadAsyncMock = vi.fn();
const cancelUploadAsyncMock = vi.fn();
const createUploadTaskMock = vi.fn((url: string, fileUri: string, options: unknown) => ({
  cancelAsync: cancelUploadAsyncMock,
  uploadAsync: () => uploadAsyncMock(url, fileUri, options),
}));
const createSignedEdgeHeadersMock = vi.fn();
const storageUploadMock = vi.fn();
const storageRemoveMock = vi.fn();
const storageGetPublicUrlMock = vi.fn();

vi.mock('@/mobile/app/platform/config/env', () => ({
  env: {
    supabaseMediaAssetsFunctionName: 'media-assets',
    supabasePublishableKey: 'anon-key',
    supabaseUrl: 'https://example.supabase.co',
  },
}));

vi.mock('@/mobile/app/platform/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      refreshSession: refreshSessionMock,
    },
    storage: {
      from: vi.fn(() => ({
        getPublicUrl: storageGetPublicUrlMock,
        remove: storageRemoveMock,
        upload: storageUploadMock,
      })),
    },
  },
}));

vi.mock('@/mobile/app/platform/security/requestSigning', () => ({
  createSignedEdgeHeaders: createSignedEdgeHeadersMock,
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///documents/',
  EncodingType: {
    Base64: 'base64',
  },
  copyAsync: copyAsyncMock,
  deleteAsync: deleteAsyncMock,
  FileSystemSessionType: {
    BACKGROUND: 'background',
  },
  FileSystemUploadType: {
    BINARY_CONTENT: 'binary',
  },
  getInfoAsync: getInfoAsyncMock,
  makeDirectoryAsync: makeDirectoryAsyncMock,
  readAsStringAsync: readAsStringAsyncMock,
  createUploadTask: createUploadTaskMock,
}));

const server = setupServer();

describe('platform/supabase/media', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  afterEach(() => {
    server.resetHandlers();
    vi.useRealTimers();
  });

  beforeEach(() => {
    getSessionMock.mockReset();
    refreshSessionMock.mockReset();
    readAsStringAsyncMock.mockReset();
    getInfoAsyncMock.mockReset();
    makeDirectoryAsyncMock.mockReset();
    copyAsyncMock.mockReset();
    deleteAsyncMock.mockReset();
    uploadAsyncMock.mockReset();
    cancelUploadAsyncMock.mockReset();
    createUploadTaskMock.mockClear();
    createSignedEdgeHeadersMock.mockReset();
    storageUploadMock.mockReset();
    storageRemoveMock.mockReset();
    storageGetPublicUrlMock.mockReset();
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'session-token',
        },
      },
      error: null,
    });
    refreshSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'refreshed-session-token',
        },
      },
      error: null,
    });
    createSignedEdgeHeadersMock.mockResolvedValue({
      'x-device-id': 'device-1',
      'x-nonce': 'nonce-1',
      'x-signature': 'signature-1',
      'x-timestamp': '1234567890',
    });
    getInfoAsyncMock.mockResolvedValue({ exists: true, size: 1024 });
    makeDirectoryAsyncMock.mockResolvedValue(undefined);
    copyAsyncMock.mockResolvedValue(undefined);
    deleteAsyncMock.mockResolvedValue(undefined);
    uploadAsyncMock.mockResolvedValue({
      body: '',
      status: 200,
    });
    storageUploadMock.mockResolvedValue({ error: null });
    storageRemoveMock.mockResolvedValue({ error: null });
    storageGetPublicUrlMock.mockReturnValue({
      data: {
        publicUrl: 'https://example.supabase.co/storage/v1/object/public/place-media/user-1/fallback.jpg',
      },
    });
  });

  it('uploads local image assets through the media edge function', async () => {
    const requestBodies: unknown[] = [];

    readAsStringAsyncMock.mockResolvedValue('aGVsbG8=');
    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async ({ request }) => {
        requestBodies.push(await request.json());
        return HttpResponse.json({
          publicUrl: 'https://cdn.example/profile.jpg',
        });
      }),
    );

    const { uploadImageAsset } = await import('@/mobile/app/platform/supabase/media');
    await expect(uploadImageAsset({
      bucket: 'profile-media',
      prefix: 'profile',
      uri: 'file:///tmp/avatar.png?version=2',
      userId: 'user-1',
    })).resolves.toBe('https://cdn.example/profile.jpg');

    expect(requestBodies).toEqual([
      {
        action: 'upload',
        bucket: 'profile-media',
        contentType: 'image/png',
        extension: 'png',
        fileBase64: 'aGVsbG8=',
        prefix: 'profile',
      },
    ]);
  });

  it('falls back to copying unreadable local media before upload', async () => {
    const requestBodies: unknown[] = [];

    readAsStringAsyncMock
      .mockRejectedValueOnce(new Error('content uri unreadable'))
      .mockResolvedValueOnce('Y29udGVudA==');
    getInfoAsyncMock
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true, size: 1024 })
      .mockResolvedValueOnce({ exists: true });
    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async ({ request }) => {
        requestBodies.push(await request.json());
        return HttpResponse.json({
          publicUrl: 'https://cdn.example/profile-copied.jpg',
        });
      }),
    );

    const { uploadImageAsset } = await import('@/mobile/app/platform/supabase/media');
    await expect(uploadImageAsset({
      bucket: 'profile-media',
      prefix: 'profile',
      uri: 'content://media/external/images/123',
      userId: 'user-1',
    })).resolves.toBe('https://cdn.example/profile-copied.jpg');

    expect(makeDirectoryAsyncMock).toHaveBeenCalledWith('file:///cache/media-upload-cache/', {
      intermediates: true,
    });
    expect(copyAsyncMock).toHaveBeenCalledWith({
      from: 'content://media/external/images/123',
      to: expect.stringMatching(/^file:\/\/\/cache\/media-upload-cache\/.+\.jpg$/),
    });
    expect(deleteAsyncMock).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/cache\/media-upload-cache\/.+\.jpg$/),
      { idempotent: true },
    );
    expect(requestBodies).toEqual([
      {
        action: 'upload',
        bucket: 'profile-media',
        contentType: 'image/jpeg',
        extension: 'jpg',
        fileBase64: 'Y29udGVudA==',
        prefix: 'profile',
      },
    ]);
  });

  it('deletes only deduplicated in-scope storage paths', async () => {
    const requestBodies: unknown[] = [];

    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async ({ request }) => {
        requestBodies.push(await request.json());
        return HttpResponse.json({
          success: true,
        });
      }),
    );

    const { deleteStorageAssetsByUrls } = await import('@/mobile/app/platform/supabase/media');
    await deleteStorageAssetsByUrls({
      bucket: 'place-media',
      urls: [
        'https://example.supabase.co/storage/v1/object/public/place-media/user-1/cover.jpg',
        'https://example.supabase.co/storage/v1/object/public/place-media/user-1/cover.jpg',
        'sorita-storage://place-media-private/user-1/list-1/place.jpg',
        'sorita-storage://place-media-private/user-1/list-1/place.jpg',
        'https://example.supabase.co/storage/v1/object/public/profile-media/user-1/ignore.jpg',
      ],
    });

    expect(requestBodies).toEqual([
      {
        action: 'delete',
        bucket: 'place-media',
        paths: ['user-1/cover.jpg'],
      },
      {
        action: 'delete',
        bucket: 'place-media-private',
        paths: ['user-1/list-1/place.jpg'],
      },
    ]);
  });

  it('resolves private storage refs through the media edge function', async () => {
    const requestBodies: unknown[] = [];

    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async ({ request }) => {
        requestBodies.push(await request.json());
        return HttpResponse.json({
          expiresInSeconds: 300,
          signedUrl: 'https://storage.example/read/user-1/list-1/place.jpg?token=read',
        });
      }),
    );

    const { resolveStorageAssetUrl } = await import('@/mobile/app/platform/supabase/media');
    await expect(
      resolveStorageAssetUrl('sorita-storage://place-media-private/user-1/list-1/place.jpg'),
    ).resolves.toBe('https://storage.example/read/user-1/list-1/place.jpg?token=read');
    await expect(
      resolveStorageAssetUrl('sorita-storage://place-media-private/user-1/list-1/place.jpg'),
    ).resolves.toBe('https://storage.example/read/user-1/list-1/place.jpg?token=read');

    expect(requestBodies).toEqual([
      {
        action: 'create-read-url',
        bucket: 'place-media-private',
        path: 'user-1/list-1/place.jpg',
      },
    ]);
  });

  it('retries upload requests when the media edge function temporarily returns 503', async () => {
    let requestCount = 0;

    readAsStringAsyncMock.mockResolvedValue('aGVsbG8=');
    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async () => {
        requestCount += 1;

        if (requestCount === 1) {
          return new HttpResponse('Temporary upstream failure', { status: 503 });
        }

        return HttpResponse.json({
          publicUrl: 'https://cdn.example/profile-retried.jpg',
        });
      }),
    );

    const { uploadImageAsset } = await import('@/mobile/app/platform/supabase/media');
    await expect(uploadImageAsset({
      bucket: 'profile-media',
      prefix: 'profile',
      uri: 'file:///tmp/avatar.jpg',
      userId: 'user-1',
    })).resolves.toBe('https://cdn.example/profile-retried.jpg');

    expect(requestCount).toBe(2);
    expect(createSignedEdgeHeadersMock).toHaveBeenCalledTimes(2);
  });

  it('refreshes the auth session and retries after a 401 response', async () => {
    const authorizationHeaders: string[] = [];
    let requestCount = 0;

    readAsStringAsyncMock.mockResolvedValue('aGVsbG8=');
    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async ({ request }) => {
        requestCount += 1;
        authorizationHeaders.push(request.headers.get('authorization') ?? '');

        if (requestCount === 1) {
          return new HttpResponse('Unauthorized', { status: 401 });
        }

        return HttpResponse.json({
          publicUrl: 'https://cdn.example/profile-refreshed.jpg',
        });
      }),
    );

    const { uploadImageAsset } = await import('@/mobile/app/platform/supabase/media');
    await expect(uploadImageAsset({
      bucket: 'profile-media',
      prefix: 'profile',
      uri: 'file:///tmp/avatar.jpg',
      userId: 'user-1',
    })).resolves.toBe('https://cdn.example/profile-refreshed.jpg');

    expect(refreshSessionMock).toHaveBeenCalledTimes(1);
    expect(createSignedEdgeHeadersMock.mock.calls).toEqual([
      [{ accessToken: 'session-token', bodyText: expect.any(String) }],
      [{ accessToken: 'refreshed-session-token', bodyText: expect.any(String) }],
    ]);
    expect(authorizationHeaders).toEqual([
      'Bearer session-token',
      'Bearer refreshed-session-token',
    ]);
  });

  it('fails closed when the edge function is not deployed', async () => {
    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async () =>
        HttpResponse.json(
          {
            message: 'Requested function was not found',
          },
          { status: 404 },
        )),
    );

    const { uploadPlaceMediaAsset } = await import('@/mobile/app/platform/supabase/media');
    await expect(uploadPlaceMediaAsset({
      extension: 'mp4',
      mimeType: 'video/mp4',
      prefix: 'places/video',
      uri: 'file:///tmp/video.mp4',
      userId: 'user-1',
    })).rejects.toThrow('Requested function was not found');

    expect(createUploadTaskMock).not.toHaveBeenCalled();
  });

  it('fails closed when the media function only supports legacy actions', async () => {
    readAsStringAsyncMock.mockResolvedValue('aGVsbG8=');
    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async () =>
        HttpResponse.json(
          {
            error: 'Invalid media action',
          },
          { status: 400 },
        )),
    );

    const { uploadImageAsset } = await import('@/mobile/app/platform/supabase/media');
    await expect(uploadImageAsset({
      bucket: 'profile-media',
      prefix: 'profile',
      uri: 'file:///tmp/avatar.jpg',
      userId: 'user-1',
    })).rejects.toThrow('Invalid media action');

    expect(createUploadTaskMock).not.toHaveBeenCalled();
  });

  it('fails closed when an older media function enforces a stale place-media limit', async () => {
    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async () =>
        HttpResponse.json(
          {
            error: 'Dosya boyutu limiti asildi. En fazla 5 MB destekleniyor.',
          },
          { status: 413 },
        )),
    );

    const { uploadPlaceMediaAsset } = await import('@/mobile/app/platform/supabase/media');
    await expect(uploadPlaceMediaAsset({
      extension: 'mp4',
      mimeType: 'video/mp4',
      prefix: 'places/video',
      uri: 'file:///tmp/video.mp4',
      userId: 'user-1',
    })).rejects.toThrow('Dosya boyutu limiti asildi');

    expect(createUploadTaskMock).not.toHaveBeenCalled();
  });

  it('surfaces a friendly size-limit message when signed place-media uploads return payload too large', async () => {
    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async () =>
        HttpResponse.json({
          objectPath: 'user-1/places/video.mp4',
          storageUri: 'sorita-storage://place-media-private/user-1/places/video.mp4',
          signedUrl: 'https://storage.example/upload',
        })),
    );
    uploadAsyncMock.mockResolvedValueOnce({
      body: 'Payload too large',
      status: 413,
    });

    const { uploadPlaceMediaAsset } = await import('@/mobile/app/platform/supabase/media');
    await expect(uploadPlaceMediaAsset({
      extension: 'mp4',
      mimeType: 'video/mp4',
      prefix: 'places/video',
      uri: 'file:///tmp/video.mp4',
      userId: 'user-1',
    })).rejects.toThrow(
      'Seçtiğin içeriklerden biri 47 MB limitini aşıyor. Bu kartı kapatmadan içeriği değiştirip tekrar deneyebilirsin.',
    );
  });

  it('fails closed when the media function is unavailable for deletes', async () => {
    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async () =>
        HttpResponse.json(
          {
            message: 'Requested function was not found',
          },
          { status: 404 },
        )),
    );

    const { deleteStorageAssetsByUrls } = await import('@/mobile/app/platform/supabase/media');
    await expect(deleteStorageAssetsByUrls({
      bucket: 'place-media',
      urls: ['https://example.supabase.co/storage/v1/object/public/place-media/user-1/cover.jpg'],
    })).rejects.toThrow('Requested function was not found');

    expect(storageRemoveMock).not.toHaveBeenCalled();
  });

  it('surfaces rate limits instead of bypassing them with direct storage uploads', async () => {
    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async () =>
        HttpResponse.json(
          {
            code: 'rate_limited',
            error: 'Medya istek sinirina ulasildi. Lutfen 45 saniye sonra tekrar deneyin.',
            retryAfterSeconds: 45,
          },
          {
            headers: {
              'Retry-After': '45',
            },
            status: 429,
          },
        )),
    );

    const { uploadPlaceMediaAsset } = await import('@/mobile/app/platform/supabase/media');
    await expect(uploadPlaceMediaAsset({
      extension: 'jpg',
      mimeType: 'image/jpeg',
      prefix: 'places/cover',
      uri: 'file:///tmp/place.jpg',
      userId: 'user-1',
    })).rejects.toThrow('Medya istek sinirina ulasildi');

    expect(createUploadTaskMock).not.toHaveBeenCalled();
  });

  it('automatically retries short media-function rate limits before surfacing an error', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-28T12:00:00.000Z'));
    let requestCount = 0;

    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async () => {
        requestCount += 1;

        if (requestCount === 1) {
          return HttpResponse.json(
            {
              code: 'rate_limited',
              error: 'Medya istek sinirina ulasildi. Lutfen 6 saniye sonra tekrar deneyin.',
              retryAfterSeconds: 6,
            },
            {
              headers: {
                'Retry-After': '6',
              },
              status: 429,
            },
          );
        }

        return HttpResponse.json({
          objectPath: 'user-1/places/cover.jpg',
          storageUri: 'sorita-storage://place-media-private/user-1/places/cover.jpg',
          signedUrl: 'https://storage.example/upload',
        });
      }),
    );

    const { uploadPlaceMediaAsset } = await import('@/mobile/app/platform/supabase/media');
    const uploadPromise = uploadPlaceMediaAsset({
      extension: 'jpg',
      mimeType: 'image/jpeg',
      prefix: 'places/cover',
      uri: 'file:///tmp/place.jpg',
      userId: 'user-1',
    });

    await vi.advanceTimersByTimeAsync(6000);

    await expect(uploadPromise).resolves.toBe(
      'sorita-storage://place-media-private/user-1/places/cover.jpg',
    );
    expect(requestCount).toBe(2);
  });

  it('surfaces delete rate limits instead of bypassing them with direct storage deletes', async () => {
    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async () =>
        HttpResponse.json(
          {
            code: 'rate_limited',
            error: 'Medya istek sinirina ulasildi. Lutfen biraz sonra tekrar deneyin.',
          },
          {
            headers: {
              'Retry-After': '75',
            },
            status: 429,
          },
        )),
    );

    const { deleteStorageAssetsByUrls } = await import('@/mobile/app/platform/supabase/media');
    await expect(deleteStorageAssetsByUrls({
      bucket: 'place-media',
      urls: ['https://example.supabase.co/storage/v1/object/public/place-media/user-1/cover.jpg'],
    })).rejects.toThrow('Medya istek sinirina ulasildi');

    expect(storageRemoveMock).not.toHaveBeenCalled();
  });
});
