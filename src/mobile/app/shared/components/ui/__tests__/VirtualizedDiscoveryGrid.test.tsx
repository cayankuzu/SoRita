import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native-safe-area-context', () => ({
  initialWindowMetrics: null,
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

import { VirtualizedDiscoveryGrid } from '@/mobile/app/shared/components/ui/VirtualizedDiscoveryGrid';

function renderGrid(data: string[]) {
  return (
    <VirtualizedDiscoveryGrid<string>
      columnStrategy="mosaic"
      data={data}
      keyExtractor={(item) => item}
      renderItem={() => null}
    />
  );
}

describe('VirtualizedDiscoveryGrid', () => {
  it('holds tiles in place only while there are tiles to hold', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(renderGrid(['a', 'b', 'c']));
    });
    const list = () => renderer.root.find((node) => String(node.type) === 'FlatList');
    expect(list().props.maintainVisibleContentPosition).toEqual({ minIndexForVisible: 0 });

    // A search replaced every suggestion: the empty message must show at the
    // top rather than wherever the old tiles left the scroll.
    act(() => {
      renderer.update(renderGrid([]));
    });
    expect(list().props.maintainVisibleContentPosition).toBeUndefined();
  });
});
