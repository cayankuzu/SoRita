import { beforeEach, describe, expect, it, vi } from 'vitest';

const picker = vi.hoisted(() => ({ pick: vi.fn() }));
vi.mock('@/mobile/app/platform/media/images', () => ({ pickSingleImageFromPrompt: picker.pick }));
vi.mock('@/mobile/app/platform/media/mediaPickerTransition', () => ({
  waitForMediaPickerTransition: vi.fn(async () => undefined),
}));

import { useCoverImagePicker } from '@/mobile/app/platform/media/useCoverImagePicker';
import { act, renderHook } from '@/mobile/app/test/hookTestUtils';

describe('useCoverImagePicker', () => {
  beforeEach(() => {
    picker.pick.mockReset();
  });

  it('asks for one 16:9 photo and hands it over', async () => {
    picker.pick.mockResolvedValue('file:///cover.jpg');
    const onPicked = vi.fn();
    const hook = renderHook(() => useCoverImagePicker(onPicked));

    await act(async () => {
      await hook.result.current.pickCover();
    });

    expect(picker.pick).toHaveBeenCalledWith({ cropAspect: [16, 9], cropShape: 'rectangle' });
    expect(onPicked).toHaveBeenCalledWith('file:///cover.jpg');
    expect(hook.result.current.isPicking).toBe(false);
  });

  it('ignores a second tap while the picker is open, and does nothing when disabled', async () => {
    let release!: (uri: string | null) => void;
    picker.pick.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    const onPicked = vi.fn();
    const hook = renderHook(() => useCoverImagePicker(onPicked));

    let first!: Promise<void>;
    await act(async () => {
      first = hook.result.current.pickCover();
      await hook.result.current.pickCover();
    });
    expect(picker.pick).toHaveBeenCalledOnce();

    await act(async () => {
      release(null);
      await first;
    });
    expect(onPicked).not.toHaveBeenCalled();

    const disabled = renderHook(() => useCoverImagePicker(onPicked, true));
    await act(async () => {
      await disabled.result.current.pickCover();
    });
    expect(picker.pick).toHaveBeenCalledOnce();
  });
});
