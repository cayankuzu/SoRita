import React from 'react';
import { Text, View } from 'react-native';

import { placeEditorModalStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorModalStyles';

type PlaceEditorWizardHeaderProps = {
  step: number;
  steps: ReadonlyArray<{ title: string; subtitle: string }>;
};

export function PlaceEditorWizardHeader({ step, steps }: PlaceEditorWizardHeaderProps) {
  return (
    <View style={styles.stepHeader}>
      <View>
        <Text style={styles.stepTitle}>{steps[step].title}</Text>
        <Text style={styles.stepSubtitle}>{steps[step].subtitle}</Text>
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
