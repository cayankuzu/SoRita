import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ScrollAwayHeader } from '@/mobile/app/shared/components/navigation/ScrollAwayHeader';
import type { ScrollAwayHeaderController } from '@/mobile/app/shared/hooks/useScrollAwayHeader';
import { colors } from '@/mobile/app/shared/theme/tokens';

type ExplorePagerLayoutProps = {
  header: React.ReactElement;
  headerController: ScrollAwayHeaderController;
  pager: React.ReactElement;
};

/**
 * Keeps browse controls outside the horizontal pager's transform boundary.
 * The controls float over the pages and slide away as results scroll down;
 * each page reserves their height at its top.
 */
export function ExplorePagerLayout({ header, headerController, pager }: ExplorePagerLayoutProps) {
  return (
    <View style={styles.container} testID="explore-pager-layout">
      <View style={styles.content} testID="explore-swipe-content">
        {pager}
      </View>
      <ScrollAwayHeader controller={headerController} testID="explore-stationary-header">
        {header}
      </ScrollAwayHeader>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
});
