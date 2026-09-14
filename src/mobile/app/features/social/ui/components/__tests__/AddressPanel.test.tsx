import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setStringAsyncMock = vi.fn();
const showToastMock = vi.fn();

vi.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]) => setStringAsyncMock(...args),
}));

vi.mock('lucide-react-native', () => ({
  ChevronRight: (props: Record<string, unknown>) => React.createElement('ChevronRight', props),
  Copy: (props: Record<string, unknown>) => React.createElement('Copy', props),
}));

vi.mock('@/mobile/app/platform/feedback/toast', () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

vi.mock('@/mobile/app/shared/utils/mapLinks', () => ({
  openMapLocationInApp: vi.fn(),
}));

import { AddressPanel } from '@/mobile/app/features/social/ui/components/AddressPanel';
import { tr } from '@/mobile/app/shared/i18n/tr';

const location = {
  address: 'Bağdat Caddesi 1',
  lat: 40.98,
  lng: 29.06,
  name: 'Örnek Mekân',
};

describe('AddressPanel', () => {
  beforeEach(() => {
    setStringAsyncMock.mockReset();
    showToastMock.mockReset();
  });

  it('changes the toggle label to describe collapsing the expanded address', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<AddressPanel location={location} />);
    });
    const toggle = renderer.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityState?.expanded === false,
    );

    expect(toggle.props.accessibilityLabel).toBe(tr.cards.showAddressAction);
    act(() => toggle.props.onPress());

    const expandedToggle = renderer.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityState?.expanded === true,
    );
    expect(expandedToggle.props.accessibilityLabel).toBe(
      `${tr.placeEditor.addressLabel}: ${tr.common.minimize}`,
    );
  });

  it('reports clipboard failures without emitting a false success callback', async () => {
    const onCopied = vi.fn();
    setStringAsyncMock.mockRejectedValue(new Error('clipboard unavailable'));
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<AddressPanel location={location} onCopied={onCopied} />);
    });
    const copyButton = renderer.root.find(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === tr.cards.copy,
    );

    await act(async () => {
      await copyButton.props.onPress();
    });

    expect(onCopied).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith(tr.cards.copyAddressFailed, 'error');
  });
});
