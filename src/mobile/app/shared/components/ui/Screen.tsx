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

function getVariantMaxWidth(variant: ScreenProps['variant']) {
  switch (variant) {
    case 'form':
      return contentWidth.form;
    case 'feed':
      return contentWidth.feed;
    case 'settings':
      return contentWidth.settings;
    default:
      return undefined;
  }
}

function getSafeAreaEdges(
  safeTop: boolean,
  safeBottom: boolean,
  bottomTabBarHeight: number | null | undefined,
) {
  const edges: Edge[] = [];

  if (safeTop) {
    edges.push('top');
  }

  if (safeBottom && typeof bottomTabBarHeight !== 'number') {
    edges.push('bottom');
  }

  return edges;
}

function getBottomPadding(
  safeBottom: boolean,
  bottomTabBarHeight: number | null | undefined,
  bottomInset: number,
) {
  if (!safeBottom) {
    return 0;
  }

  return typeof bottomTabBarHeight === 'number'
    ? spacing.card
    : bottomInset + spacing.card;
}

function ContentRail({
  children,
  maxWidth,
}: {
  children: React.ReactNode;
  maxWidth?: number;
}) {
  if (!maxWidth) {
    return <>{children}</>;
  }

  return (
    <View style={[styles.contentRail, { maxWidth, width: '100%' }]}>
      {children}
    </View>
  );
}

type ScreenContentProps = {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  horizontalPadding: number;
  maxWidth?: number;
  onRefresh?: () => void;
  padded: boolean;
  refreshing: boolean;
  scroll: boolean;
  scrollBottomPadding: number;
  scrollViewRef?: React.RefObject<ScrollView | null>;
  shouldUseAutomaticKeyboardInsets: boolean;
};

function ScreenContent(props: ScreenContentProps) {
  const centeredStyle = props.maxWidth ? styles.centeredContent : null;
  const horizontalStyle = props.padded ? { paddingHorizontal: props.horizontalPadding } : null;
  const content = <ContentRail maxWidth={props.maxWidth}>{props.children}</ContentRail>;

  if (!props.scroll && !props.onRefresh) {
    return (
      <View
        style={[
          styles.staticContent,
          horizontalStyle,
          centeredStyle,
          props.contentContainerStyle,
          { paddingBottom: props.scrollBottomPadding },
        ]}
      >
        {content}
      </View>
    );
  }

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets={props.shouldUseAutomaticKeyboardInsets}
      contentInsetAdjustmentBehavior="automatic"
      ref={props.scrollViewRef}
      style={styles.scrollView}
      contentContainerStyle={[
        props.scroll ? styles.scrollContent : styles.staticScrollContent,
        horizontalStyle,
        centeredStyle,
        props.contentContainerStyle,
        { paddingBottom: props.scrollBottomPadding },
      ]}
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        props.onRefresh ? (
          <RefreshControl
            refreshing={props.refreshing}
            onRefresh={props.onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    >
      {content}
    </ScrollView>
  );
}

export function Screen(props: ScreenProps) {
  const scroll = props.scroll ?? true;
  const padded = props.padded ?? true;
  const safeTop = props.safeTop ?? true;
  const safeBottom = props.safeBottom ?? true;
  const refreshing = props.refreshing ?? false;
  const variant = props.variant ?? 'default';
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = React.useContext(BottomTabBarHeightContext);
  const resolvedMaxWidth = props.maxWidth ?? getVariantMaxWidth(variant);
  const appLayout = useAppLayout({ maxContentWidth: resolvedMaxWidth });
  const resolvedKeyboardMode = props.keyboardMode ?? (variant === 'form' ? 'form' : 'default');
  const shouldUseAutomaticKeyboardInsets =
    Platform.OS === 'ios' && resolvedKeyboardMode === 'form';
  const keyboardAvoidingBehavior =
    Platform.OS === 'ios' && resolvedKeyboardMode !== 'form' ? 'padding' : undefined;
  const horizontalPadding = variant === 'fullBleed' ? 0 : appLayout.screenPadding;
  const contentMaxWidth = variant === 'fullBleed' ? undefined : resolvedMaxWidth;
  const sharedBottomPadding = getBottomPadding(safeBottom, bottomTabBarHeight, insets.bottom);
  const edges = getSafeAreaEdges(safeTop, safeBottom, bottomTabBarHeight);

  return (
    <SafeAreaView style={[styles.safeArea, props.style]} edges={edges}>
      <KeyboardAvoidingView
        behavior={keyboardAvoidingBehavior}
        style={styles.keyboardAvoider}
      >
        <ScreenContent
          contentContainerStyle={props.contentContainerStyle}
          horizontalPadding={horizontalPadding}
          maxWidth={contentMaxWidth}
          onRefresh={props.onRefresh}
          padded={padded}
          refreshing={refreshing}
          scroll={scroll}
          scrollBottomPadding={sharedBottomPadding}
          scrollViewRef={props.scrollViewRef}
          shouldUseAutomaticKeyboardInsets={shouldUseAutomaticKeyboardInsets}
        >
          {props.children}
        </ScreenContent>
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
});
