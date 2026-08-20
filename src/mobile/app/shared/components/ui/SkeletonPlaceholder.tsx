import React, { useEffect, useRef } from "react";
import {
  Animated,
  type DimensionValue,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";

import { colors, radius, spacing } from "@/mobile/app/shared/theme/tokens";
import { useReduceMotion } from "@/mobile/app/shared/hooks/useReduceMotion";
import { tr } from "@/mobile/app/shared/i18n/tr";

type SkeletonProps = {
  width: DimensionValue;
  height?: number;
  aspectRatio?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

const SHIMMER_DURATION_MS = 1200;

export function SkeletonPlaceholder({
  width,
  height,
  aspectRatio,
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
      style={[
        styles.skeleton,
        { width, borderRadius, opacity },
        aspectRatio ? { aspectRatio } : { height },
        style,
      ]}
    />
  );
}

type SkeletonGroupProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
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
      <View style={styles.cardHeaderSkeleton}>
        <SkeletonPlaceholder width={40} height={40} borderRadius={20} />
        <View style={styles.cardHeaderTextSkeleton}>
          <SkeletonPlaceholder width="42%" height={15} />
          <SkeletonPlaceholder width="28%" height={12} />
        </View>
      </View>
      <View style={styles.cardMediaSkeleton}>
        <SkeletonPlaceholder width="100%" aspectRatio={1.28} borderRadius={radius.md} />
      </View>
      <View style={styles.cardContent}>
        <SkeletonPlaceholder width="64%" height={18} />
        <SkeletonPlaceholder width="92%" height={13} />
        <SkeletonPlaceholder width="76%" height={13} />
        <View style={styles.cardActionsSkeleton}>
          <SkeletonPlaceholder width={64} height={48} borderRadius={radius.md} />
          <SkeletonPlaceholder width={64} height={48} borderRadius={radius.md} />
          <SkeletonPlaceholder width={48} height={48} borderRadius={radius.md} />
        </View>
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

export function NotificationListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <SkeletonGroup style={styles.notificationListSkeleton}>
      <View style={styles.notificationHeaderSkeleton}>
        <SkeletonPlaceholder width={44} height={44} borderRadius={radius.pill} />
        <View style={styles.notificationHeaderTextSkeleton}>
          <SkeletonPlaceholder width="42%" height={20} />
          <SkeletonPlaceholder width="28%" height={13} />
        </View>
        <SkeletonPlaceholder width={84} height={36} borderRadius={radius.md} />
      </View>
      <View style={styles.notificationTabsSkeleton}>
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonPlaceholder key={index} width={72} height={36} borderRadius={radius.pill} />
        ))}
      </View>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.notificationRowSkeleton}>
          <SkeletonPlaceholder width={44} height={44} borderRadius={radius.pill} />
          <View style={styles.notificationRowTextSkeleton}>
            <SkeletonPlaceholder width="88%" height={14} />
            <SkeletonPlaceholder width="62%" height={13} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

export function ListDetailSkeleton() {
  return (
    <SkeletonGroup style={styles.listDetailSkeleton}>
      <View style={styles.notificationHeaderSkeleton}>
        <SkeletonPlaceholder width={44} height={44} borderRadius={radius.pill} />
        <View style={styles.notificationHeaderTextSkeleton}>
          <SkeletonPlaceholder width="48%" height={18} />
          <SkeletonPlaceholder width="24%" height={13} />
        </View>
        <SkeletonPlaceholder width={44} height={44} borderRadius={radius.pill} />
      </View>
      <SkeletonPlaceholder width="100%" height={176} borderRadius={0} />
      <View style={styles.listDetailBodySkeleton}>
        <SkeletonPlaceholder width="54%" height={22} />
        <SkeletonPlaceholder width="82%" height={14} />
      </View>
      <PlaceCardSkeleton />
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.surfaceMuted,
  },
  group: {
    gap: 6,
  },
  cardSkeleton: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: 0,
    overflow: "hidden",
  },
  cardHeaderSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cardHeaderTextSkeleton: {
    flex: 1,
    gap: spacing.xs,
  },
  cardMediaSkeleton: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  cardContent: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardActionsSkeleton: {
    flexDirection: "row",
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    paddingTop: spacing.sm,
  },
  tileSkeleton: {
    gap: 6,
  },
  tileContent: {
    gap: 4,
    paddingHorizontal: 4,
  },
  profileSkeleton: {
    gap: 0,
  },
  profileContent: {
    alignItems: "center",
    gap: 6,
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  avatar: {
    marginTop: -32,
  },
  notificationListSkeleton: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  notificationHeaderSkeleton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  notificationHeaderTextSkeleton: {
    flex: 1,
    gap: spacing.xs,
  },
  notificationTabsSkeleton: {
    flexDirection: "row",
    gap: spacing.sm,
    overflow: "hidden",
  },
  notificationRowSkeleton: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  notificationRowTextSkeleton: {
    flex: 1,
    gap: spacing.sm,
  },
  listDetailSkeleton: {
    flex: 1,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  listDetailBodySkeleton: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
});
