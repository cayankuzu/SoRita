import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { View } from 'react-native';
import { describe, expect, it } from 'vitest';

import { ExplorePagerLayout } from '@/mobile/app/features/explore/ui/components/ExplorePagerLayout';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { useScrollAwayHeader } from '@/mobile/app/shared/hooks/useScrollAwayHeader';

function Layout() {
  const headerController = useScrollAwayHeader();

  return (
    <ExplorePagerLayout
      header={<AppText testID="browse-heading">Keşfet</AppText>}
      headerController={headerController}
      pager={<View testID="horizontal-pager" />}
    />
  );
}

describe('ExplorePagerLayout', () => {
  it('keeps the screen header outside the horizontal swipe boundary', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<Layout />);
    });

    const stationaryHeader = renderer.root.findByProps({
      testID: 'explore-stationary-header',
    });
    const swipeContent = renderer.root.findByProps({ testID: 'explore-swipe-content' });

    expect(stationaryHeader.findByProps({ testID: 'browse-heading' })).toBeDefined();
    expect(
      stationaryHeader.findAllByProps({ testID: 'horizontal-pager' }),
    ).toHaveLength(0);
    expect(swipeContent.findByProps({ testID: 'horizontal-pager' })).toBeDefined();
  });
});
