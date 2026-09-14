import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  Search: (props: Record<string, unknown>) => React.createElement('Search', props),
  Users: (props: Record<string, unknown>) => React.createElement('Users', props),
  X: (props: Record<string, unknown>) => React.createElement('X', props),
}));

vi.mock('@/mobile/app/shared/components/ui/AvatarView', () => ({
  AvatarView: (props: Record<string, unknown>) => React.createElement('AvatarView', props),
}));

vi.mock('@/mobile/app/shared/components/ui/IconButton', () => ({
  IconButton: (props: Record<string, unknown>) => React.createElement('IconButton', props),
}));

import { LikersPanel } from '@/mobile/app/features/social/ui/components/LikersPanel';

function findHost(renderer: TestRenderer.ReactTestRenderer, type: string) {
  return renderer.root.find((node) => String(node.type) === type);
}

describe('LikersPanel search', () => {
  it('matches Turkish names with an ASCII query', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    let headerRenderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <LikersPanel
          likeCount={2}
          likers={[
            { id: 'turkish', name: 'Çağrı Işık', username: 'cagri' },
            { id: 'other', name: 'Deniz Kaya', username: 'deniz' },
          ]}
          onClose={vi.fn()}
        />,
      );
    });

    act(() => {
      headerRenderer = TestRenderer.create(findHost(renderer, 'FlatList').props.ListHeaderComponent);
    });

    act(() => {
      findHost(headerRenderer, 'TextInput').props.onChangeText('cagri isik');
    });

    expect(findHost(renderer, 'FlatList').props.data.map((item: { id: string }) => item.id)).toEqual([
      'turkish',
    ]);
    expect(findHost(renderer, 'FlatList').props.keyboardDismissMode).toBe('on-drag');
    expect(findHost(renderer, 'FlatList').props.keyboardShouldPersistTaps).toBe('handled');
  });
});
