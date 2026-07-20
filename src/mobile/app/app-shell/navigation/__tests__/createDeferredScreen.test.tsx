import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const deferredCallbacks = vi.hoisted(() => [] as Array<() => void>);

vi.mock('@/mobile/app/shared/utils/interaction', () => ({
  runAfterNextPaint: (callback: () => void) => {
    deferredCallbacks.push(callback);
    return vi.fn();
  },
}));

import { createDeferredScreen } from '@/mobile/app/app-shell/navigation/createDeferredScreen';

describe('createDeferredScreen', () => {
  beforeEach(() => {
    deferredCallbacks.length = 0;
  });

  it('paints the route placeholder before evaluating a cold screen module', () => {
    const LoadedContent = () => null;
    const LoadedScreen = () => <LoadedContent />;
    const loadScreen = vi.fn(() => LoadedScreen);
    const DeferredScreen = createDeferredScreen(loadScreen);
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<DeferredScreen />);
    });

    expect(loadScreen).not.toHaveBeenCalled();
    expect(DeferredScreen.isPreloaded()).toBe(false);

    act(() => deferredCallbacks.shift()?.());

    expect(loadScreen).toHaveBeenCalledOnce();
    expect(DeferredScreen.isPreloaded()).toBe(true);
    expect(renderer!.root.findByType(LoadedContent)).toBeTruthy();
  });

  it('renders immediately when startup has already prepared the screen', () => {
    const LoadedScreen = () => null;
    const loadScreen = vi.fn(() => LoadedScreen);
    const DeferredScreen = createDeferredScreen(loadScreen);

    DeferredScreen.preload();

    act(() => {
      TestRenderer.create(<DeferredScreen />);
    });

    expect(loadScreen).toHaveBeenCalledOnce();
    expect(deferredCallbacks).toHaveLength(0);
  });
});
