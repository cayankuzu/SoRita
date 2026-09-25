import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Play } from 'lucide-react-native';

import { Badge } from '@/mobile/app/shared/components/ui/Badge';
import { colors, iconSize, radius, spacing } from '@/mobile/app/shared/theme/tokens';

type VideoBadgesProps = {
  durationLabel?: string | null;
  showPlay: boolean;
};

// The play mark in the top corner and the length in the bottom corner of a
// video, the same on a thumbnail and on a paused preview.
export function VideoBadges({ durationLabel, showPlay }: VideoBadgesProps) {
  return (
    <>
      {showPlay ? (
        <View pointerEvents="none" style={styles.playOverlay}>
          <View style={styles.playBadge}>
            <Play color={colors.onPrimary} fill={colors.onPrimary} size={iconSize.xs} />
          </View>
        </View>
      ) : null}
      {durationLabel ? (
        <View pointerEvents="none" style={styles.durationBadge}>
          <Badge label={durationLabel} numeric tone="overlay" />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  playOverlay: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
  },
  playBadge: {
    width: 18,
    height: 18,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
  },
  durationBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
  },
});
