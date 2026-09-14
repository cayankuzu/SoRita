import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { View } from 'react-native';
import { describe, expect, it } from 'vitest';

import { ProfilePagedScrollContainer } from '@/mobile/app/features/profile/ui/components/ProfilePagedScrollContainer';

describe('ProfilePagedScrollContainer', () => {
  it('does not create a same-axis outer virtualized list around the pager', () => {
    const pager = <View testID="profile-content-pager" />;
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ProfilePagedScrollContainer pager={pager} />,
      );
    });

    expect(
      renderer.root.findAll((node) => String(node.type) === 'FlatList'),
    ).toHaveLength(0);
    expect(renderer.root.findByProps({ testID: 'profile-content-pager' })).toBeDefined();
    expect(renderer.root.findByProps({ testID: 'profile-paged-container' })).toBeDefined();
  });
});
