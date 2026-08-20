import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SkeletonPlaceholder } from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { runAfterNextPaint } from '@/mobile/app/shared/utils/interaction';

type DeferredScreenPlaceholder = 'header' | 'screen';

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
  placeholder: DeferredScreenPlaceholder = 'screen',
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
      return <DeferredPlaceholder kind={placeholder} />;
    }

    return <Screen {...props} />;
  }

  DeferredScreenComponent.isPreloaded = () => Screen !== null;
  DeferredScreenComponent.preload = preload;
  return DeferredScreenComponent;
}

function DeferredPlaceholder({ kind }: { kind: DeferredScreenPlaceholder }) {
  if (kind === 'header') {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.headerPlaceholder}
      >
        <SkeletonPlaceholder height={18} width={96} />
        <SkeletonPlaceholder borderRadius={22} height={44} width={44} />
      </View>
    );
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.placeholder}
    >
      <View style={styles.placeholderHeader}>
        <SkeletonPlaceholder height={18} width="42%" />
        <SkeletonPlaceholder height={13} width="64%" />
      </View>
      <SkeletonPlaceholder borderRadius={14} height={152} width="100%" />
      <SkeletonPlaceholder borderRadius={14} height={152} width="100%" />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: colors.background,
    gap: 12,
    padding: 12,
  },
  placeholderHeader: {
    gap: 8,
    paddingVertical: 8,
  },
  headerPlaceholder: {
    minHeight: 56,
    backgroundColor: colors.surface,
    borderBottomColor: colors.cardBorder,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
