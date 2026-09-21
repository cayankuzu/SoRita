import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { textScale } from '@/mobile/app/shared/theme/tokens';

function renderText(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;

  act(() => {
    renderer = TestRenderer.create(element);
  });

  return renderer.root.findByType(Text).props as { maxFontSizeMultiplier?: number };
}

describe('AppText', () => {
  it('caps reading copy at the content limit by default', () => {
    expect(renderText(<AppText>Merhaba</AppText>).maxFontSizeMultiplier).toBe(
      textScale.content,
    );
  });

  it('caps dense chrome tighter than reading copy', () => {
    const props = renderText(<AppText scaleLimit="chrome">Ana sayfa</AppText>);

    expect(props.maxFontSizeMultiplier).toBe(textScale.chrome);
    expect(textScale.chrome).toBeLessThan(textScale.content);
  });

  it('lets a caller that needs its own cap keep it', () => {
    const props = renderText(<AppText maxFontSizeMultiplier={1}>SoRita</AppText>);

    expect(props.maxFontSizeMultiplier).toBe(1);
  });
});
