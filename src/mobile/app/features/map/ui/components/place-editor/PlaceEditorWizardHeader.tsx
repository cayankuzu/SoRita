import React from 'react';
import { View } from 'react-native';

import { placeEditorModalStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorModalStyles';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';

type PlaceEditorWizardHeaderProps = {
  step: number;
  steps: ReadonlyArray<{ title: string; subtitle: string }>;
};

export function PlaceEditorWizardHeader({ step, steps }: PlaceEditorWizardHeaderProps) {
  return (
    <View style={styles.stepHeader}>
      <View>
        <AppText style={styles.stepTitle}>{steps[step].title}</AppText>
        <AppText style={styles.stepSubtitle}>{steps[step].subtitle}</AppText>
      </View>
      <View style={styles.stepDots}>
        {steps.map((_, index) => (
          <View
            key={index}
            style={[
              styles.stepDot,
              index === step ? styles.stepDotActive : null,
              index < step ? styles.stepDotDone : null,
            ]}
          />
        ))}
      </View>
    </View>
  );
}
