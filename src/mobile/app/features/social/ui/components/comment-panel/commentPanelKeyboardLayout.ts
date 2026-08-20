const ANDROID_KEYBOARD_EXTRA_LIFT = 10;

type KeyboardFrame = {
  height: number;
  screenY: number;
};

export function resolveAndroidKeyboardLift({
  composerBottom,
  keyboardTop,
}: {
  composerBottom: number;
  keyboardTop: number;
}) {
  if (!Number.isFinite(composerBottom) || !Number.isFinite(keyboardTop)) {
    return 0;
  }

  return Math.max(
    composerBottom - keyboardTop + ANDROID_KEYBOARD_EXTRA_LIFT,
    0,
  );
}

export type { KeyboardFrame };
