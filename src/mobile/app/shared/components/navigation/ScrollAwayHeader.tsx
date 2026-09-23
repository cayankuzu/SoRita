import React from 'react';
import { Animated, StyleSheet } from 'react-native';

import type { ScrollAwayHeaderController } from '@/mobile/app/shared/hooks/useScrollAwayHeader';
import { colors, zIndex } from '@/mobile/app/shared/theme/tokens';

type ScrollAwayHeaderProps = {
  children: React.ReactNode;
  controller: ScrollAwayHeaderController;
  testID?: string;
};

/**
 * Floats a screen's top bar over its content and slides it with the
 * controller. The content reserves `controller.height` at its top.
 */
export function ScrollAwayHeader({ children, controller, testID }: ScrollAwayHeaderProps) {
  return (
    <Animated.View
      collapsable={false}
      onLayout={controller.onLayout}
      style={[styles.header, { transform: [{ translateY: controller.translateY }] }]}
      testID={testID}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.background,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: zIndex.raised,
  },
});
