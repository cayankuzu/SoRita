import React from 'react';
import { StyleSheet } from 'react-native';
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

  it('decodes only the photo on show and its neighbours', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    const media = [1, 2, 3, 4, 5].map((index) => ({
      id: `photo-${index}`,
      type: 'photo' as const,
      url: `https://example.com/${index}.jpg`,
    }));

    act(() => {
      renderer = TestRenderer.create(
        <PlacePrimaryMedia media={media} onPress={vi.fn()} placeName="Test mekânı" />,
      );
    });

    const renderedPhotos = () =>
      renderer.root
        .findAll((node) => node.type === ('MediaThumbnailView' as unknown as React.ElementType))
        .map((node) => (node.props.item as { id: string }).id);
    expect(renderedPhotos()).toEqual(['photo-1', 'photo-2']);

    const pager = renderer.root.find((node) => node.props.pagingEnabled === true);
    act(() => {
      pager.props.onLayout({ nativeEvent: { layout: { width: 320 } } });
    });
    act(() => {
      pager.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 640 } } });
    });

    expect(renderedPhotos()).toEqual(['photo-2', 'photo-3', 'photo-4']);
  });

  it('sizes pages from the pager and keeps the inset off the aspect-ratio frame', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <PlacePrimaryMedia
          media={[{ id: 'photo-1', type: 'photo', url: 'https://example.com/1.jpg' }]}
          onPress={vi.fn()}
          placeName="Test mekânı"
        />,
      );
    });

    const pager = renderer.root.find((node) => node.props.pagingEnabled === true);
    act(() => {
      pager.props.onLayout({ nativeEvent: { layout: { width: 318 } } });
    });

    const page = renderer.root.find(
      (node) => node.props.accessibilityLabel?.endsWith('fotoğraf 1')
        && typeof node.props.onPress === 'function',
    );
    expect(StyleSheet.flatten(page.props.style).width).toBe(318);

    // Yoga drops a horizontal margin twice on a stretched child that also has
    // an aspectRatio, so the frame must take its inset from its parent.
    const frame = renderer.root.find(
      (node) => typeof node.type === 'string'
        && StyleSheet.flatten(node.props.style)?.aspectRatio !== undefined,
    );
    const frameStyle = StyleSheet.flatten(frame.props.style);
    for (const key of ['margin', 'marginHorizontal', 'marginLeft', 'marginRight'] as const) {
      expect(frameStyle[key]).toBeUndefined();
    }
  });
});
