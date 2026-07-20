import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { View } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-navigation/bottom-tabs', () => ({
  BottomTabBarHeightContext: React.createContext(0),
}));

import { ProfilePagedScrollContainer } from '@/mobile/app/features/profile/ui/components/ProfilePagedScrollContainer';

describe('ProfilePagedScrollContainer', () => {
  it('keeps the profile header outside the horizontal content pager', () => {
    const header = <View testID="profile-header" />;
    const pager = <View testID="profile-content-pager" />;
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ProfilePagedScrollContainer header={header} pager={pager} />,
      );
    });

    const outerList = renderer.root.find(
      (node) => String(node.type) === 'FlatList',
    );
    expect(outerList.props.testID).toBe('profile-outer-scroll');
    expect(outerList.props.horizontal).not.toBe(true);
    expect(outerList.props.ListHeaderComponent).toBe(header);
    expect(outerList.props.renderItem({ item: 'profile-content' })).toBe(pager);
  });
});
