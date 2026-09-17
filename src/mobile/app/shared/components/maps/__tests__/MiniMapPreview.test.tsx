import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

const { runAfterNextPaintMock } = vi.hoisted(() => ({
  runAfterNextPaintMock: vi.fn(),
}));

vi.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

vi.mock('lucide-react-native', () => ({
  MapPin: () => null,
}));

vi.mock('@/mobile/app/platform/config/env', () => ({
  env: { googleMapsStaticApiKey: 'public-static-map-key' },
}));

vi.mock('@/mobile/app/shared/components/maps/AppMapView', () => ({
  AppMapView: () => null,
}));

vi.mock('@/mobile/app/shared/components/ui/AppImage', () => ({
  AppImage: (props: Record<string, unknown>) => React.createElement('AppImage', props),
}));

vi.mock('@/mobile/app/shared/utils/interaction', () => ({
  runAfterNextPaint: runAfterNextPaintMock,
}));

import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';

describe('MiniMapPreview', () => {
  it('shows a local fallback and defers static-map network work until interactions finish', () => {
    let startDeferredPreview: (() => void) | undefined;
    const cancel = vi.fn();
    runAfterNextPaintMock.mockImplementation((callback: () => void) => {
      startDeferredPreview = callback;
      return cancel;
    });

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <MiniMapPreview places={[{ lat: 41.0082, lng: 28.9784, name: 'Galata' }]} />,
      );
    });

    const appImage = () => renderer.root.find((node) => String(node.type) === 'AppImage');
    expect(appImage().props.uri).toBeNull();

    act(() => {
      startDeferredPreview?.();
    });

    expect(appImage().props.uri).toContain(
      'https://maps.googleapis.com/maps/api/staticmap?',
    );

    act(() => renderer.unmount());
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('keeps the unavailable message for real failures and shows motion while loading', () => {
    runAfterNextPaintMock.mockImplementation((callback: () => void) => {
      callback();
      return vi.fn();
    });

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <MiniMapPreview places={[{ lat: 41.0082, lng: 28.9784, name: 'Galata' }]} />,
      );
    });

    const appImage = () => renderer.root.find((node) => String(node.type) === 'AppImage');
    const fallbackText = () => {
      let fallbackRenderer!: TestRenderer.ReactTestRenderer;
      act(() => {
        fallbackRenderer = TestRenderer.create(
          appImage().props.fallback as React.ReactElement,
        );
      });
      const text = JSON.stringify(fallbackRenderer.toJSON());
      act(() => fallbackRenderer.unmount());
      return text;
    };

    expect(appImage().props.showLoader).toBe(false);
    expect(fallbackText()).not.toContain('hazır değil');

    act(() => {
      appImage().props.onError?.();
    });

    expect(fallbackText()).toContain('hazır değil');
  });

  it('does not schedule static-map work for a card outside the visible window', () => {
    runAfterNextPaintMock.mockClear();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <MiniMapPreview
          loadStaticPreview={false}
          places={[{ lat: 41.0082, lng: 28.9784, name: 'Galata' }]}
        />,
      );
    });

    const appImage = renderer.root.find((node) => String(node.type) === 'AppImage');
    expect(appImage.props.uri).toBeNull();
    expect(runAfterNextPaintMock).not.toHaveBeenCalled();

    // A card waiting for its turn is still a card with a map, so it must not apologise.
    let fallbackRenderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      fallbackRenderer = TestRenderer.create(appImage.props.fallback as React.ReactElement);
    });
    expect(JSON.stringify(fallbackRenderer.toJSON())).not.toContain('hazır değil');
    act(() => fallbackRenderer.unmount());
  });

  it('keeps the unavailable message when no static map can exist', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<MiniMapPreview places={[]} />);
    });

    const appImage = renderer.root.find((node) => String(node.type) === 'AppImage');
    let fallbackRenderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      fallbackRenderer = TestRenderer.create(appImage.props.fallback as React.ReactElement);
    });

    expect(JSON.stringify(fallbackRenderer.toJSON())).toContain('hazır değil');
    act(() => fallbackRenderer.unmount());
  });
});
