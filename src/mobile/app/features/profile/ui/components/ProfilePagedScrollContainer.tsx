import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/mobile/app/shared/theme/tokens';

type ProfilePagedScrollContainerProps = {
  pager: React.ReactElement;
};

export function ProfilePagedScrollContainer({
  pager,
}: ProfilePagedScrollContainerProps) {
  return (
    <View style={styles.container} testID="profile-paged-container">
      {pager}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
