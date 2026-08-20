import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ellipsis } from 'lucide-react-native';

import { placeEditorModalStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorModalStyles';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

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
        <Text style={styles.saveProgressTitle}>
          {isFailed ? tr.placeEditor.saveFailedTitle : tr.placeEditor.saveProgressTitle}
        </Text>
        <View style={styles.saveProgressMeta}>
          <Text style={[styles.saveProgressPercent, isFailed ? styles.saveProgressPercentFailed : null]}>
            {`%${nextProgress}`}
          </Text>
          {onMenuPress ? (
            <Pressable
              accessibilityLabel={tr.common.contentActionsTitle}
              accessibilityRole="button"
              onPress={onMenuPress}
              style={styles.saveProgressMenuButton}
            >
              <Ellipsis color={isFailed ? colors.danger : colors.textMuted} size={16} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {detail ? <Text style={styles.saveProgressDetail}>{detail}</Text> : null}

      <View
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

      <Text style={styles.saveProgressWarning}>
        {isFailed ? tr.placeEditor.saveFailedWarning : tr.placeEditor.saveProgressWarning}
      </Text>
    </View>
  );
}
