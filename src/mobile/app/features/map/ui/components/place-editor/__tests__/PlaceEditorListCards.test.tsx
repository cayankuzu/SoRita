import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  Globe: (props: Record<string, unknown>) => React.createElement('Globe', props),
  Info: (props: Record<string, unknown>) => React.createElement('Info', props),
  Lock: (props: Record<string, unknown>) => React.createElement('Lock', props),
}));

vi.mock('@/mobile/app/shared/components/maps/MiniMapPreview', () => ({
  MiniMapPreview: (props: Record<string, unknown>) =>
    React.createElement('MiniMapPreview', props),
}));

vi.mock('@/mobile/app/shared/components/ui/ExpandableText', () => ({
  ExpandableText: ({ text }: { text: string }) => <Text>{text}</Text>,
}));

import { PlaceEditorListCards } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorListCards';

describe('PlaceEditorListCards', () => {
  it('announces and blocks a list that already contains the place', () => {
    const onToggleList = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <PlaceEditorListCards
          currentMembershipListIds={new Set()}
          duplicateListIds={new Set(['duplicate-list'])}
          lists={[{
            id: 'duplicate-list',
            userId: 'viewer',
            name: 'Favoriler',
            places: [],
            isPublic: false,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          }]}
          selectedLists={[]}
          onToggleList={onToggleList}
        />,
      );
    });

    const listCard = renderer.root.findByProps({ accessibilityRole: 'checkbox' });

    expect(listCard.props.accessibilityState).toEqual({
      checked: false,
      disabled: true,
    });
    expect(listCard.props.accessibilityHint).toContain('Favoriler');

    act(() => {
      listCard.props.onPress();
    });

    expect(onToggleList).toHaveBeenCalledWith('duplicate-list', {
      blocked: true,
      listName: 'Favoriler',
    });
  });
});
