import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { colors, elevation, typography } from '@/mobile/app/shared/theme/tokens';

// Soft two-tone washes built from the palette's own tints, so a list without
// a cover still looks designed rather than empty.
const WASHES = [
  [colors.primaryBg, colors.infoBorder],
  [colors.successBg, colors.successBorder],
  [colors.warningBg, colors.warningBorder],
  [colors.dangerBg, colors.dangerBorder],
] as const;

// The same list always gets the same wash, on every screen and every launch.
export function pickListCoverWash(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return WASHES[Math.abs(hash) % WASHES.length];
}

/**
 * The cover a list shows when it has no photo and no places to map. It used to
 * be a flat blue box with a 17px emoji in its middle, which on Explore read as
 * a map that had failed to load.
 */
export function ListCoverFallback({ emoji, seed }: { emoji: string; seed: string }) {
  const [from, to] = pickListCoverWash(seed);
  const gradientId = `list-cover-${seed}`;

  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${gradientId})`} />
      </Svg>
      <View style={styles.badge}>
        <AppText accessible={false} style={styles.emoji}>{emoji}</AppText>
      </View>
    </View>
  );
}

const BADGE_SIZE = 64;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  emoji: typography.headlineText,
});
