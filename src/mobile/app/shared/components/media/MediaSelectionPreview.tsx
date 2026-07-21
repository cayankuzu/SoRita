import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Mask,
  Rect,
} from 'react-native-svg';

import { PROFILE_MEDIA_COVER_SOURCE_ASPECT_RATIO } from '@/mobile/app/contracts/profileMedia';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

export type MediaSelectionPreviewVariant = 'avatar' | 'profile-cover' | 'list-cover';

type MediaSelectionPreviewProps = {
  accessibilityLabel: string;
  uri?: string;
  variant: MediaSelectionPreviewVariant;
};

const LIST_COVER_PREVIEW_ASPECT_RATIO = 16 / 9;

function getPreviewMetrics(variant: MediaSelectionPreviewVariant, availableWidth: number) {
  if (variant === 'avatar') {
    const outerSize = Math.max(132, Math.min(availableWidth, 196));
    const focusSize = outerSize * 0.76;

    return {
      focusFrameStyle: {
        borderRadius: focusSize / 2,
        height: focusSize,
        left: (outerSize - focusSize) / 2,
        top: (outerSize - focusSize) / 2,
        width: focusSize,
      },
      outerFrameStyle: {
        height: outerSize,
        width: outerSize,
      },
      placeholderStyle: {
        borderRadius: focusSize / 2,
        height: focusSize,
        width: focusSize,
      },
      stageMinHeight: 210,
      variant: 'avatar' as const,
    };
  }

  const aspectRatio =
    variant === 'profile-cover'
      ? PROFILE_MEDIA_COVER_SOURCE_ASPECT_RATIO
      : LIST_COVER_PREVIEW_ASPECT_RATIO;
  const outerWidth = Math.max(216, availableWidth);
  const focusScale = variant === 'profile-cover' ? 0.8 : 0.84;
  const focusWidth = outerWidth * focusScale;
  const focusHeight = focusWidth / aspectRatio;
  const outerHeight = Math.min(Math.max(focusHeight + 42, 156), 224);

  return {
    focusFrameStyle: {
      borderRadius: radius.xl,
      height: focusHeight,
      left: (outerWidth - focusWidth) / 2,
      top: (outerHeight - focusHeight) / 2,
      width: focusWidth,
    },
    outerFrameStyle: {
      borderRadius: radius.xl,
      height: outerHeight,
      width: outerWidth,
    },
    placeholderStyle: {
      borderRadius: radius.xl,
      height: focusHeight,
      width: focusWidth,
    },
    stageMinHeight: variant === 'profile-cover' ? 194 : 202,
    variant: 'cover' as const,
  };
}

export function MediaSelectionPreview({
  accessibilityLabel,
  uri,
  variant,
}: MediaSelectionPreviewProps) {
  const [stageWidth, setStageWidth] = React.useState(0);
  const maskId = React.useId().replace(/:/g, '_');
  const availableWidth = stageWidth > 0 ? Math.max(stageWidth - 36, 0) : 320;
  const metrics = getPreviewMetrics(variant, availableWidth);

  return (
    <View
      style={[
        styles.stage,
        variant === 'avatar' ? styles.avatarStage : styles.coverStage,
        { minHeight: metrics.stageMinHeight },
      ]}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);

        setStageWidth((current) => (current === nextWidth ? current : nextWidth));
      }}
    >
      <View style={[styles.previewFrame, metrics.outerFrameStyle]}>
        {uri ? (
          <>
            <AppImage
              uri={uri}
              accessibilityLabel={accessibilityLabel}
              backgroundColor={colors.surfaceMuted}
              style={styles.previewMedia}
            />
            <Svg
              pointerEvents="none"
              style={StyleSheet.absoluteFillObject}
              width="100%"
              height="100%"
              viewBox={`0 0 ${metrics.outerFrameStyle.width} ${metrics.outerFrameStyle.height}`}
            >
              <Defs>
                <Mask id={maskId}>
                  <Rect
                    x={0}
                    y={0}
                    width={metrics.outerFrameStyle.width}
                    height={metrics.outerFrameStyle.height}
                    fill={colors.onPrimary}
                  />
                  {variant === 'avatar' ? (
                    <Circle
                      cx={metrics.focusFrameStyle.left + metrics.focusFrameStyle.width / 2}
                      cy={metrics.focusFrameStyle.top + metrics.focusFrameStyle.height / 2}
                      r={metrics.focusFrameStyle.width / 2}
                      fill={colors.cameraBackground}
                    />
                  ) : (
                    <Rect
                      x={metrics.focusFrameStyle.left}
                      y={metrics.focusFrameStyle.top}
                      width={metrics.focusFrameStyle.width}
                      height={metrics.focusFrameStyle.height}
                      rx={radius.xl}
                      ry={radius.xl}
                      fill={colors.cameraBackground}
                    />
                  )}
                </Mask>
              </Defs>
              <Rect
                x={0}
                y={0}
                width={metrics.outerFrameStyle.width}
                height={metrics.outerFrameStyle.height}
                fill={colors.onDarkSubtle}
                mask={`url(#${maskId})`}
              />
            </Svg>
            <View style={[styles.focusFrame, metrics.focusFrameStyle]} />
          </>
        ) : (
          <View style={[styles.placeholderFrame, metrics.placeholderStyle]} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
    padding: 14,
    position: 'relative',
  },
  avatarStage: {},
  coverStage: {},
  previewFrame: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  previewMedia: {
    ...StyleSheet.absoluteFillObject,
  },
  focusFrame: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  focusMedia: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholderFrame: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
});
