import React from 'react';
import { StyleSheet, View } from 'react-native';

type OverlayHostProps = {
  children: React.ReactNode;
  // Shown over the screen while set; the screen underneath stays mounted.
  overlay?: React.ReactNode;
};

/**
 * Puts a view that belongs to a screen, such as the feed a grid tile opens,
 * over that screen without unmounting it. The grid underneath keeps its tab,
 * scroll position and loaded images, so closing the feed returns to exactly
 * where it was, as Instagram's profile does.
 */
export function OverlayHost({ children, overlay }: OverlayHostProps) {
  const covered = overlay != null && overlay !== false;

  return (
    <View style={styles.fill}>
      <View
        accessibilityElementsHidden={covered}
        importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
        pointerEvents={covered ? 'none' : 'auto'}
        style={styles.fill}
      >
        {children}
      </View>
      {covered ? <View style={styles.overlay}>{overlay}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
