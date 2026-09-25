import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { colors } from '@/mobile/app/shared/theme/tokens';

function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  const input = renderer.root.find((node) => String(node.type) === 'TextInput');
  const texts = renderer.root.findAll((node) => String(node.type) === 'Text');
  return { input, renderer, texts };
}

describe('TextField', () => {
  it('counts characters against the limit when no helper is given', () => {
    const { input, texts } = render(<TextField maxLength={10} value="abc" />);
    const helper = texts[texts.length - 1]!;

    expect(helper.props.children).toMatch(/3\s*\/\s*10/);
    expect(input.props.accessibilityHint).toBe(helper.props.children);
  });

  it('marks the counter once most of the limit is used', () => {
    const calm = render(<TextField maxLength={10} value="abc" />);
    const near = render(<TextField maxLength={10} value="abcdefgh" />);
    const lastText = (texts: TestRenderer.ReactTestInstance[]) => texts[texts.length - 1]!;

    expect(StyleSheet.flatten(lastText(near.texts).props.style)).not.toEqual(
      StyleSheet.flatten(lastText(calm.texts).props.style),
    );
  });

  it('colours the helper by status before the caller tone', () => {
    const { texts } = render(<TextField helper="Olmadı" helperTone="success" status="error" />);
    const helper = texts[texts.length - 1]!;

    expect(StyleSheet.flatten(helper.props.style).color).toBe(colors.danger);
  });

  it('keeps the keyboard up and scrolls inside when it takes several lines', () => {
    const multi = render(<TextField multilineRows={4} value="" />);
    const single = render(<TextField returnKeyType="next" value="" />);

    expect(multi.input.props).toMatchObject({
      blurOnSubmit: false,
      multiline: true,
      returnKeyType: 'default',
      scrollEnabled: true,
    });
    expect(single.input.props).toMatchObject({ multiline: false, returnKeyType: 'next' });
    expect(single.input.props.blurOnSubmit).toBeUndefined();
  });

  it('stores line breaks one way in a multi-line field', () => {
    const onChangeText = vi.fn();
    const { input } = render(<TextField multilineRows={3} onChangeText={onChangeText} value="" />);

    act(() => {
      input.props.onChangeText('bir\r\niki');
    });
    expect(onChangeText).toHaveBeenCalledWith(expect.not.stringContaining('\r'));
  });
});
