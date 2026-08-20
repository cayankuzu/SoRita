import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => {
  const Icon = (props: Record<string, unknown>) =>
    React.createElement('Icon', props);

  return {
    ChevronRight: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
    Clock: Icon,
    Globe: Icon,
    GraduationCap: Icon,
    Leaf: Icon,
    List: Icon,
    Lock: Icon,
    Repeat2: Icon,
    Shapes: Icon,
    Sparkles: Icon,
    Star: Icon,
  };
});

vi.mock('@/mobile/app/shared/components/media/MediaThumbnailView', () => ({
  MediaThumbnailView: (props: Record<string, unknown>) =>
    React.createElement('MediaThumbnailView', props),
}));

vi.mock('@/mobile/app/shared/components/ui/AppImage', () => ({
  AppImage: (props: Record<string, unknown>) =>
    React.createElement('AppImage', props),
}));

import { PlacePrimaryMedia } from '@/mobile/app/features/places/ui/components/place-card/PlaceCardSections';

describe('PlacePrimaryMedia', () => {
  it('pages through every media item and opens the visible item', () => {
    const onPress = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <PlacePrimaryMedia
          media={[
            { id: 'photo-1', type: 'photo', url: 'https://example.com/1.jpg' },
            { id: 'photo-2', type: 'photo', url: 'https://example.com/2.jpg' },
          ]}
          onPress={onPress}
          placeName="Test mekânı"
        />,
      );
    });

    const layoutNode = renderer.root.find(
      (node) => typeof node.props.onLayout === 'function',
    );
    act(() => {
      layoutNode.props.onLayout({ nativeEvent: { layout: { width: 320 } } });
    });

    const pager = renderer.root.find(
      (node) => node.props.pagingEnabled === true,
    );
    act(() => {
      pager.props.onMomentumScrollEnd({
        nativeEvent: { contentOffset: { x: 320 } },
      });
    });

    const counter = renderer.root.find(
      (node) => Array.isArray(node.props.children)
        && node.props.children.join('') === '2/2',
    );
    expect(counter.props.children).toEqual([2, '/', 2]);

    const secondMediaButton = renderer.root.find(
      (node) => node.props.accessibilityLabel?.endsWith('fotoğraf 2')
        && typeof node.props.onPress === 'function',
    );
    act(() => secondMediaButton.props.onPress());
    expect(onPress).toHaveBeenCalledWith(1);
  });
});
