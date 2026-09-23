import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import {
  useScrollAwayHeader,
  type ScrollAwayHeaderController,
} from '@/mobile/app/shared/hooks/useScrollAwayHeader';

function renderController(pinnedHeight?: number) {
  const result: { current?: ScrollAwayHeaderController } = {};

  function Harness() {
    result.current = useScrollAwayHeader({ pinnedHeight });
    return null;
  }

  act(() => {
    TestRenderer.create(<Harness />);
  });
  act(() => {
    result.current!.onLayout({ nativeEvent: { layout: { height: 120 } } } as never);
  });

  const controller = () => result.current!;
  const hidden = () => -Number(controller().translateY);
  const scroll = (offset: number) => act(() => controller().onScrollOffset(offset));

  return { controller, hidden, scroll };
}

describe('useScrollAwayHeader', () => {
  it('slides away as the content scrolls down and returns on the first scroll up', () => {
    const { controller, hidden, scroll } = renderController();
    expect(controller().height).toBe(120);

    scroll(0);
    scroll(300);
    expect(hidden()).toBe(120);

    scroll(260);
    expect(hidden()).toBe(80);

    scroll(400);
    expect(hidden()).toBe(120);
  });

  it('moves exactly with the content near the top, leaving no empty band', () => {
    const { hidden, scroll } = renderController();

    scroll(0);
    scroll(40);
    expect(hidden()).toBe(40);

    scroll(10);
    expect(hidden()).toBe(10);
  });

  it('keeps its pinned strip, such as the status bar, in place', () => {
    const { hidden, scroll } = renderController(24);

    scroll(0);
    scroll(500);
    expect(hidden()).toBe(96);
  });

  it('comes back when revealed and reads the next list afresh', () => {
    const { controller, hidden, scroll } = renderController();

    scroll(0);
    scroll(300);
    act(() => controller().reveal());
    // The next list reports a deep offset first; that is not a scroll down,
    // so only what it scrolls after that moves the bar again.
    scroll(900);
    scroll(950);
    expect(hidden()).toBe(50);
  });
});
