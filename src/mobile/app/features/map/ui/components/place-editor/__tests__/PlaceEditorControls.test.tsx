import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  Star: (props: Record<string, unknown>) => React.createElement('Star', props),
  StarHalf: (props: Record<string, unknown>) => React.createElement('StarHalf', props),
}));

vi.mock('@/mobile/app/shared/components/ui/InstantPressable', () => ({
  InstantPressable: (props: Record<string, unknown>) =>
    React.createElement('InstantPressable', props),
}));

import { OptionRail } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorControls';

describe('OptionRail', () => {
  it('delivers the first option tap while the editor keyboard is visible', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <OptionRail options={['Kafe', 'Restoran']} selectedValues={[]} onToggle={vi.fn()} />,
      );
    });

    const rail = renderer.root.find(
      (node) => String(node.type) === 'ScrollView' && node.props.horizontal === true,
    );

    expect(rail.props.keyboardShouldPersistTaps).toBe('handled');
  });
});
