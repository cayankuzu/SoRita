import { useSyncExternalStore } from 'react';

import type {
  MediaLibraryPickerAsset,
  MediaLibrarySelectionOptions,
} from '@/mobile/app/platform/media/mediaLibrarySelectionTypes';

type MediaLibrarySelectionState = {
  options: MediaLibrarySelectionOptions;
  requestId: number;
  visible: boolean;
};

type Listener = () => void;

const listeners = new Set<Listener>();

let activeResolver: ((value: MediaLibraryPickerAsset[] | null) => void) | null = null;
let state: MediaLibrarySelectionState = {
  options: {},
  requestId: 0,
  visible: false,
};

function emitChange() {
  listeners.forEach((listener) => listener());
}

function updateState(nextState: MediaLibrarySelectionState) {
  state = nextState;
  emitChange();
}

export function subscribeToMediaLibrarySelection(listener: Listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getMediaLibrarySelectionSnapshot() {
  return state;
}

export function useMediaLibrarySelectionState() {
  return useSyncExternalStore(
    subscribeToMediaLibrarySelection,
    getMediaLibrarySelectionSnapshot,
    getMediaLibrarySelectionSnapshot,
  );
}

export function openMediaLibrarySelection(options: MediaLibrarySelectionOptions = {}) {
  if (activeResolver) {
    activeResolver(null);
    activeResolver = null;
  }

  updateState({
    options,
    requestId: state.requestId + 1,
    visible: true,
  });

  return new Promise<MediaLibraryPickerAsset[] | null>((resolve) => {
    activeResolver = resolve;
  });
}

export function resolveMediaLibrarySelection(value: MediaLibraryPickerAsset[] | null) {
  const resolver = activeResolver;
  activeResolver = null;
  updateState({
    ...state,
    visible: false,
  });
  resolver?.(value);
}

export function resetMediaLibrarySelectionForTests() {
  activeResolver = null;
  updateState({
    options: {},
    requestId: 0,
    visible: false,
  });
}
