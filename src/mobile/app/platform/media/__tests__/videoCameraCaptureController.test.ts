import { afterEach, describe, expect, it } from 'vitest';

import {
  getVideoCameraCaptureSnapshot,
  openVideoCameraCapture,
  resetVideoCameraCaptureForTests,
  resolveVideoCameraCapture,
} from '@/mobile/app/platform/media/videoCameraCaptureController';

describe('videoCameraCaptureController', () => {
  afterEach(() => {
    resetVideoCameraCaptureForTests();
  });

  it('opens the recorder and resolves with the captured video', async () => {
    const capturePromise = openVideoCameraCapture({ maxDurationSeconds: 180 });

    expect(getVideoCameraCaptureSnapshot()).toEqual({
      options: { maxDurationSeconds: 180 },
      requestId: 1,
      visible: true,
    });

    resolveVideoCameraCapture({ durationMs: 180000, uri: 'file:///cache/capture.mp4' });

    await expect(capturePromise).resolves.toEqual({
      durationMs: 180000,
      uri: 'file:///cache/capture.mp4',
    });
    expect(getVideoCameraCaptureSnapshot().visible).toBe(false);
  });

  it('cancels any previous recorder session when a new one opens', async () => {
    const firstCapture = openVideoCameraCapture();
    const secondCapture = openVideoCameraCapture({ maxDurationSeconds: 90 });

    await expect(firstCapture).resolves.toBeNull();
    expect(getVideoCameraCaptureSnapshot()).toEqual({
      options: { maxDurationSeconds: 90 },
      requestId: 2,
      visible: true,
    });

    resolveVideoCameraCapture({ durationMs: 90000, uri: 'file:///cache/short-capture.mp4' });

    await expect(secondCapture).resolves.toEqual({
      durationMs: 90000,
      uri: 'file:///cache/short-capture.mp4',
    });
  });
});
