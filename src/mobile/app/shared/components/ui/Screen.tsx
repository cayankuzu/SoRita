import React from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  StyleProp,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/mobile/app/shared/theme/tokens';
import { getResponsiveScreenPadding } from '@/mobile/app/shared/utils/layout';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  safeTop?: boolean;
  safeBottom?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  contentContainerStyle,
  safeTop = true,
  safeBottom = true,
  refreshing = false,
  onRefresh,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const bottomTabBarHeight = React.useContext(BottomTabBarHeightContext);
  const shouldApplyBottomSafeArea = safeBottom && typeof bottomTabBarHeight !== 'number';
  const shouldUseScrollView = scroll || Boolean(onRefresh);
  const horizontalPadding = getResponsiveScreenPadding(width, height);
  const sharedBottomPadding = !safeBottom
    ? 0
    : typeof bottomTabBarHeight === 'number'
      ? spacing.card
      : insets.bottom + spacing.card;
  const scrollBottomPadding = sharedBottomPadding;
  const staticBottomPadding = sharedBottomPadding;
  const edges: Edge[] = [];

  if (safeTop) {
    edges.push('top');
  }

  if (shouldApplyBottomSafeArea) {
    edges.push('bottom');
  }

  const content = shouldUseScrollView ? (
    <ScrollView
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.scrollView}
      contentContainerStyle={[
        scroll ? styles.scrollContent : styles.staticScrollContent,
        padded ? { paddingHorizontal: horizontalPadding } : null,
        contentContainerStyle,
        { paddingBottom: scrollBottomPadding },
      ]}
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.staticContent,
        padded ? { paddingHorizontal: horizontalPadding } : null,
        contentContainerStyle,
        { paddingBottom: staticBottomPadding },
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, style]} edges={edges}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoider}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoider: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  staticScrollContent: {
    flexGrow: 1,
  },
  staticContent: {
    flex: 1,
  },
});
