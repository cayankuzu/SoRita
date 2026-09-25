import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';

// With motion reduced the toggle skips LayoutAnimation, which the test
// environment's react-native does not provide.
vi.mock('@/mobile/app/shared/hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));

function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

// The component learns its width, then how many lines the full text takes in
// an off-screen copy; only then does it know whether there is more to show.
function measure(renderer: TestRenderer.ReactTestRenderer, lineCount: number) {
  const wrapper = renderer.root.findAll((node) => typeof node.props.onLayout === 'function')[0]!;
  act(() => {
    wrapper.props.onLayout({ nativeEvent: { layout: { width: 320 } } });
  });
  const hiddenCopy = renderer.root.findAll(
    (node) => typeof node.props.onTextLayout === 'function',
  )[0]!;
  act(() => {
    hiddenCopy.props.onTextLayout({ nativeEvent: { lines: Array.from({ length: lineCount }) } });
  });
}

function visibleText(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAll((node) => node.props.ellipsizeMode === 'tail')[0]!;
}

function toggle(renderer: TestRenderer.ReactTestRenderer) {
  const surface = renderer.root.findAll(
    (node) => typeof node.props.onPress === 'function' && 'disabled' in node.props,
  )[0]!;
  act(() => {
    surface.props.onPress({ stopPropagation: () => undefined });
  });
}

describe('ExpandableText', () => {
  it('stays collapsed and inert when the text fits', () => {
    const renderer = render(<ExpandableText preserveLineBreaks text={'bir\niki'} />);
    measure(renderer, 2);

    expect(visibleText(renderer).props.numberOfLines).toBe(2);
    toggle(renderer);
    expect(visibleText(renderer).props.numberOfLines).toBe(2);
  });

  it('opens and closes plain text that runs past the collapsed lines', () => {
    const renderer = render(
      <ExpandableText
        collapsedLines={2}
        maxCollapsedLinesWhenPreservingBreaks={2}
        preserveLineBreaks
        text={'1\n2\n3\n4\n5'}
      />,
    );
    measure(renderer, 5);

    expect(visibleText(renderer).props.numberOfLines).toBe(2);
    toggle(renderer);
    expect(visibleText(renderer).props.numberOfLines).toBeUndefined();
    toggle(renderer);
    expect(visibleText(renderer).props.numberOfLines).toBe(2);
  });

  it('reports the change and follows the caller when it controls the state', () => {
    const onExpandedChange = vi.fn();
    const renderer = render(
      <ExpandableText
        expanded={false}
        onExpandedChange={onExpandedChange}
        preserveLineBreaks
        maxCollapsedLinesWhenPreservingBreaks={2}
        text={'1\n2\n3\n4'}
      />,
    );
    measure(renderer, 4);
    toggle(renderer);

    expect(onExpandedChange).toHaveBeenCalledWith(true);
    expect(visibleText(renderer).props.numberOfLines).toBe(2);
  });

  it('gives rich text its own labelled chevron, since links inside take the taps', () => {
    const renderer = render(<ExpandableText text="uzun bir açıklama @ada" />);
    measure(renderer, 6);

    const chevron = renderer.root.findAll(
      (node) => node.props.accessibilityRole === 'button' && Boolean(node.props.accessibilityLabel),
    )[0]!;
    expect(chevron.props.accessibilityState).toEqual({ expanded: false });
    act(() => {
      chevron.props.onPress({ stopPropagation: () => undefined });
    });
    expect(visibleText(renderer).props.numberOfLines).toBeUndefined();
  });

  it('draws line breaks stored as U+2028 as real breaks', () => {
    const renderer = render(<ExpandableText preserveLineBreaks text={'bir iki'} />);
    measure(renderer, 2);

    expect(visibleText(renderer).props.children).toBe('bir\niki');
  });
});
