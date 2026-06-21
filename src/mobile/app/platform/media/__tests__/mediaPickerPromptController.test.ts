import { afterEach, describe, expect, it } from 'vitest';

import {
  getMediaPickerPromptSnapshot,
  openMediaPickerPrompt,
  resetMediaPickerPromptForTests,
  resolveMediaPickerPrompt,
} from '@/mobile/app/platform/media/mediaPickerPromptController';

describe('mediaPickerPromptController', () => {
  afterEach(() => {
    resetMediaPickerPromptForTests();
  });

  it('opens the prompt and resolves with the selected source', async () => {
    const promptPromise = openMediaPickerPrompt();

    expect(getMediaPickerPromptSnapshot()).toEqual({
      options: {},
      visible: true,
      requestId: 1,
    });

    resolveMediaPickerPrompt({ source: 'camera', saveToGallery: true });

    await expect(promptPromise).resolves.toEqual({ source: 'camera', saveToGallery: true });
    expect(getMediaPickerPromptSnapshot().visible).toBe(false);
  });

  it('cancels any previous prompt when a new one opens', async () => {
    const firstPrompt = openMediaPickerPrompt();
    const secondPrompt = openMediaPickerPrompt();

    await expect(firstPrompt).resolves.toBeNull();
    expect(getMediaPickerPromptSnapshot()).toEqual({
      options: {},
      visible: true,
      requestId: 2,
    });

    resolveMediaPickerPrompt({ source: 'library', saveToGallery: false });

    await expect(secondPrompt).resolves.toEqual({ source: 'library', saveToGallery: false });
  });
});
