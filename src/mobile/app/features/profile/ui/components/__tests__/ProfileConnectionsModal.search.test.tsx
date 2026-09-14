import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  Search: (props: Record<string, unknown>) => React.createElement('Search', props),
  Users: (props: Record<string, unknown>) => React.createElement('Users', props),
  X: (props: Record<string, unknown>) => React.createElement('X', props),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

vi.mock('@/mobile/app/shared/hooks/useModalAnimationType', () => ({
  useModalAnimationType: () => 'none',
}));

vi.mock('@/mobile/app/shared/components/ui/AvatarView', () => ({
  AvatarView: (props: Record<string, unknown>) => React.createElement('AvatarView', props),
}));

vi.mock('@/mobile/app/shared/components/ui/ExpandableText', () => ({
  ExpandableText: (props: Record<string, unknown>) => React.createElement('ExpandableText', props),
}));

vi.mock('@/mobile/app/shared/components/ui/EmptyState', () => ({
  EmptyState: (props: Record<string, unknown>) => React.createElement('EmptyState', props),
}));

vi.mock('@/mobile/app/shared/components/ui/IconButton', () => ({
  IconButton: (props: Record<string, unknown>) => React.createElement('IconButton', props),
}));

import { ProfileConnectionsModal } from '@/mobile/app/features/profile/ui/components/ProfileConnectionsModal';

function findHost(renderer: TestRenderer.ReactTestRenderer, type: string) {
  return renderer.root.find((node) => String(node.type) === type);
}

describe('ProfileConnectionsModal search', () => {
  it('matches Turkish names with an ASCII query', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    let headerRenderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ProfileConnectionsModal
          emptyTitle="Bağlantı yok"
          onClose={vi.fn()}
          onUserPress={vi.fn()}
          title="Takipçiler"
          users={[
            {
              email: 'ozgur@example.com',
              id: 'turkish',
              name: 'Özgür Ünal',
              username: 'ozgur',
            },
            {
              email: 'deniz@example.com',
              id: 'other',
              name: 'Deniz Kaya',
              username: 'deniz',
            },
          ]}
          visible={false}
        />,
      );
    });

    act(() => {
      headerRenderer = TestRenderer.create(findHost(renderer, 'FlatList').props.ListHeaderComponent);
    });

    act(() => {
      findHost(headerRenderer, 'TextInput').props.onChangeText('ozgur unal');
    });

    expect(findHost(renderer, 'FlatList').props.data.map((item: { id: string }) => item.id)).toEqual([
      'turkish',
    ]);
  });

  it('keeps result taps responsive with the keyboard open and allows backdrop dismissal', () => {
    const onClose = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ProfileConnectionsModal
          emptyTitle="Bağlantı yok"
          onClose={onClose}
          onUserPress={vi.fn()}
          title="Takipçiler"
          users={[]}
          visible
        />,
      );
    });

    const list = findHost(renderer, 'FlatList');
    expect(list.props.keyboardDismissMode).toBe('on-drag');
    expect(list.props.keyboardShouldPersistTaps).toBe('handled');

    const backdrop = renderer.root.find(
      (node) =>
        String(node.type) === 'Pressable' &&
        node.props.importantForAccessibility === 'no-hide-descendants',
    );
    act(() => backdrop.props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
