import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import { useMiniMapInteraction } from '@/mobile/app/shared/components/maps/useMiniMapInteraction';

function MiniMapHarness({ id }: { id: string }) {
  const interaction = useMiniMapInteraction(id);
  return React.createElement('MiniMapHarness', { id, ...interaction });
}

describe('useMiniMapInteraction', () => {
  it('keeps only the most recently activated mini map interactive', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <>
          <MiniMapHarness id="first" />
          <MiniMapHarness id="second" />
        </>,
      );
    });

    const getMap = (id: string) =>
      renderer.root.find(
        (node) => String(node.type) === 'MiniMapHarness' && node.props.id === id,
      );

    act(() => getMap('first').props.activateMap());
    expect(getMap('first').props.isMapInteractive).toBe(true);
    expect(getMap('second').props.isMapInteractive).toBe(false);

    act(() => getMap('second').props.activateMap());
    expect(getMap('first').props.isMapInteractive).toBe(false);
    expect(getMap('second').props.isMapInteractive).toBe(true);

    act(() => renderer.unmount());
  });
});
