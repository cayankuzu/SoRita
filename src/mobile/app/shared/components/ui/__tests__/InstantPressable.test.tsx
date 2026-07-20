import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';

describe('InstantPressable', () => {
  it('prevents duplicate work only while the real async action is pending', async () => {
    let resolveAction!: () => void;
    const action = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAction = resolve;
        }),
    );
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<InstantPressable onPress={action}>Kaydet</InstantPressable>);
    });

    const pressable = () => renderer.root.find((node) => String(node.type) === 'Pressable');
    act(() => {
      pressable().props.onPress({ persist: vi.fn() });
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(pressable().props.disabled).toBe(true);

    await act(async () => {
      resolveAction();
      await Promise.resolve();
    });

    expect(pressable().props.disabled).toBe(false);
  });
});
