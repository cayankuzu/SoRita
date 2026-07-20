import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveStorageAssetUrlMock = vi.fn();
const playMock = vi.fn();
const pauseMock = vi.fn();
const player = {
  audioMixingMode: 'auto',
  bufferOptions: {},
  currentTime: 0,
  loop: false,
  muted: false,
  pause: pauseMock,
  play: playMock,
};
const useVideoPlayerMock = vi.fn(
  (source: unknown, setup?: (nextPlayer: typeof player) => void) => {
    setup?.(player);
    return player;
  },
);

vi.mock('expo-video', () => ({
  useVideoPlayer: useVideoPlayerMock,
  VideoView: (props: Record<string, unknown>) => React.createElement('VideoView', props),
}));

vi.mock('lucide-react-native', () => ({
  Play: (props: Record<string, unknown>) => React.createElement('Play', props),
}));

vi.mock('@/mobile/app/platform/supabase/media', () => ({
  resolveStorageAssetUrl: resolveStorageAssetUrlMock,
}));

vi.mock('@/mobile/app/shared/components/ui/AppImage', () => ({
  AppImage: (props: Record<string, unknown>) => React.createElement('AppImage', props),
}));

describe('VideoPreview', () => {
  beforeEach(() => {
    resolveStorageAssetUrlMock.mockReset();
    playMock.mockReset();
    pauseMock.mockReset();
    useVideoPlayerMock.mockClear();
    player.audioMixingMode = 'auto';
    player.bufferOptions = {};
    player.currentTime = 0;
    player.loop = false;
    player.muted = false;
  });

  it('keeps the poster visible while resolving and caches the resolved video source', async () => {
    const storageUri = 'sorita-storage://place-media-private/user/place/video.mp4';
    const signedUri = 'https://storage.example/video.mp4?token=short-lived';
    let resolveVideo!: (uri: string) => void;
    resolveStorageAssetUrlMock.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveVideo = resolve;
      }),
    );

    const { VideoPreview } = await import('../VideoPreview');
    let renderer!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <VideoPreview posterUri="poster.jpg" uri={storageUri} />,
      );
      await Promise.resolve();
    });

    expect(useVideoPlayerMock).toHaveBeenCalledWith(null, expect.any(Function));
    expect(
      renderer.root.findByType('AppImage' as unknown as React.ElementType).props.uri,
    ).toBe('poster.jpg');
    expect(player.bufferOptions).toEqual({
      minBufferForPlayback: 0.75,
      preferredForwardBufferDuration: 8,
      prioritizeTimeOverSizeThreshold: true,
    });

    await act(async () => {
      resolveVideo(signedUri);
      await Promise.resolve();
    });

    expect(useVideoPlayerMock).toHaveBeenLastCalledWith(
      {
        contentType: 'progressive',
        uri: signedUri,
        useCaching: true,
      },
      expect.any(Function),
    );
    expect(useVideoPlayerMock.mock.calls.some(([source]) => source === storageUri)).toBe(false);

    const videoView = renderer.root.findByType(
      'VideoView' as unknown as React.ElementType,
    );
    expect(videoView.props.allowsVideoFrameAnalysis).toBe(false);
    expect(videoView.props.useExoShutter).toBe(false);

    act(() => {
      videoView.props.onFirstFrameRender();
    });

    expect(
      renderer.root.findAllByType('AppImage' as unknown as React.ElementType),
    ).toHaveLength(0);
  });
});
