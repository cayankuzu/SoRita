import { describe, expect, it, vi } from 'vitest';

type TabPressListener = (event: { preventDefault: () => void }) => void;

const navigation = vi.hoisted(() => ({
  focused: true,
  listeners: new Set<TabPressListener>(),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    addListener: (_type: string, listener: TabPressListener) => {
      navigation.listeners.add(listener);
      return () => navigation.listeners.delete(listener);
    },
    isFocused: () => navigation.focused,
  }),
}));

import { useTabReselect } from '@/mobile/app/shared/hooks/useTabReselect';
import { renderHook } from '@/mobile/app/test/hookTestUtils';

function pressTab() {
  const event = { preventDefault: vi.fn() };
  navigation.listeners.forEach((listener) => listener(event));
  return event;
}

describe('useTabReselect', () => {
  it('closes the open view on a second tap of the showing tab, keeping the list in place', () => {
    const onReselect = vi.fn();
    let enabled = true;
    const hook = renderHook(() => useTabReselect(enabled, onReselect));

    navigation.focused = true;
    const event = pressTab();
    expect(onReselect).toHaveBeenCalledOnce();
    expect(event.preventDefault).toHaveBeenCalledOnce();

    // Arriving from another tab only switches tabs.
    navigation.focused = false;
    expect(pressTab().preventDefault).not.toHaveBeenCalled();
    expect(onReselect).toHaveBeenCalledOnce();

    // With nothing open the tap keeps its scroll-to-top.
    enabled = false;
    hook.rerender();
    navigation.focused = true;
    expect(pressTab().preventDefault).not.toHaveBeenCalled();
    expect(navigation.listeners.size).toBe(0);

    hook.unmount();
  });
});
