import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook } from '@/mobile/app/test/hookTestUtils';
import {
  normalizeTabScrollOffset,
  useTabScrollMemory,
} from '@/mobile/app/shared/hooks/useTabScrollMemory';

describe('useTabScrollMemory', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes negative and invalid offsets', () => {
    expect(normalizeTabScrollOffset(-20)).toBe(0);
    expect(normalizeTabScrollOffset(Number.NaN)).toBe(0);
    expect(normalizeTabScrollOffset(42)).toBe(42);
  });

  it('starts a first-time tab at offset zero', () => {
    const handle = { scrollToOffset: vi.fn() };
    const hook = renderHook(() => useTabScrollMemory<'lists' | 'places'>());

    act(() => {
      hook.result.current.getTabScrollRefCallback('places')(handle);
      hook.result.current.restoreTabScrollOffset('places');
    });

    expect(handle.scrollToOffset).toHaveBeenCalledWith({
      animated: false,
      offset: 0,
    });
  });

  it('keeps independent offsets and restores a remounted tab without animation', () => {
    const listHandle = { scrollToOffset: vi.fn() };
    const remountedListHandle = { scrollToOffset: vi.fn() };
    const placeHandle = { scrollToOffset: vi.fn() };
    const hook = renderHook(() => useTabScrollMemory<'lists' | 'places'>());
    const listRef = hook.result.current.getTabScrollRefCallback('lists');
    const placeRef = hook.result.current.getTabScrollRefCallback('places');

    act(() => {
      listRef(listHandle);
      placeRef(placeHandle);
      hook.result.current.recordTabScrollOffset('lists', 320);
      hook.result.current.recordTabScrollOffset('places', 84);
      listRef(null);
      listRef(remountedListHandle);
    });

    expect(remountedListHandle.scrollToOffset).toHaveBeenCalledWith({
      animated: false,
      offset: 320,
    });
    expect(placeHandle.scrollToOffset).not.toHaveBeenCalledWith({
      animated: false,
      offset: 320,
    });
    expect(hook.result.current.getTabScrollRef('places')).toBe(placeHandle);
  });

  it('retries restoration after content becomes ready', () => {
    const handle = { scrollToOffset: vi.fn() };
    const hook = renderHook(() => useTabScrollMemory<'lists'>());

    act(() => {
      hook.result.current.recordTabScrollOffset('lists', 240);
      hook.result.current.getTabScrollRefCallback('lists')(handle);
      hook.result.current.notifyTabContentReady('lists');
    });

    expect(handle.scrollToOffset).toHaveBeenLastCalledWith({
      animated: false,
      offset: 240,
    });
  });
});
