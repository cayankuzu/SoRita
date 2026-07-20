import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerWarnMock = vi.fn();
const requireOptionalNativeModuleMock = vi.fn();

vi.mock('@/mobile/app/platform/feedback/logger', () => ({
  logger: {
    warn: loggerWarnMock,
  },
}));

vi.mock('expo', () => ({
  requireOptionalNativeModule: requireOptionalNativeModuleMock,
}));

describe('platform/media/videoThumbnails', () => {
  beforeEach(() => {
    vi.resetModules();
    loggerWarnMock.mockReset();
    requireOptionalNativeModuleMock.mockReset();
  });

  it('returns a generated thumbnail uri when the native module is available', async () => {
    const getThumbnailMock = vi.fn().mockResolvedValue({ uri: 'file:///thumb.jpg' });
    requireOptionalNativeModuleMock.mockReturnValue({
      getThumbnail: getThumbnailMock,
    });

    const { generateVideoThumbnailUri } = await import('@/mobile/app/platform/media/videoThumbnails');
    const result = await generateVideoThumbnailUri('file:///clip.mp4', 120);

    expect(result).toBe('file:///thumb.jpg');
    expect(requireOptionalNativeModuleMock).toHaveBeenCalledWith('ExpoVideoThumbnails');
    expect(getThumbnailMock).toHaveBeenCalledWith('file:///clip.mp4', {
      quality: 0.72,
      time: 120,
    });
  });

  it('falls back gracefully when the native module is unavailable', async () => {
    requireOptionalNativeModuleMock.mockReturnValue(null);

    const { generateVideoThumbnailUri } = await import('@/mobile/app/platform/media/videoThumbnails');
    const result = await generateVideoThumbnailUri('file:///clip.mp4');

    expect(result).toBeUndefined();
    expect(loggerWarnMock).toHaveBeenCalledWith(
      'media',
      'ExpoVideoThumbnails native module is unavailable in this build.',
    );
  });
});
