import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

const { openSafeExternalUrlMock } = vi.hoisted(() => ({
  openSafeExternalUrlMock: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/mobile/app/shared/utils/safeLinks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/mobile/app/shared/utils/safeLinks')>()),
  openSafeExternalUrl: openSafeExternalUrlMock,
}));

import { RichText } from '@/mobile/app/shared/components/ui/RichText';

describe('RichText link controls', () => {
  it('exposes the link preview expansion state and preserves direct link opening', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <RichText text="https://example.com/a/very-long-destination-that-needs-a-preview" />,
      );
    });

    const findToggle = () => renderer.root.find(
      (node) => node.props.accessibilityRole === 'button',
    );
    expect(findToggle().props.accessibilityState).toEqual({ expanded: false });

    act(() => {
      findToggle().props.onPress({ stopPropagation: vi.fn() });
    });
    expect(findToggle().props.accessibilityState).toEqual({ expanded: true });

    const link = renderer.root.find((node) => node.props.accessibilityRole === 'link');
    act(() => {
      link.props.onPress({ stopPropagation: vi.fn() });
    });
    expect(openSafeExternalUrlMock).toHaveBeenCalledOnce();
  });
});
