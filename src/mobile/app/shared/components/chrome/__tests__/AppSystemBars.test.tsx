import React from 'react';
import { StatusBar } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import { AppSystemBarsProvider, useSystemBarMode } from '@/mobile/app/shared/components/chrome/AppSystemBars';
import { colors } from '@/mobile/app/shared/theme/tokens';

function ModeConsumer({ active = true }: { active?: boolean }) {
  useSystemBarMode('media', active);
  return null;
}

function renderBars(children: React.ReactNode) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<AppSystemBarsProvider>{children}</AppSystemBarsProvider>);
  });
  return renderer;
}

const statusBarProps = (renderer: TestRenderer.ReactTestRenderer) =>
  renderer.root.findByType(StatusBar).props;

describe('AppSystemBars', () => {
  it('paints the light surface treatment when nothing asks for a mode', () => {
    const props = statusBarProps(renderBars(null));

    expect(props.backgroundColor).toBe(colors.surface);
    expect(props.barStyle).toBe('dark-content');
    expect(props.translucent).toBe(false);
  });

  it('switches to light icons while a media surface is mounted', () => {
    // The lightboxes draw on a near-black backdrop; dark-content there is
    // dark-on-dark, which is what this mode exists to prevent.
    const props = statusBarProps(renderBars(<ModeConsumer />));

    expect(props.barStyle).toBe('light-content');
    expect(props.backgroundColor).toBe(colors.deepBackground);
    expect(props.translucent).toBe(true);
  });

  it('ignores a consumer that is mounted but inactive', () => {
    const props = statusBarProps(renderBars(<ModeConsumer active={false} />));

    expect(props.barStyle).toBe('dark-content');
  });

  it('restores the default once the media surface unmounts', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AppSystemBarsProvider>
          <ModeConsumer />
        </AppSystemBarsProvider>,
      );
    });
    expect(statusBarProps(renderer).barStyle).toBe('light-content');

    act(() => {
      renderer.update(<AppSystemBarsProvider>{null}</AppSystemBarsProvider>);
    });

    expect(statusBarProps(renderer).barStyle).toBe('dark-content');
    expect(statusBarProps(renderer).backgroundColor).toBe(colors.surface);
  });

  it('keeps the newest mode while several surfaces are stacked', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AppSystemBarsProvider>
          <ModeConsumer />
          <ModeConsumer />
        </AppSystemBarsProvider>,
      );
    });
    expect(statusBarProps(renderer).barStyle).toBe('light-content');

    // Closing one of two stacked media surfaces must not drop the treatment.
    act(() => {
      renderer.update(
        <AppSystemBarsProvider>
          <ModeConsumer />
        </AppSystemBarsProvider>,
      );
    });

    expect(statusBarProps(renderer).barStyle).toBe('light-content');
  });
});
