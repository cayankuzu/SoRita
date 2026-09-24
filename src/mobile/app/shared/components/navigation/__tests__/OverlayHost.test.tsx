import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import { OverlayHost } from '@/mobile/app/shared/components/navigation/OverlayHost';

function Grid({ onUnmount }: { onUnmount: () => void }) {
  React.useEffect(() => onUnmount, [onUnmount]);
  return <Text>grid</Text>;
}

describe('OverlayHost', () => {
  it('keeps the screen mounted under the overlay, out of reach of touch and screen readers', () => {
    let unmounts = 0;
    const onUnmount = () => {
      unmounts += 1;
    };
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <OverlayHost overlay={null}>
          <Grid onUnmount={onUnmount} />
        </OverlayHost>,
      );
    });
    const screen = () => renderer.root.findByType(Grid).parent?.parent;
    expect(screen()?.props.pointerEvents).toBe('auto');
    expect(renderer.root.findAllByProps({ children: 'feed' })).toHaveLength(0);

    act(() => {
      renderer.update(
        <OverlayHost overlay={<Text>feed</Text>}>
          <Grid onUnmount={onUnmount} />
        </OverlayHost>,
      );
    });
    expect(unmounts).toBe(0);
    expect(renderer.root.findByProps({ children: 'feed' })).toBeTruthy();
    expect(screen()?.props).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
      pointerEvents: 'none',
    });

    act(() => {
      renderer.update(
        <OverlayHost overlay={null}>
          <Grid onUnmount={onUnmount} />
        </OverlayHost>,
      );
    });
    expect(unmounts).toBe(0);
    expect(screen()?.props.pointerEvents).toBe('auto');

    act(() => {
      renderer.unmount();
    });
  });
});
