import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  Camera: (props: Record<string, unknown>) => React.createElement('Camera', props),
  List: (props: Record<string, unknown>) => React.createElement('List', props),
  MapPin: (props: Record<string, unknown>) => React.createElement('MapPin', props),
  Search: (props: Record<string, unknown>) => React.createElement('Search', props),
  Users: (props: Record<string, unknown>) => React.createElement('Users', props),
  X: (props: Record<string, unknown>) => React.createElement('X', props),
}));

vi.mock('@/mobile/app/shared/components/ui/InstantPressable', () => ({
  InstantPressable: (props: Record<string, unknown>) =>
    React.createElement('InstantPressable', props),
}));

vi.mock('@/mobile/app/shared/hooks/useAppLayout', () => ({
  useAppLayout: () => ({ screenPadding: 12 }),
}));

import { ExploreHeaderControls } from '@/mobile/app/features/explore/ui/components/ExploreHeaderControls';
import { tr } from '@/mobile/app/shared/i18n/tr';

describe('ExploreHeaderControls', () => {
  it('keeps search context tied to the active category and announces result updates', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ExploreHeaderControls
          activeTab="people"
          resultCount={7}
          resultsPending
          searchQuery="ada"
          onSearchQueryChange={vi.fn()}
          onTabChange={vi.fn()}
        />,
      );
    });

    const input = renderer.root.find(
      (node) => String(node.type) === 'TextInput',
    );
    expect(input.props.placeholder).toBe(tr.explore.search.person);
    expect(input.props.accessibilityLabel).toContain(tr.explore.tabs.people);
    expect(input.props.accessibilityState).toEqual({ busy: true });

    const liveStatus = renderer.root.find(
      (node) => node.props.accessibilityLiveRegion === 'polite',
    );
    expect(liveStatus.props.accessibilityState).toEqual({ busy: true });
    expect(liveStatus.props.children).toBe(tr.common.loading);

    const tabs = renderer.root.findAll(
      (node) => String(node.type) === 'InstantPressable' && node.props.accessibilityRole === 'tab',
    );
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual([
      tr.explore.tabs.lists,
      tr.explore.tabs.places,
      tr.explore.tabs.photos,
      tr.explore.tabs.people,
    ]);

    const tabRail = renderer.root.find(
      (node) => String(node.type) === 'ScrollView' && node.props.horizontal === true,
    );
    expect(tabRail.props.keyboardShouldPersistTaps).toBe('handled');
  });
});
