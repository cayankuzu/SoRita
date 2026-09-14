import React from 'react';
import { StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  Camera: (props: Record<string, unknown>) => React.createElement('Camera', props),
  Crosshair: (props: Record<string, unknown>) => React.createElement('Crosshair', props),
  Ellipsis: (props: Record<string, unknown>) => React.createElement('Ellipsis', props),
  Globe: (props: Record<string, unknown>) => React.createElement('Globe', props),
  Heart: (props: Record<string, unknown>) => React.createElement('Heart', props),
  List: (props: Record<string, unknown>) => React.createElement('List', props),
  Lock: (props: Record<string, unknown>) => React.createElement('Lock', props),
  PlayCircle: (props: Record<string, unknown>) => React.createElement('PlayCircle', props),
  Star: (props: Record<string, unknown>) => React.createElement('Star', props),
}));

vi.mock('@/mobile/app/shared/components/feedback/DeferredActionMenuSheet', () => ({
  DeferredActionMenuSheet: (props: Record<string, unknown>) =>
    React.createElement('DeferredActionMenuSheet', props),
}));

vi.mock('@/mobile/app/shared/components/maps/MiniMapInteractionHint', () => ({
  MiniMapInteractionHint: (props: Record<string, unknown>) =>
    React.createElement('MiniMapInteractionHint', props),
}));

vi.mock('@/mobile/app/shared/components/maps/MiniMapPreview', () => ({
  MiniMapPreview: (props: Record<string, unknown>) => React.createElement('MiniMapPreview', props),
}));

vi.mock('@/mobile/app/shared/components/maps/useMiniMapInteraction', () => ({
  useMiniMapInteraction: () => {
    const [isMapInteractive, setIsMapInteractive] = React.useState(false);
    return {
      activateMap: () => setIsMapInteractive(true),
      deactivateMap: () => setIsMapInteractive(false),
      isMapInteractive,
      mapFocusKey: 0,
      showInteractionHint: false,
    };
  },
}));

vi.mock('@/mobile/app/shared/components/media/MediaThumbnailView', () => ({
  MediaThumbnailView: (props: Record<string, unknown>) =>
    React.createElement('MediaThumbnailView', props),
}));

vi.mock('@/mobile/app/shared/components/ui/AppImage', () => ({
  AppImage: (props: Record<string, unknown>) => React.createElement('AppImage', props),
}));

vi.mock('@/mobile/app/shared/components/ui/AvatarView', () => ({
  AvatarView: (props: Record<string, unknown>) => React.createElement('AvatarView', props),
}));

vi.mock('@/mobile/app/shared/components/ui/ExpandableText', () => ({
  ExpandableText: (props: Record<string, unknown>) => React.createElement('ExpandableText', props),
}));

vi.mock('@/mobile/app/shared/components/ui/HighlightedText', () => ({
  HighlightedText: (props: Record<string, unknown>) => React.createElement('HighlightedText', props),
}));

vi.mock('@/mobile/app/shared/hooks/useAppLayout', () => ({
  useAppLayout: () => ({ columnGap: 8, height: 800, width: 390 }),
}));

import type { Place, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { ListGridTile } from '@/mobile/app/features/discovery/ui/components/ListGridTile';
import { OwnerHeader } from '@/mobile/app/features/discovery/ui/components/OwnerHeader';
import { PlaceGridTile } from '@/mobile/app/features/discovery/ui/components/PlaceGridTile';
import { tr } from '@/mobile/app/shared/i18n/tr';

const owner: User = {
  email: 'ada@example.com',
  id: 'user-1',
  name: 'Ada',
  username: 'ada',
};

const place: Place = {
  addedAt: '2026-01-01T10:00:00.000Z',
  id: 'place-1',
  lat: 41.01,
  lng: 28.97,
  name: 'Kıyı Kafe',
};

const list: PlaceList = {
  createdAt: '2026-01-01T10:00:00.000Z',
  id: 'list-1',
  isPublic: true,
  name: 'Hafta Sonu',
  places: [place],
  updatedAt: '2026-01-01T10:00:00.000Z',
  userId: owner.id,
};

function isDescendantOf(
  node: TestRenderer.ReactTestInstance,
  ancestor: TestRenderer.ReactTestInstance,
) {
  let parent = node.parent;
  while (parent) {
    if (parent === ancestor) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

function verifyMapToggle(renderer: TestRenderer.ReactTestRenderer, mainLabelPrefix: string) {
  const getMapAction = (label: string) => renderer.root
    .findAllByType('Pressable' as unknown as React.ElementType)
    .find((node) => node.props.accessibilityLabel === label);
  const mainAction = renderer.root
    .findAllByType('Pressable' as unknown as React.ElementType)
    .find((node) => node.props.accessibilityLabel?.startsWith(mainLabelPrefix));
  const focusAction = getMapAction(tr.cards.focusMiniMap);
  const menuAction = renderer.root
    .findAllByType('Pressable' as unknown as React.ElementType)
    .find((node) => node.props.accessibilityLabel === tr.common.contentActionsTitle);

  expect(mainAction).toBeDefined();
  expect(focusAction).toBeDefined();
  expect(menuAction).toBeDefined();
  expect(focusAction?.props.onLongPress).toBeUndefined();
  expect(focusAction?.props.accessibilityState).toEqual({ selected: false });
  expect(StyleSheet.flatten(focusAction?.props.style)).toMatchObject({ width: 48, height: 48 });
  expect(StyleSheet.flatten(menuAction?.props.style)).toMatchObject({ width: 48, height: 48 });
  expect(isDescendantOf(focusAction!, mainAction!)).toBe(false);
  expect(isDescendantOf(menuAction!, mainAction!)).toBe(false);

  act(() => {
    focusAction?.props.onPress({ stopPropagation: vi.fn() });
  });

  const hideAction = getMapAction(tr.cards.hideMiniMap);
  expect(hideAction?.props.accessibilityState).toEqual({ selected: true });

  act(() => {
    hideAction?.props.onPress({ stopPropagation: vi.fn() });
  });
  expect(getMapAction(tr.cards.focusMiniMap)?.props.accessibilityState).toEqual({ selected: false });
}

describe('discovery tile controls', () => {
  it('toggles a list mini-map without a hidden long-press gesture', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <ListGridTile
          list={list}
          menuActions={[{ key: 'report', label: 'Bildir', onPress: vi.fn() }]}
          onPress={vi.fn()}
        />,
      );
    });

    verifyMapToggle(renderer, `${tr.common.list}:`);
  });

  it('toggles a place mini-map without a hidden long-press gesture', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <PlaceGridTile
          place={place}
          menuActions={[{ key: 'report', label: 'Bildir', onPress: vi.fn() }]}
          onPress={vi.fn()}
        />,
      );
    });

    verifyMapToggle(renderer, `${tr.common.place}:`);
  });

  it('does not announce a static owner header as an actionable button', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<OwnerHeader owner={owner} />);
    });

    const header = renderer.root.findByType('Pressable' as unknown as React.ElementType);
    expect(header.props.accessibilityLabel).toContain(tr.cards.profile);
    expect(header.props.accessibilityRole).toBeUndefined();
    expect(header.props.disabled).toBe(true);
    expect(StyleSheet.flatten(header.props.style).minHeight).toBeGreaterThanOrEqual(44);
  });
});
