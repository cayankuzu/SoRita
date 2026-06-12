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
const createSignedEdgeHeadersMock = vi.fn();

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
  getInfoAsync: getInfoAsyncMock,
  makeDirectoryAsync: makeDirectoryAsyncMock,
  readAsStringAsync: readAsStringAsyncMock,
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
  });

  beforeEach(() => {
    getSessionMock.mockReset();
    refreshSessionMock.mockReset();
    readAsStringAsyncMock.mockReset();
    getInfoAsyncMock.mockReset();
    makeDirectoryAsyncMock.mockReset();
    copyAsyncMock.mockReset();
    deleteAsyncMock.mockReset();
    createSignedEdgeHeadersMock.mockReset();
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
    getInfoAsyncMock.mockResolvedValue({ exists: true });
    makeDirectoryAsyncMock.mockResolvedValue(undefined);
    copyAsyncMock.mockResolvedValue(undefined);
    deleteAsyncMock.mockResolvedValue(undefined);
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
    getInfoAsyncMock.mockResolvedValue({ exists: false });
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
        'https://example.supabase.co/storage/v1/object/public/profile-media/user-1/ignore.jpg',
      ],
    });

    expect(requestBodies).toEqual([
      {
        action: 'delete',
        bucket: 'place-media',
        paths: ['user-1/cover.jpg'],
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
});
