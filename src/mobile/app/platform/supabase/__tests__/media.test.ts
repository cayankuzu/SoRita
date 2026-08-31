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
const createUploadTaskMock = vi.fn((url: string, fileUri: string, options: unknown, onProgress?: (value: { totalBytesExpectedToSend: number; totalBytesSent: number }) => void) => ({
  cancelAsync: cancelUploadAsyncMock,
  uploadAsync: () => {
    onProgress?.({ totalBytesExpectedToSend: 1024, totalBytesSent: 512 });
    return uploadAsyncMock(url, fileUri, options);
  },
}));
const downloadAsyncMock = vi.fn();
const createSignedEdgeHeadersMock = vi.fn();
const storageUploadMock = vi.fn();
const storageRemoveMock = vi.fn();
const storageGetPublicUrlMock = vi.fn();
const uploadSessionId = '11111111-1111-4111-8111-111111111111';

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

vi.mock('@/shared/utils/id', () => ({
  createUuid: () => '11111111-1111-4111-8111-111111111111',
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///documents/',
  EncodingType: {
    Base64: 'base64',
  },
  copyAsync: copyAsyncMock,
  deleteAsync: deleteAsyncMock,
  downloadAsync: downloadAsyncMock,
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

  beforeEach(async () => {
    getSessionMock.mockReset();
    refreshSessionMock.mockReset();
    readAsStringAsyncMock.mockReset();
    getInfoAsyncMock.mockReset();
    makeDirectoryAsyncMock.mockReset();
    copyAsyncMock.mockReset();
    deleteAsyncMock.mockReset();
    downloadAsyncMock.mockReset();
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
          user: { id: 'user-1' },
        },
      },
      error: null,
    });
    refreshSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'refreshed-session-token',
          user: { id: 'user-1' },
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
    downloadAsyncMock.mockResolvedValue({
      headers: {},
      mimeType: 'image/jpeg',
      status: 200,
      uri: 'file:///cache/private-cover-rehome/downloaded.jpg',
    });
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
    const { purgePrivateSignedReadUrlState } = await import(
      '@/mobile/app/platform/supabase/media'
    );
    purgePrivateSignedReadUrlState();
  });

  it('uploads local image assets with bounded control JSON and direct signed Storage PUT', async () => {
    const requestBodies: unknown[] = [];
    const publicUrl = 'https://example.supabase.co/storage/v1/object/public/profile-media/user-1/profile-final.png';

    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async ({ request }) => {
        const body = await request.json() as { action: string; objectPath?: string };
        requestBodies.push(body);
        return body.action === 'create-upload-url'
          ? HttpResponse.json({
              objectPath: 'user-1/pending-public/profile-media/profile-final.png',
              signedUrl: 'https://example.supabase.co/storage/v1/object/upload/sign/profile',
              uploadSessionId,
            })
          : HttpResponse.json({
              objectPath: 'user-1/profile-final.png',
              publicUrl,
              verified: true,
            });
      }),
    );

    const { uploadImageAsset } = await import('@/mobile/app/platform/supabase/media');
    await expect(uploadImageAsset({
      bucket: 'profile-media',
      prefix: 'profile',
      uri: 'file:///tmp/avatar.png?version=2',
      userId: 'user-1',
    })).resolves.toBe(publicUrl);

    expect(requestBodies).toEqual([
      {
        action: 'create-upload-url',
        bucket: 'profile-media',
        contentType: 'image/png',
        extension: 'png',
        fileSizeBytes: 1024,
        prefix: 'profile',
        uploadSessionId,
      },
      {
        action: 'complete-upload',
        bucket: 'profile-media',
        contentType: 'image/png',
        fileSizeBytes: 1024,
        mediaType: 'photo',
        objectPath: 'user-1/pending-public/profile-media/profile-final.png',
        uploadSessionId,
      },
    ]);
    expect(createUploadTaskMock).toHaveBeenCalledWith(
      'https://example.supabase.co/storage/v1/object/upload/sign/profile',
      'file:///tmp/avatar.png?version=2',
      expect.objectContaining({ httpMethod: 'PUT', uploadType: 'binary' }),
      undefined,
    );
    expect(JSON.stringify(requestBodies)).not.toContain('fileBase64');
  });

  it('rejects an untrusted signed upload destination before reading local media bytes', async () => {
    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async () =>
        HttpResponse.json({
          objectPath: 'user-1/pending-public/profile-media/profile-final.png',
          signedUrl: 'https://attacker.example/collect-local-file',
          uploadSessionId,
        })),
    );

    const { uploadImageAsset } = await import('@/mobile/app/platform/supabase/media');
    await expect(uploadImageAsset({
      bucket: 'profile-media',
      prefix: 'profile',
      uri: 'file:///tmp/avatar.png',
      userId: 'user-1',
    })).rejects.toThrow('invalid signed upload URL');

    expect(createUploadTaskMock).not.toHaveBeenCalled();
  });

  it('rehomes a managed public cover through local direct private upload', async () => {
    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async ({ request }) => {
        const body = await request.json() as { action: string; objectPath?: string };
        if (body.action === 'complete-upload') {
          return HttpResponse.json({
            objectPath: body.objectPath,
            storageUri: 'sorita-storage://place-media-private/user-1/list-1/cover-private.jpg',
            verified: true,
          });
        }
        return HttpResponse.json({
          objectPath: 'user-1/list-1/cover-private.jpg',
          signedUrl: 'https://example.supabase.co/storage/v1/object/upload/sign/private-cover',
          uploadSessionId,
        });
      }),
    );

    const { rehomePublicPlaceMediaAssetToPrivate } = await import(
      '@/mobile/app/platform/supabase/media'
    );
    await expect(rehomePublicPlaceMediaAssetToPrivate({
      prefix: 'list-1/cover',
      uri: 'https://example.supabase.co/storage/v1/object/public/place-media/user-1/list-1/cover.jpg',
      userId: 'user-1',
    })).resolves.toBe(
      'sorita-storage://place-media-private/user-1/list-1/cover-private.jpg',
    );

    expect(downloadAsyncMock).toHaveBeenCalledWith(
      'https://example.supabase.co/storage/v1/object/public/place-media/user-1/fallback.jpg',
      expect.stringMatching(/^file:\/\/\/cache\/private-cover-rehome\/.+\.jpg$/),
    );
    expect(deleteAsyncMock).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/cache\/private-cover-rehome\/.+\.jpg$/),
      { idempotent: true },
    );
  });

  it('falls back to copying unreadable local media before upload', async () => {
    const requestBodies: unknown[] = [];
    const publicUrl = 'https://example.supabase.co/storage/v1/object/public/profile-media/user-1/profile-copied.jpg';

    getInfoAsyncMock
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true, size: 1024 })
      .mockResolvedValueOnce({ exists: true });
    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async ({ request }) => {
        const body = await request.json() as { action: string; objectPath?: string };
        requestBodies.push(body);
        return body.action === 'create-upload-url'
          ? HttpResponse.json({
              objectPath: 'user-1/pending-public/profile-media/profile-copied.jpg',
              signedUrl: 'https://example.supabase.co/storage/v1/object/upload/sign/profile-copied',
              uploadSessionId,
            })
          : HttpResponse.json({
              objectPath: 'user-1/profile-copied.jpg',
              publicUrl,
              verified: true,
            });
      }),
    );

    const { uploadImageAsset } = await import('@/mobile/app/platform/supabase/media');
    await expect(uploadImageAsset({
      bucket: 'profile-media',
      prefix: 'profile',
      uri: 'content://media/external/images/123',
      userId: 'user-1',
    })).resolves.toBe(publicUrl);

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
        action: 'create-upload-url',
        bucket: 'profile-media',
        contentType: 'image/jpeg',
        extension: 'jpg',
        fileSizeBytes: 1024,
        prefix: 'profile',
        uploadSessionId,
      },
      {
        action: 'complete-upload',
        bucket: 'profile-media',
        contentType: 'image/jpeg',
        fileSizeBytes: 1024,
        mediaType: 'photo',
        objectPath: 'user-1/pending-public/profile-media/profile-copied.jpg',
        uploadSessionId,
      },
    ]);
    expect(createUploadTaskMock).toHaveBeenCalledWith(
      'https://example.supabase.co/storage/v1/object/upload/sign/profile-copied',
      'content://media/external/images/123',
      expect.objectContaining({ httpMethod: 'PUT', uploadType: 'binary' }),
      undefined,
    );
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
        const body = await request.json() as { paths: string[] };
        requestBodies.push(body);
        return HttpResponse.json({
          expiresInSeconds: 300,
          items: body.paths.map((path) => ({
            path,
            signedUrl: `https://storage.example/read/${path}?token=read`,
          })),
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
        action: 'create-read-urls',
        bucket: 'place-media-private',
        paths: ['user-1/list-1/place.jpg'],
      },
    ]);
  });

  it('waits for the persisted auth session before resolving cached private media', async () => {
    vi.useFakeTimers();
    getSessionMock
      .mockResolvedValueOnce({
        data: { session: null },
        error: null,
      })
      .mockResolvedValue({
        data: {
          session: {
            access_token: 'restored-session-token',
            user: { id: 'user-1' },
          },
        },
        error: null,
      });
    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async ({ request }) => {
        const body = await request.json() as { paths: string[] };
        return HttpResponse.json({
          expiresInSeconds: 300,
          items: body.paths.map((path) => ({
            path,
            signedUrl: `https://storage.example/read/${path}?token=restored-session`,
          })),
        });
      }),
    );

    const { resolveStorageAssetUrl } = await import('@/mobile/app/platform/supabase/media');
    const resolution = resolveStorageAssetUrl(
      'sorita-storage://place-media-private/user-1/list-startup/photo.jpg',
    );

    await vi.advanceTimersByTimeAsync(150);

    await expect(resolution).resolves.toBe(
      'https://storage.example/read/user-1/list-startup/photo.jpg?token=restored-session',
    );
    expect(getSessionMock).toHaveBeenCalledTimes(2);
    expect(createSignedEdgeHeadersMock).toHaveBeenCalledWith(expect.objectContaining({
      accessToken: 'restored-session-token',
    }));
  });

  it('coalesces private media URL resolution into one batch request', async () => {
    const requestBodies: Array<{ paths: string[] }> = [];

    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async ({ request }) => {
        const body = await request.json() as { paths: string[] };
        requestBodies.push(body);
        return HttpResponse.json({
          expiresInSeconds: 300,
          items: body.paths.map((path) => ({
            path,
            signedUrl: `https://storage.example/read/${path}?token=batch`,
          })),
        });
      }),
    );

    const { resolveStorageAssetUrls } = await import('@/mobile/app/platform/supabase/media');
    await expect(resolveStorageAssetUrls([
      'sorita-storage://place-media-private/user-1/list-2/one.jpg',
      'sorita-storage://place-media-private/user-1/list-2/two.jpg',
      'sorita-storage://place-media-private/user-1/list-2/one.jpg',
    ])).resolves.toEqual([
      'https://storage.example/read/user-1/list-2/one.jpg?token=batch',
      'https://storage.example/read/user-1/list-2/two.jpg?token=batch',
      'https://storage.example/read/user-1/list-2/one.jpg?token=batch',
    ]);

    expect(requestBodies).toEqual([{
      action: 'create-read-urls',
      bucket: 'place-media-private',
      paths: [
        'user-1/list-2/one.jpg',
        'user-1/list-2/two.jpg',
      ],
    }]);
  });

  it('never reuses a private signed URL after the authenticated user changes', async () => {
    let activeUserId = 'user-a';
    let requestCount = 0;
    getSessionMock.mockImplementation(async () => ({
      data: {
        session: {
          access_token: `token-${activeUserId}`,
          user: { id: activeUserId },
        },
      },
      error: null,
    }));
    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async ({ request }) => {
        requestCount += 1;
        const body = await request.json() as { paths: string[] };
        const authorization = request.headers.get('authorization') ?? '';
        return HttpResponse.json({
          expiresInSeconds: 300,
          items: body.paths.map((path) => ({
            path,
            signedUrl: `https://storage.example/read/${path}?owner=${authorization.slice(7)}`,
          })),
        });
      }),
    );

    const { resolveStorageAssetUrl } = await import('@/mobile/app/platform/supabase/media');
    const uri = 'sorita-storage://place-media-private/shared/photo.jpg';

    await expect(resolveStorageAssetUrl(uri)).resolves.toContain('owner=token-user-a');
    activeUserId = 'user-b';
    await expect(resolveStorageAssetUrl(uri)).resolves.toContain('owner=token-user-b');

    expect(requestCount).toBe(2);
  });

  it('rejects a signed-read batch that completes after its auth scope is purged', async () => {
    let releaseResponse!: () => void;
    let markRequestStarted: (() => void) | null = null;
    const requestStarted = new Promise<void>((resolve) => {
      markRequestStarted = resolve;
    });
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });

    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async ({ request }) => {
        const body = await request.json() as { paths: string[] };
        markRequestStarted?.();
        await responseGate;
        return HttpResponse.json({
          expiresInSeconds: 300,
          items: body.paths.map((path) => ({
            path,
            signedUrl: `https://storage.example/read/${path}?token=stale`,
          })),
        });
      }),
    );

    const {
      purgePrivateSignedReadUrlState,
      resolveStorageAssetUrl,
    } = await import('@/mobile/app/platform/supabase/media');
    const resolution = resolveStorageAssetUrl(
      'sorita-storage://place-media-private/user-1/stale.jpg',
    );

    await requestStarted;
    purgePrivateSignedReadUrlState();
    releaseResponse();

    await expect(resolution).rejects.toThrow('authorization state changed');
  });

  it('rejects untrusted and insecure media hosts while allowing managed storage', async () => {
    const { isAllowedMediaUri, resolveStorageAssetUrl } = await import('@/mobile/app/platform/supabase/media');

    expect(isAllowedMediaUri('https://example.supabase.co/storage/v1/object/public/place-media/a.jpg')).toBe(true);
    expect(isAllowedMediaUri('file:///documents/photo.jpg')).toBe(true);
    expect(isAllowedMediaUri('http://example.supabase.co/photo.jpg')).toBe(false);
    await expect(resolveStorageAssetUrl('https://tracker.example/photo.jpg')).rejects.toThrow(
      'not trusted',
    );
  });

  it('retries upload requests when the media edge function temporarily returns 503', async () => {
    let requestCount = 0;
    const publicUrl = 'https://example.supabase.co/storage/v1/object/public/profile-media/user-1/profile-retried.jpg';

    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async ({ request }) => {
        requestCount += 1;

        if (requestCount === 1) {
          return new HttpResponse('Temporary upstream failure', { status: 503 });
        }

        const body = await request.json() as { action: string };
        return body.action === 'create-upload-url'
          ? HttpResponse.json({
              objectPath: 'user-1/pending-public/profile-media/profile-retried.jpg',
              signedUrl: 'https://example.supabase.co/storage/v1/object/upload/sign/profile-retried',
              uploadSessionId,
            })
          : HttpResponse.json({ objectPath: 'user-1/profile-retried.jpg', publicUrl, verified: true });
      }),
    );

    const { uploadImageAsset } = await import('@/mobile/app/platform/supabase/media');
    await expect(uploadImageAsset({
      bucket: 'profile-media',
      prefix: 'profile',
      uri: 'file:///tmp/avatar.jpg',
      userId: 'user-1',
    })).resolves.toBe(publicUrl);

    expect(requestCount).toBe(3);
    expect(createSignedEdgeHeadersMock).toHaveBeenCalledTimes(3);
  });

  it('retries media edge requests when the network connection changes', async () => {
    let requestCount = 0;
    const publicUrl = 'https://example.supabase.co/storage/v1/object/public/profile-media/user-1/profile-network-retried.jpg';

    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async ({ request }) => {
        requestCount += 1;

        if (requestCount === 1) {
          return HttpResponse.error();
        }

        const body = await request.json() as { action: string };
        return body.action === 'create-upload-url'
          ? HttpResponse.json({
              objectPath: 'user-1/pending-public/profile-media/profile-network-retried.jpg',
              signedUrl: 'https://example.supabase.co/storage/v1/object/upload/sign/profile-network-retried',
              uploadSessionId,
            })
          : HttpResponse.json({
              objectPath: 'user-1/profile-network-retried.jpg',
              publicUrl,
              verified: true,
            });
      }),
    );

    const { uploadImageAsset } = await import('@/mobile/app/platform/supabase/media');
    await expect(uploadImageAsset({
      bucket: 'profile-media',
      prefix: 'profile',
      uri: 'file:///tmp/avatar.jpg',
      userId: 'user-1',
    })).resolves.toBe(publicUrl);

    expect(requestCount).toBe(3);
    expect(createSignedEdgeHeadersMock).toHaveBeenCalledTimes(3);
  });

  it('refreshes the auth session and retries after a 401 response', async () => {
    const authorizationHeaders: string[] = [];
    let requestCount = 0;
    const publicUrl = 'https://example.supabase.co/storage/v1/object/public/profile-media/user-1/profile-refreshed.jpg';

    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async ({ request }) => {
        requestCount += 1;
        authorizationHeaders.push(request.headers.get('authorization') ?? '');

        if (requestCount === 1) {
          return new HttpResponse('Unauthorized', { status: 401 });
        }

        const body = await request.json() as { action: string };
        return body.action === 'create-upload-url'
          ? HttpResponse.json({
              objectPath: 'user-1/pending-public/profile-media/profile-refreshed.jpg',
              signedUrl: 'https://example.supabase.co/storage/v1/object/upload/sign/profile-refreshed',
              uploadSessionId,
            })
          : HttpResponse.json({ objectPath: 'user-1/profile-refreshed.jpg', publicUrl, verified: true });
      }),
    );

    const { uploadImageAsset } = await import('@/mobile/app/platform/supabase/media');
    await expect(uploadImageAsset({
      bucket: 'profile-media',
      prefix: 'profile',
      uri: 'file:///tmp/avatar.jpg',
      userId: 'user-1',
    })).resolves.toBe(publicUrl);

    expect(refreshSessionMock).toHaveBeenCalledTimes(1);
    expect(createSignedEdgeHeadersMock.mock.calls).toEqual([
      [{ accessToken: 'session-token', bodyText: expect.any(String), functionName: 'media-assets', method: 'POST' }],
      [{ accessToken: 'refreshed-session-token', bodyText: expect.any(String), functionName: 'media-assets', method: 'POST' }],
      [{ accessToken: 'refreshed-session-token', bodyText: expect.any(String), functionName: 'media-assets', method: 'POST' }],
    ]);
    expect(authorizationHeaders).toEqual([
      'Bearer session-token',
      'Bearer refreshed-session-token',
      'Bearer refreshed-session-token',
    ]);
  });

  it('retries with the legacy signing protocol when the deployed function rejects v2', async () => {
    let requestCount = 0;
    const publicUrl = 'https://example.supabase.co/storage/v1/object/public/profile-media/user-1/profile-legacy-signature.jpg';

    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async ({ request }) => {
        requestCount += 1;

        if (requestCount === 1) {
          return HttpResponse.json(
            {
              code: 'invalid_signature',
              error: 'Request signature verification failed',
            },
            { status: 401 },
          );
        }

        const body = await request.json() as { action: string };
        return body.action === 'create-upload-url'
          ? HttpResponse.json({
              objectPath: 'user-1/pending-public/profile-media/profile-legacy-signature.jpg',
              signedUrl: 'https://example.supabase.co/storage/v1/object/upload/sign/profile-legacy-signature',
              uploadSessionId,
            })
          : HttpResponse.json({
              objectPath: 'user-1/profile-legacy-signature.jpg',
              publicUrl,
              verified: true,
            });
      }),
    );

    const { uploadImageAsset } = await import('@/mobile/app/platform/supabase/media');
    await expect(uploadImageAsset({
      bucket: 'profile-media',
      prefix: 'profile',
      uri: 'file:///tmp/avatar.jpg',
      userId: 'user-1',
    })).resolves.toBe(publicUrl);

    expect(refreshSessionMock).not.toHaveBeenCalled();
    expect(createSignedEdgeHeadersMock.mock.calls).toEqual([
      [{ accessToken: 'session-token', bodyText: expect.any(String), functionName: 'media-assets', method: 'POST' }],
      [{ accessToken: 'session-token', bodyText: expect.any(String), functionName: 'media-assets', legacy: true, method: 'POST' }],
      [{ accessToken: 'session-token', bodyText: expect.any(String), functionName: 'media-assets', method: 'POST' }],
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
          signedUrl: 'https://example.supabase.co/storage/v1/object/upload/sign/place',
          uploadSessionId,
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
      'Seçtiğin içeriklerden biri 134 MB limitini aşıyor. Bu kartı kapatmadan içeriği değiştirip tekrar deneyebilirsin.',
    );
  });

  it('restarts a signed storage upload after a temporary network failure', async () => {
    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async ({ request }) => {
        const body = await request.json() as { action: string; objectPath?: string };

        if (body.action === 'complete-upload') {
          return HttpResponse.json({
            objectPath: body.objectPath,
            storageUri: 'sorita-storage://place-media-private/user-1/places/retried.jpg',
            verified: true,
          });
        }

        return HttpResponse.json({
          objectPath: 'user-1/places/retried.jpg',
          storageUri: 'sorita-storage://place-media-private/user-1/places/retried.jpg',
          signedUrl: 'https://example.supabase.co/storage/v1/object/upload/sign/place-retry',
          uploadSessionId,
        });
      }),
    );
    uploadAsyncMock
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce({ body: '', status: 200 });

    const { uploadPlaceMediaAsset } = await import('@/mobile/app/platform/supabase/media');
    await expect(uploadPlaceMediaAsset({
      extension: 'jpg',
      mediaType: 'photo',
      mimeType: 'image/jpeg',
      prefix: 'places/retried',
      uri: 'file:///tmp/retried.jpg',
      userId: 'user-1',
    })).resolves.toBe(
      'sorita-storage://place-media-private/user-1/places/retried.jpg',
    );

    expect(createUploadTaskMock).toHaveBeenCalledTimes(2);
    expect(uploadAsyncMock).toHaveBeenCalledTimes(2);
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
      http.post('https://example.supabase.co/functions/v1/media-assets', async ({ request }) => {
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

        const body = await request.json() as { action: string; objectPath?: string };

        if (body.action === 'complete-upload') {
          return HttpResponse.json({
            objectPath: body.objectPath,
            storageUri: 'sorita-storage://place-media-private/user-1/places/cover.jpg',
            verified: true,
          });
        }

        return HttpResponse.json({
          objectPath: 'user-1/places/cover.jpg',
          storageUri: 'sorita-storage://place-media-private/user-1/places/cover.jpg',
          signedUrl: 'https://example.supabase.co/storage/v1/object/upload/sign/place-progress',
          uploadSessionId,
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
    expect(requestCount).toBe(3);
    expect(getSessionMock).toHaveBeenCalledTimes(1);
  });

  it('hands an orphaned object to the durable cleanup callback when finalize and cleanup fail', async () => {
    const onOrphanedUpload = vi.fn().mockResolvedValue(undefined);

    server.use(
      http.post('https://example.supabase.co/functions/v1/media-assets', async ({ request }) => {
        const body = await request.json() as { action: string };

        if (body.action === 'create-upload-url') {
          return HttpResponse.json({
            objectPath: 'user-1/places/orphan.jpg',
            signedUrl: 'https://example.supabase.co/storage/v1/object/upload/sign/place-session',
            uploadSessionId,
          });
        }

        if (body.action === 'complete-upload') {
          return HttpResponse.json({ error: 'metadata mismatch' }, { status: 422 });
        }

        return HttpResponse.json({ error: 'cleanup unavailable' }, { status: 400 });
      }),
    );

    const { uploadPlaceMediaAsset } = await import('@/mobile/app/platform/supabase/media');
    await expect(uploadPlaceMediaAsset({
      extension: 'jpg',
      mediaType: 'photo',
      mimeType: 'image/jpeg',
      onOrphanedUpload,
      prefix: 'places/orphan',
      uri: 'file:///tmp/orphan.jpg',
      userId: 'user-1',
    })).rejects.toThrow('metadata mismatch');

    expect(onOrphanedUpload).toHaveBeenCalledWith(
      'sorita-storage://place-media-private/user-1/places/orphan.jpg',
    );
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
