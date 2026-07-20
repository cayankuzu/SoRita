import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const openSafeExternalUrlMock = vi.fn();
const showToastMock = vi.fn();

vi.mock('lucide-react-native', () => ({
  ChevronDown: (props: Record<string, unknown>) =>
    React.createElement('ChevronDown', props),
  ChevronUp: (props: Record<string, unknown>) =>
    React.createElement('ChevronUp', props),
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

  it('toggles the raw URL without opening the menu on a regular press', async () => {
    const menuUrl = 'https://menu.example.com/long/path?table=42';
    openSafeExternalUrlMock.mockResolvedValue(true);
    const { PlaceMenuButton } = await import('../PlaceMenuButton');
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<PlaceMenuButton menuUrl={menuUrl} />);
    });

    expect(JSON.stringify(renderer.toJSON())).not.toContain(menuUrl);
    expect(JSON.stringify(renderer.toJSON())).toContain('Menü');
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Menüyü Aç');

    const pressable = renderer.root.findByType(
      'Pressable' as unknown as React.ElementType,
    );
    const stopPropagation = vi.fn();

    act(() => {
      pressable.props.onPress({ stopPropagation });
    });

    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(JSON.stringify(renderer.toJSON())).toContain(menuUrl);
    expect(openSafeExternalUrlMock).not.toHaveBeenCalled();

    act(() => {
      pressable.props.onPress({ stopPropagation });
    });

    expect(JSON.stringify(renderer.toJSON())).not.toContain(menuUrl);
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it('opens a safe menu link after a 500ms long press', async () => {
    const menuUrl = 'https://menu.example.com';
    openSafeExternalUrlMock.mockResolvedValue(true);
    const { PlaceMenuButton } = await import('../PlaceMenuButton');
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<PlaceMenuButton menuUrl={menuUrl} />);
    });

    const pressable = renderer.root.findByType(
      'Pressable' as unknown as React.ElementType,
    );

    expect(pressable.props.delayLongPress).toBe(500);

    await act(async () => {
      pressable.props.onLongPress({ stopPropagation: vi.fn() });
      await Promise.resolve();
    });

    expect(openSafeExternalUrlMock).toHaveBeenCalledWith(menuUrl);
  });

  it('reports an unsafe or unavailable link after a long press', async () => {
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
        .props.onLongPress({ stopPropagation: vi.fn() });
      await Promise.resolve();
    });

    expect(showToastMock).toHaveBeenCalledWith(
      expect.any(String),
      'error',
    );
  });
});
