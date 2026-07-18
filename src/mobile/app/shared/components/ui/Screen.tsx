import React from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, contentWidth, spacing } from '@/mobile/app/shared/theme/tokens';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollViewRef?: React.RefObject<ScrollView | null>;
  safeTop?: boolean;
  safeBottom?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  maxWidth?: number;
  keyboardMode?: 'default' | 'form';
  variant?: 'default' | 'feed' | 'form' | 'fullBleed' | 'settings';
};

export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  contentContainerStyle,
  scrollViewRef,
  safeTop = true,
  safeBottom = true,
  refreshing = false,
  onRefresh,
  maxWidth,
  keyboardMode,
  variant = 'default',
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = React.useContext(BottomTabBarHeightContext);
  const resolvedMaxWidth =
    maxWidth ??
    (variant === 'form'
      ? contentWidth.form
      : variant === 'feed'
        ? contentWidth.feed
        : variant === 'settings'
          ? contentWidth.settings
          : undefined);
  const appLayout = useAppLayout({ maxContentWidth: resolvedMaxWidth });
  const shouldApplyBottomSafeArea = safeBottom && typeof bottomTabBarHeight !== 'number';
  const shouldUseScrollView = scroll || Boolean(onRefresh);
  const resolvedKeyboardMode = keyboardMode ?? (variant === 'form' ? 'form' : 'default');
  const shouldUseAutomaticKeyboardInsets =
    Platform.OS === 'ios' && resolvedKeyboardMode === 'form';
  const keyboardAvoidingBehavior =
    Platform.OS === 'ios' && resolvedKeyboardMode !== 'form' ? 'padding' : undefined;
  const horizontalPadding = variant === 'fullBleed' ? 0 : appLayout.screenPadding;
  const shouldConstrainContent = Boolean(resolvedMaxWidth && variant !== 'fullBleed');
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

  const contentRailStyle = shouldConstrainContent
    ? [
        styles.contentRail,
        {
          maxWidth: resolvedMaxWidth,
          width: '100%' as const,
        },
      ]
    : styles.fullWidthRail;
  const contentChildren = shouldConstrainContent ? (
    <View style={contentRailStyle}>{children}</View>
  ) : (
    children
  );

  const content = shouldUseScrollView ? (
    <ScrollView
      automaticallyAdjustKeyboardInsets={shouldUseAutomaticKeyboardInsets}
      contentInsetAdjustmentBehavior="automatic"
      ref={scrollViewRef}
      style={styles.scrollView}
      contentContainerStyle={[
        scroll ? styles.scrollContent : styles.staticScrollContent,
        padded ? { paddingHorizontal: horizontalPadding } : null,
        shouldConstrainContent ? styles.centeredContent : null,
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
      {contentChildren}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.staticContent,
        padded ? { paddingHorizontal: horizontalPadding } : null,
        shouldConstrainContent ? styles.centeredContent : null,
        contentContainerStyle,
        { paddingBottom: staticBottomPadding },
      ]}
    >
      {contentChildren}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, style]} edges={edges}>
      <KeyboardAvoidingView
        behavior={keyboardAvoidingBehavior}
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
  centeredContent: {
    alignItems: 'center',
  },
  contentRail: {
    flexGrow: 1,
    alignSelf: 'center',
  },
  fullWidthRail: {
    width: '100%',
  },
});
