import { createPromptController } from '@/mobile/app/platform/media/createPromptController';
import type {
  MediaLibraryPickerAsset,
  MediaLibrarySelectionOptions,
} from '@/mobile/app/platform/media/mediaLibrarySelectionTypes';

const controller = createPromptController<MediaLibrarySelectionOptions, MediaLibraryPickerAsset[]>(
  {},
);

export const subscribeToMediaLibrarySelection = controller.subscribe;
export const getMediaLibrarySelectionSnapshot = controller.getSnapshot;
export const useMediaLibrarySelectionState = controller.useControllerState;
export const openMediaLibrarySelection = controller.open;
export const resolveMediaLibrarySelection = controller.resolve;
export const resetMediaLibrarySelectionForTests = controller.resetForTests;
