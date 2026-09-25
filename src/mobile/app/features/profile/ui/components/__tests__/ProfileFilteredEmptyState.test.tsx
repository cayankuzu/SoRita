import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  SlidersHorizontal: (props: Record<string, unknown>) =>
    React.createElement('SlidersHorizontal', props),
}));
vi.mock('@/mobile/app/shared/components/ui/EmptyState', () => ({
  EmptyState: (props: Record<string, unknown>) => React.createElement('EmptyState', props),
}));

import { ProfileFilteredEmptyState } from '@/mobile/app/features/profile/ui/components/ProfileFilteredEmptyState';
import { tr } from '@/mobile/app/shared/i18n/tr';

describe('ProfileFilteredEmptyState', () => {
  it('names the filter that left the tab empty and offers everything back', () => {
    const onShowAll = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <ProfileFilteredEmptyState onShowAll={onShowAll} tab="lists" visibility="private" />,
      );
    });

    const state = renderer.root.find((node) => String(node.type) === 'EmptyState');
    expect(state.props.title).toBe('Özel listen yok');
    expect(state.props.actionLabel).toBe(tr.profile.empty.showAll);
    state.props.onAction();
    expect(onShowAll).toHaveBeenCalledOnce();
  });

  it('words each tab and visibility', () => {
    expect(tr.profile.empty.filteredTitle('places', 'public')).toBe('Herkese açık mekânın yok');
    expect(tr.profile.empty.filteredTitle('gallery', 'private')).toBe('Özel fotoğrafın yok');
  });
});
