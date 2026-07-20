import React, { useEffect, useRef } from "react";
import {
  Animated,
  type DimensionValue,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";

import { colors } from "@/mobile/app/shared/theme/tokens";
import { useReduceMotion } from "@/mobile/app/shared/hooks/useReduceMotion";
import { tr } from "@/mobile/app/shared/i18n/tr";

type SkeletonProps = {
  width: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
};

const SHIMMER_DURATION_MS = 1200;

export function SkeletonPlaceholder({
  width,
  height,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.6);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: SHIMMER_DURATION_MS / 2,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: SHIMMER_DURATION_MS / 2,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      style={[styles.skeleton, { width, height, borderRadius, opacity }, style]}
    />
  );
}

type SkeletonGroupProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export function SkeletonGroup({ children, style }: SkeletonGroupProps) {
  return (
    <View accessibilityLabel={tr.common.loading} style={[styles.group, style]}>
      {children}
    </View>
  );
}

export function PlaceCardSkeleton() {
  return (
    <SkeletonGroup style={styles.cardSkeleton}>
      <SkeletonPlaceholder width="100%" height={200} borderRadius={12} />
      <View style={styles.cardContent}>
        <SkeletonPlaceholder width="60%" height={16} />
        <SkeletonPlaceholder width="80%" height={12} />
        <SkeletonPlaceholder width="40%" height={12} />
      </View>
    </SkeletonGroup>
  );
}

export function ListGridTileSkeleton() {
  return (
    <SkeletonGroup style={styles.tileSkeleton}>
      <SkeletonPlaceholder width="100%" height={140} borderRadius={12} />
      <View style={styles.tileContent}>
        <SkeletonPlaceholder width="70%" height={14} />
        <SkeletonPlaceholder width="50%" height={12} />
      </View>
    </SkeletonGroup>
  );
}

export function ProfileSkeleton() {
  return (
    <SkeletonGroup style={styles.profileSkeleton}>
      <SkeletonPlaceholder width="100%" height={160} borderRadius={0} />
      <View style={styles.profileContent}>
        <SkeletonPlaceholder
          width={80}
          height={80}
          borderRadius={40}
          style={styles.avatar}
        />
        <SkeletonPlaceholder width={120} height={18} />
        <SkeletonPlaceholder width={80} height={14} />
        <SkeletonPlaceholder width="90%" height={12} />
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.surfaceMuted,
  },
  group: {
    gap: 8,
  },
  cardSkeleton: {
    padding: 12,
    gap: 12,
  },
  cardContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  tileSkeleton: {
    gap: 8,
  },
  tileContent: {
    gap: 6,
    paddingHorizontal: 4,
  },
  profileSkeleton: {
    gap: 0,
  },
  profileContent: {
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  avatar: {
    marginTop: -40,
  },
});
