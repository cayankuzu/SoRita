import React from 'react';
import { View } from 'react-native';
import { Ellipsis } from 'lucide-react-native';

import { placeEditorModalStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorModalStyles';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, hitSlopFor, iconSize } from '@/mobile/app/shared/theme/tokens';

type PlaceEditorSaveProgressBannerProps = {
  detail?: string;
  progress: number;
  status?: 'active' | 'failed';
  onMenuPress?: () => void;
};

export function PlaceEditorSaveProgressBanner({
  detail,
  progress,
  status = 'active',
  onMenuPress,
}: PlaceEditorSaveProgressBannerProps) {
  const nextProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const isFailed = status === 'failed';

  return (
    <View style={styles.saveProgressBanner}>
      <View style={styles.saveProgressHeader}>
        <AppText accessibilityLiveRegion="polite" style={styles.saveProgressTitle}>
          {isFailed ? tr.placeEditor.saveFailedTitle : tr.placeEditor.saveProgressTitle}
        </AppText>
        <View style={styles.saveProgressMeta}>
          <AppText
            accessibilityLabel={`${nextProgress}%`}
            accessibilityLiveRegion="polite"
            style={[styles.saveProgressPercent, isFailed ? styles.saveProgressPercentFailed : null]}
          >
            {`%${nextProgress}`}
          </AppText>
          {onMenuPress ? (
            <InstantPressable
              accessibilityLabel={tr.common.contentActionsTitle}
              accessibilityRole="button"
              onPress={onMenuPress}
              hitSlop={hitSlopFor(24)}
              style={styles.saveProgressMenuButton}
            >
              <Ellipsis color={isFailed ? colors.danger : colors.textMuted} size={iconSize.sm} />
            </InstantPressable>
          ) : null}
        </View>
      </View>

      {detail ? <AppText style={styles.saveProgressDetail}>{detail}</AppText> : null}

      <View
        accessibilityLabel={`${
          isFailed ? tr.placeEditor.saveFailedTitle : tr.placeEditor.saveProgressTitle
        }: ${nextProgress}%`}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: nextProgress }}
        style={styles.saveProgressTrack}
      >
        <View
          style={[
            styles.saveProgressFill,
            isFailed ? styles.saveProgressFillFailed : null,
            { width: `${nextProgress}%` },
          ]}
        />
      </View>

      <AppText style={styles.saveProgressWarning}>
        {isFailed ? tr.placeEditor.saveFailedWarning : tr.placeEditor.saveProgressWarning}
      </AppText>
    </View>
  );
}
