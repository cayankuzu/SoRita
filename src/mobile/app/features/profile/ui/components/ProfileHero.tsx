import React from "react";
import {
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  PROFILE_HERO_AVATAR_SIZE,
  PROFILE_HERO_COVER_HEIGHT,
} from "@/mobile/app/features/profile/ui/components/profileMediaLayout";
import { AppImage } from "@/mobile/app/shared/components/ui/AppImage";
import { AppText } from "@/mobile/app/shared/components/ui/AppText";
import { AvatarView } from "@/mobile/app/shared/components/ui/AvatarView";
import { ExpandableText } from "@/mobile/app/shared/components/ui/ExpandableText";
import { IconButton } from "@/mobile/app/shared/components/ui/IconButton";
import { tr } from "@/mobile/app/shared/i18n/tr";
import { colors, iconSize, minTouchSize, radius, spacing, textStyle, typography } from "@/mobile/app/shared/theme/tokens";

const PROFILE_HERO_MIN_COVER_HEIGHT = 112;
const PROFILE_HERO_MAX_COVER_VIEWPORT_RATIO = 0.22;

type ProfileHeroProps = {
  name: string;
  username: string;
  bio?: string;
  profilePhoto?: string;
  coverPhoto?: string;
  coverBackgroundColor: string;
  action?: React.ReactNode;
  detailsContent?: React.ReactNode;
  onProfilePhotoPress?: () => void;
  onCoverPhotoPress?: () => void;
  onBackPress?: () => void;
};

export function ProfileHero({
  name,
  username,
  bio,
  profilePhoto,
  coverPhoto,
  coverBackgroundColor,
  action,
  detailsContent,
  onProfilePhotoPress,
  onCoverPhotoPress,
  onBackPress,
}: ProfileHeroProps) {
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const coverHeight = Math.max(
    PROFILE_HERO_MIN_COVER_HEIGHT,
    Math.min(
      PROFILE_HERO_COVER_HEIGHT,
      Math.round(viewportHeight * PROFILE_HERO_MAX_COVER_VIEWPORT_RATIO),
    ),
  );

  return (
    <View style={styles.header}>
      <View
        style={[
          styles.coverWrap,
          { backgroundColor: coverBackgroundColor, minHeight: coverHeight },
        ]}
      >
        {coverPhoto ? (
          <Pressable
            accessibilityLabel={tr.profile.coverPhoto}
            accessibilityRole={onCoverPhotoPress ? "imagebutton" : "image"}
            disabled={!onCoverPhotoPress}
            onPress={onCoverPhotoPress}
            style={styles.coverPressable}
          >
            <AppImage
              uri={coverPhoto}
              style={styles.coverImage}
              accessibilityLabel={`${name} ${tr.profile.coverPhoto.toLowerCase()}`}
            />
          </Pressable>
        ) : null}

        {onBackPress ? (
          <IconButton
            accessibilityLabel={tr.common.back}
            onPress={onBackPress}
            style={[styles.backButton, { top: insets.top + 12 }]}
            variant="inverse"
          >
            <ArrowLeft color={colors.onPrimary} size={iconSize.md} />
          </IconButton>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.avatarRow}>
          <Pressable
            accessibilityLabel={tr.profile.profilePhoto}
            accessibilityRole={onProfilePhotoPress ? "imagebutton" : "image"}
            disabled={!onProfilePhotoPress}
            onPress={onProfilePhotoPress}
            style={styles.avatarFrame}
          >
            <AvatarView
              uri={profilePhoto}
              name={name}
              size={PROFILE_HERO_AVATAR_SIZE}
            />
          </Pressable>

          {action ? <View style={styles.actionSlot}>{action}</View> : null}
        </View>

        <AppText accessibilityRole="header" style={styles.name}>{name}</AppText>
        <AppText style={styles.username}>@{username}</AppText>
        {bio ? (
          <ExpandableText
            text={bio}
            collapsedLines={3}
            textStyle={styles.bio}
          />
        ) : null}

        {detailsContent}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surface,
  },
  coverWrap: {
    minHeight: PROFILE_HERO_COVER_HEIGHT,
    position: "relative",
  },
  coverPressable: {
    flex: 1,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  backButton: {
    position: "absolute",
    left: spacing.md,
    width: minTouchSize,
    height: minTouchSize,
    borderRadius: radius.pill,
  },
  body: {
    paddingHorizontal: spacing.screen,
    // The follower counts that close the hero carry 48dp targets, so they
    // already hold half of that as air above the tabs.
    paddingBottom: spacing.sm,
    marginTop: -26,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  avatarFrame: {
    borderRadius: radius.pill,
    padding: spacing.xs,
    backgroundColor: colors.surface,
  },
  actionSlot: {
    flexShrink: 1,
    marginBottom: spacing.xs,
  },
  name: {
    marginTop: spacing.md,
    ...typography.title,
    color: colors.text,
  },
  username: textStyle('captionText', colors.textSoft),
  bio: {
    marginTop: spacing.xs,
    ...typography.bodyText,
    color: colors.textMuted,
  },
});
