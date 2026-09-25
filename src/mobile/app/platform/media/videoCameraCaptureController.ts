import { createPromptController } from '@/mobile/app/platform/media/createPromptController';

type VideoCameraCaptureOptions = {
  maxDurationSeconds?: number;
};

type VideoCameraCaptureResult = {
  durationMs: number;
  uri: string;
};

const controller = createPromptController<VideoCameraCaptureOptions, VideoCameraCaptureResult>({});

export const getVideoCameraCaptureSnapshot = controller.getSnapshot;
export const useVideoCameraCaptureState = controller.useControllerState;
export const openVideoCameraCapture = controller.open;
export const resolveVideoCameraCapture = controller.resolve;
export const resetVideoCameraCaptureForTests = controller.resetForTests;
