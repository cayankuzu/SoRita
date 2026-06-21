import React from 'react';
import { Text, View } from 'react-native';

import { placeEditorModalStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorModalStyles';
import { tr } from '@/mobile/app/shared/i18n/tr';

type PlaceEditorSaveProgressBannerProps = {
  progress: number;
};

export function PlaceEditorSaveProgressBanner({ progress }: PlaceEditorSaveProgressBannerProps) {
  const nextProgress = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <View style={styles.saveProgressBanner}>
      <View style={styles.saveProgressHeader}>
        <Text style={styles.saveProgressTitle}>{tr.placeEditor.saveProgressTitle}</Text>
        <Text style={styles.saveProgressPercent}>{`%${nextProgress}`}</Text>
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: nextProgress }}
        style={styles.saveProgressTrack}
      >
        <View style={[styles.saveProgressFill, { width: `${nextProgress}%` }]} />
      </View>

      <Text style={styles.saveProgressWarning}>{tr.placeEditor.saveProgressWarning}</Text>
    </View>
  );
}
