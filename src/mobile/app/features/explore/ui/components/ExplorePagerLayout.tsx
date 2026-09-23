import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, zIndex } from '@/mobile/app/shared/theme/tokens';

type ExplorePagerLayoutProps = {
  header: React.ReactElement;
  pager: React.ReactElement;
};

/** Keeps browse controls outside the horizontal pager's transform boundary. */
export function ExplorePagerLayout({ header, pager }: ExplorePagerLayoutProps) {
  return (
    <View style={styles.container} testID="explore-pager-layout">
      <View style={styles.header} testID="explore-stationary-header">
        {header}
      </View>
      <View style={styles.content} testID="explore-swipe-content">
        {pager}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    backgroundColor: colors.background,
    zIndex: zIndex.raised,
  },
});
