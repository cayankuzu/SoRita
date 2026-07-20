import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { InteractionManager } from 'react-native';

vi.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

vi.mock('lucide-react-native', () => ({
  MapPin: () => null,
}));

vi.mock('@/mobile/app/platform/config/env', () => ({
  env: { googleMapsApiKey: 'public-map-key' },
}));

vi.mock('@/mobile/app/shared/components/maps/AppMapView', () => ({
  AppMapView: () => null,
}));

vi.mock('@/mobile/app/shared/components/ui/AppImage', () => ({
  AppImage: (props: Record<string, unknown>) => React.createElement('AppImage', props),
}));

import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';

describe('MiniMapPreview', () => {
  it('shows a local fallback and defers static-map network work until interactions finish', () => {
    let startDeferredPreview: (() => void) | undefined;
    const cancel = vi.fn();
    vi.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation((callback) => {
      if (typeof callback === 'function') {
        startDeferredPreview = callback;
      }

      return { cancel } as unknown as ReturnType<typeof InteractionManager.runAfterInteractions>;
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
});
