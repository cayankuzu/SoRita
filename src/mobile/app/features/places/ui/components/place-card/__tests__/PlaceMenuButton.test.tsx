import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const openSafeExternalUrlMock = vi.fn();
const showToastMock = vi.fn();

vi.mock('lucide-react-native', () => ({
  ExternalLink: (props: Record<string, unknown>) =>
    React.createElement('ExternalLink', props),
  UtensilsCrossed: (props: Record<string, unknown>) =>
    React.createElement('UtensilsCrossed', props),
}));

vi.mock('@/mobile/app/shared/utils/safeLinks', () => ({
  openSafeExternalUrl: openSafeExternalUrlMock,
}));

vi.mock('@/mobile/app/platform/feedback/toast', () => ({
  showToast: showToastMock,
}));

describe('PlaceMenuButton', () => {
  beforeEach(() => {
    openSafeExternalUrlMock.mockReset();
    showToastMock.mockReset();
  });

  it('opens a safe menu link on a regular press', async () => {
    const menuUrl = 'https://menu.example.com/long/path?table=42';
    openSafeExternalUrlMock.mockResolvedValue(true);
    const { PlaceMenuButton } = await import('../PlaceMenuButton');
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<PlaceMenuButton menuUrl={menuUrl} />);
    });

    const pressable = renderer.root.findByType(
      'Pressable' as unknown as React.ElementType,
    );
    const stopPropagation = vi.fn();

    await act(async () => {
      pressable.props.onPress({ stopPropagation });
      await Promise.resolve();
    });

    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(openSafeExternalUrlMock).toHaveBeenCalledWith(menuUrl);
    expect(showToastMock).not.toHaveBeenCalled();
    expect(pressable.props.accessibilityRole).toBe('link');
  });

  it('reports an unsafe or unavailable link after a regular press', async () => {
    openSafeExternalUrlMock.mockResolvedValue(false);
    const { PlaceMenuButton } = await import('../PlaceMenuButton');
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <PlaceMenuButton menuUrl="https://menu.example.com" />,
      );
    });

    await act(async () => {
      renderer.root
        .findByType('Pressable' as unknown as React.ElementType)
        .props.onPress({ stopPropagation: vi.fn() });
      await Promise.resolve();
    });

    expect(showToastMock).toHaveBeenCalledWith(expect.any(String), 'error');
  });
});
