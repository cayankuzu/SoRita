import { describe, expect, it } from 'vitest';

import { resolveAndroidKeyboardLift } from '@/mobile/app/features/social/ui/components/comment-panel/commentPanelKeyboardLayout';

describe('comment panel Android keyboard layout', () => {
  it('lifts the sheet to the keyboard top in an unresized modal window', () => {
    expect(resolveAndroidKeyboardLift({
      composerBottom: 938,
      keyboardTop: 660,
    })).toBe(288);
  });

  it('preserves a small clearance when the composer touches the keyboard', () => {
    expect(resolveAndroidKeyboardLift({
      composerBottom: 660,
      keyboardTop: 660,
    })).toBe(10);
  });

  it('does not move a composer that is already clear of the keyboard', () => {
    expect(resolveAndroidKeyboardLift({
      composerBottom: 620,
      keyboardTop: 660,
    })).toBe(0);
  });
});
