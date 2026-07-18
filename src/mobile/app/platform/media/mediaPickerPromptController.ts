import { createPromptController } from '@/mobile/app/platform/media/createPromptController';
import type {
  MediaPickerPromptOptions,
  MediaPickerPromptSelection,
} from '@/mobile/app/platform/media/mediaPickerTypes';

const controller = createPromptController<MediaPickerPromptOptions, MediaPickerPromptSelection>({});

export const subscribeToMediaPickerPrompt = controller.subscribe;
export const getMediaPickerPromptSnapshot = controller.getSnapshot;
export const useMediaPickerPromptState = controller.useControllerState;
export const openMediaPickerPrompt = controller.open;
export const resolveMediaPickerPrompt = controller.resolve;
export const resetMediaPickerPromptForTests = controller.resetForTests;
