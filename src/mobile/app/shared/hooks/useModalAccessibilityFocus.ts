import React from 'react';
import { AccessibilityInfo, findNodeHandle } from 'react-native';

type FocusTarget = Parameters<typeof findNodeHandle>[0];

type ModalAccessibilityFocusOptions = {
  /** Announced when the modal opens and nothing is given focus. */
  accessibilityLabel: string;
  /** Receives screen-reader focus on open. */
  initialFocusRef?: React.RefObject<unknown>;
  /** Regains screen-reader focus on close, usually the control that opened it. */
  returnFocusRef?: React.RefObject<unknown>;
  visible: boolean;
};

/**
 * Moves screen-reader focus into a modal when it opens and hands it back when
 * it closes.
 *
 * `accessibilityViewIsModal` hides the rest of the screen from the reader, but
 * it does not move the cursor - without this the reader stays wherever it was
 * and the sheet opens silently. `ModalScaffold` had this behaviour inline, so
 * the three sheets that do not use the scaffold (the comment action sheet and
 * the two media hosts) were missing it entirely.
 *
 * The delays let the modal finish presenting; focusing a view mid-transition is
 * dropped on both platforms.
 */
export function useModalAccessibilityFocus({
  accessibilityLabel,
  initialFocusRef,
  returnFocusRef,
  visible,
}: ModalAccessibilityFocusOptions) {
  const wasVisibleRef = React.useRef(false);

  React.useEffect(() => {
    if (visible) {
      wasVisibleRef.current = true;
      const focusTimer = setTimeout(() => {
        const targetHandle = initialFocusRef?.current
          ? findNodeHandle(initialFocusRef.current as FocusTarget)
          : null;

        if (targetHandle) {
          AccessibilityInfo.setAccessibilityFocus(targetHandle);
          return;
        }

        AccessibilityInfo.announceForAccessibility(accessibilityLabel);
      }, 120);

      return () => clearTimeout(focusTimer);
    }

    if (wasVisibleRef.current) {
      wasVisibleRef.current = false;

      if (returnFocusRef?.current) {
        const restoreTimer = setTimeout(() => {
          const targetHandle = findNodeHandle(returnFocusRef.current as FocusTarget);

          if (targetHandle) {
            AccessibilityInfo.setAccessibilityFocus(targetHandle);
          }
        }, 80);

        return () => clearTimeout(restoreTimer);
      }
    }

    return undefined;
  }, [accessibilityLabel, initialFocusRef, returnFocusRef, visible]);
}
