import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCachePathAsyncMock = vi.fn();
const loadAsyncMock = vi.fn();
const resolveStorageAssetUrlMock = vi.fn();
const resolveStorageAssetUrlsMock = vi.fn();

vi.mock('expo-image', () => {
  const Image = Object.assign(
    (props: Record<string, unknown>) => React.createElement('ExpoImage', props),
    {
      getCachePathAsync: getCachePathAsyncMock,
      loadAsync: loadAsyncMock,
    },
  );

  return { Image };
});

vi.mock('@/mobile/app/platform/supabase/media', () => ({
  isStorageAssetUri: (uri?: string | null) => Boolean(uri?.startsWith('sorita-storage://')),
  resolveStorageAssetUrl: resolveStorageAssetUrlMock,
  resolveStorageAssetUrls: resolveStorageAssetUrlsMock,
}));

describe('AppImage media cache', () => {
  beforeEach(async () => {
    getCachePathAsyncMock.mockReset();
    loadAsyncMock.mockReset();
    resolveStorageAssetUrlMock.mockReset();
    resolveStorageAssetUrlsMock.mockReset();
    getCachePathAsyncMock.mockResolvedValue(null);
    loadAsyncMock.mockResolvedValue({});
    const { appImageInternals } = await import('@/mobile/app/shared/components/ui/AppImage');
    appImageInternals.clear();
  });

  it('prefetches signed media with the stable storage URI as its cache key', async () => {
    const storageUri = 'sorita-storage://place-media-private/user/place/photo-a.jpg';
    const signedUri = 'https://storage.example/photo-a.jpg?token=short-lived';
    resolveStorageAssetUrlsMock.mockResolvedValue([signedUri]);

    const { prefetchAppImages } = await import('@/mobile/app/shared/components/ui/AppImage');

    await expect(prefetchAppImages([storageUri, storageUri])).resolves.toBe(true);

    expect(resolveStorageAssetUrlsMock).toHaveBeenCalledWith([storageUri]);
    expect(loadAsyncMock).toHaveBeenCalledWith({
      cacheKey: storageUri,
      uri: signedUri,
    });
  });

  it('uses the private disk cache before requesting a new signed URL', async () => {
    const storageUri = 'sorita-storage://place-media-private/user/place/photo-b.jpg';
    getCachePathAsyncMock.mockResolvedValue('/data/user/0/app/cache/photo-b.jpg');

    const { AppImage } = await import('@/mobile/app/shared/components/ui/AppImage');
    let renderer!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<AppImage uri={storageUri} />);
      await Promise.resolve();
    });

    const image = renderer.root.findByType('ExpoImage' as unknown as React.ElementType);
    expect(image.props.source).toEqual({
      cacheKey: storageUri,
      uri: 'file:///data/user/0/app/cache/photo-b.jpg',
    });
    expect(resolveStorageAssetUrlMock).not.toHaveBeenCalled();
  });

  it('does not hand the private storage scheme to the native image view', async () => {
    const storageUri = 'sorita-storage://place-media-private/user/place/photo-c.jpg';
    let resolveSignedUri!: (uri: string) => void;
    resolveStorageAssetUrlMock.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveSignedUri = resolve;
      }),
    );

    const { AppImage } = await import('@/mobile/app/shared/components/ui/AppImage');
    let renderer!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<AppImage uri={storageUri} />);
      await Promise.resolve();
    });

    expect(
      renderer.root.findAllByType('ExpoImage' as unknown as React.ElementType),
    ).toHaveLength(0);

    await act(async () => {
      resolveSignedUri('https://storage.example/photo-c.jpg?token=valid');
      await Promise.resolve();
    });

    expect(
      renderer.root.findByType('ExpoImage' as unknown as React.ElementType).props.source,
    ).toEqual({
      cacheKey: storageUri,
      uri: 'https://storage.example/photo-c.jpg?token=valid',
    });
  });

  it('passes the default BlurHash as an Expo Image placeholder object', async () => {
    const uri = 'https://image.example/cover.jpg';
    resolveStorageAssetUrlMock.mockResolvedValue(uri);
    const { AppImage, appImageInternals } = await import(
      '@/mobile/app/shared/components/ui/AppImage'
    );
    let renderer!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<AppImage uri={uri} />);
      await Promise.resolve();
    });

    expect(
      renderer.root.findByType('ExpoImage' as unknown as React.ElementType).props.placeholder,
    ).toEqual({ blurhash: appImageInternals.DEFAULT_IMAGE_BLURHASH });
  });

  it('deduplicates concurrent private source resolution', async () => {
    const storageUri = 'sorita-storage://place-media-private/user/place/shared.jpg';
    const signedUri = 'https://storage.example/shared.jpg?token=valid';
    resolveStorageAssetUrlMock.mockResolvedValue(signedUri);
    const { AppImage } = await import('@/mobile/app/shared/components/ui/AppImage');

    await act(async () => {
      TestRenderer.create(
        <>
          <AppImage uri={storageUri} />
          <AppImage uri={storageUri} />
        </>,
      );
      await Promise.resolve();
    });

    expect(getCachePathAsyncMock).toHaveBeenCalledTimes(1);
    expect(resolveStorageAssetUrlMock).toHaveBeenCalledTimes(1);
  });

  it('bounds each speculative prefetch job', async () => {
    const uris = Array.from({ length: 40 }, (_, index) => `https://image.example/${index}.jpg`);
    resolveStorageAssetUrlsMock.mockImplementation(async (values: string[]) => values);
    const { appImageInternals, prefetchAppImages } = await import(
      '@/mobile/app/shared/components/ui/AppImage'
    );

    await expect(prefetchAppImages(uris)).resolves.toBe(true);

    expect(resolveStorageAssetUrlsMock).toHaveBeenCalledWith(
      uris.slice(0, appImageInternals.MAX_PREFETCH_URIS_PER_JOB),
    );
  });

  it('cancels a queued prefetch before it consumes network work', async () => {
    let releaseFirstJob!: (uris: string[]) => void;
    resolveStorageAssetUrlsMock.mockReturnValueOnce(
      new Promise<string[]>((resolve) => {
        releaseFirstJob = resolve;
      }),
    );
    const { prefetchAppImages } = await import('@/mobile/app/shared/components/ui/AppImage');
    const firstJob = prefetchAppImages(['https://image.example/first.jpg']);
    await Promise.resolve();

    const controller = new AbortController();
    const cancelledJob = prefetchAppImages(
      ['https://image.example/obsolete.jpg'],
      { signal: controller.signal },
    );
    controller.abort();

    await expect(cancelledJob).resolves.toBe(false);
    releaseFirstJob(['https://image.example/first.jpg']);
    await expect(firstJob).resolves.toBe(true);
    expect(resolveStorageAssetUrlsMock).toHaveBeenCalledTimes(1);
  });
});
