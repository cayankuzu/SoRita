import { createPromptController } from '@/mobile/app/platform/media/createPromptController';

export type VideoCameraCaptureOptions = {
  maxDurationSeconds?: number;
};

export type VideoCameraCaptureResult = {
  durationMs: number;
  uri: string;
};

const controller = createPromptController<VideoCameraCaptureOptions, VideoCameraCaptureResult>({});

export const subscribeToVideoCameraCapture = controller.subscribe;
export const getVideoCameraCaptureSnapshot = controller.getSnapshot;
export const useVideoCameraCaptureState = controller.useControllerState;
export const openVideoCameraCapture = controller.open;
export const resolveVideoCameraCapture = controller.resolve;
export const resetVideoCameraCaptureForTests = controller.resetForTests;
