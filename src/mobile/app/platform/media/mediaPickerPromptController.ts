import { useSyncExternalStore } from 'react';

import type {
  MediaPickerPromptOptions,
  MediaPickerPromptSelection,
} from '@/mobile/app/platform/media/mediaPickerTypes';

type MediaPickerPromptState = {
  options: MediaPickerPromptOptions;
  requestId: number;
  visible: boolean;
};

type Listener = () => void;

const listeners = new Set<Listener>();

let activeResolver: ((value: MediaPickerPromptSelection | null) => void) | null = null;
let state: MediaPickerPromptState = {
  options: {},
  requestId: 0,
  visible: false,
};

function emitChange() {
  listeners.forEach((listener) => listener());
}

function updateState(nextState: MediaPickerPromptState) {
  state = nextState;
  emitChange();
}

export function subscribeToMediaPickerPrompt(listener: Listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getMediaPickerPromptSnapshot() {
  return state;
}

export function useMediaPickerPromptState() {
  return useSyncExternalStore(
    subscribeToMediaPickerPrompt,
    getMediaPickerPromptSnapshot,
    getMediaPickerPromptSnapshot,
  );
}

export function openMediaPickerPrompt(options: MediaPickerPromptOptions = {}) {
  if (activeResolver) {
    activeResolver(null);
    activeResolver = null;
  }

  updateState({
    options,
    requestId: state.requestId + 1,
    visible: true,
  });

  return new Promise<MediaPickerPromptSelection | null>((resolve) => {
    activeResolver = resolve;
  });
}

export function resolveMediaPickerPrompt(value: MediaPickerPromptSelection | null) {
  const resolver = activeResolver;
  activeResolver = null;
  updateState({
    ...state,
    visible: false,
  });
  resolver?.(value);
}

export function resetMediaPickerPromptForTests() {
  activeResolver = null;
  updateState({
    options: {},
    requestId: 0,
    visible: false,
  });
}
