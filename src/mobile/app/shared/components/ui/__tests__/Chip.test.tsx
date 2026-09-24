import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { Chip, chipContentColor } from '@/mobile/app/shared/components/ui/Chip';
import { colors, controlSize, hitSlopFor } from '@/mobile/app/shared/theme/tokens';

function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  const pressable = renderer.root.find((node) => String(node.type) === 'Pressable');
  return { renderer, pressable };
}

describe('Chip', () => {
  it('announces a filter as a selected tab and a choice as a checked checkbox', () => {
    const filter = render(<Chip kind="filter" label="Listeler" onPress={vi.fn()} selected />);
    expect(filter.pressable.props.accessibilityRole).toBe('tab');
    expect(filter.pressable.props.accessibilityState).toMatchObject({ selected: true });

    const choice = render(<Chip label="Öğrenci dostu" onPress={vi.fn()} selected={false} />);
    expect(choice.pressable.props.accessibilityRole).toBe('checkbox');
    expect(choice.pressable.props.accessibilityState).toMatchObject({ checked: false });
  });

  it('keeps a radio group on checked state rather than selected', () => {
    const { pressable } = render(
      <Chip accessibilityRole="radio" kind="filter" label="Tümü" onPress={vi.fn()} selected />,
    );
    expect(pressable.props.accessibilityState).toMatchObject({ checked: true });
  });

  it('reaches the touch floor from a lighter painted height, at either size', () => {
    const { pressable } = render(<Chip label="Açık" onPress={vi.fn()} selected={false} />);
    const slop = pressable.props.hitSlop as number;
    expect(slop).toBe(hitSlopFor(controlSize.compact));
    expect(controlSize.compact + 2 * slop).toBeGreaterThanOrEqual(48);
    expect(controlSize.chip + 2 * slop).toBeGreaterThanOrEqual(48);
  });

  it('fills dark for a selected filter and tints a selected choice', () => {
    expect(chipContentColor('filter', true)).toBe(colors.onPrimary);
    expect(chipContentColor('choice', true)).toBe(colors.primaryDark);
    expect(chipContentColor('filter', false)).toBe(colors.textMuted);
  });

  it('ignores presses while disabled', () => {
    const onPress = vi.fn();
    const { pressable } = render(<Chip disabled label="Video" onPress={onPress} selected={false} />);
    act(() => {
      pressable.props.onPress({ persist: vi.fn() });
    });
    expect(onPress).not.toHaveBeenCalled();
  });
});
