import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/mobile/app/shared/theme/tokens';
import { runAfterNextPaint } from '@/mobile/app/shared/utils/interaction';

type DeferredScreen<Props extends object> = React.ComponentType<Props> & {
  isPreloaded: () => boolean;
  preload: () => void;
};

/**
 * Changes route state immediately, then evaluates an unprepared screen module
 * after the selected tab has painted. Startup normally preloads the module, so
 * the fallback is only used for very early taps.
 */
export function createDeferredScreen<Props extends object>(
  loadScreen: () => React.ComponentType<Props>,
): DeferredScreen<Props> {
  let Screen: React.ComponentType<Props> | null = null;

  const preload = () => {
    Screen ??= loadScreen();
  };

  function DeferredScreenComponent(props: Props) {
    const [, renderLoadedScreen] = useState(0);
    const needsLoad = Screen === null;

    useEffect(() => {
      if (!needsLoad) {
        return;
      }

      return runAfterNextPaint(() => {
        preload();
        renderLoadedScreen((version) => version + 1);
      });
    }, [needsLoad]);

    if (!Screen) {
      return <View accessibilityElementsHidden style={styles.placeholder} />;
    }

    return <Screen {...props} />;
  }

  DeferredScreenComponent.isPreloaded = () => Screen !== null;
  DeferredScreenComponent.preload = preload;
  return DeferredScreenComponent;
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
