import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  colors,
  contentWidth,
  elevation,
  radius,
  spacing,
} from '@/mobile/app/shared/theme/tokens';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { useModalAccessibilityFocus } from '@/mobile/app/shared/hooks/useModalAccessibilityFocus';
import { useModalAnimationType } from '@/mobile/app/shared/hooks/useModalAnimationType';
import {
  getAndroidModalWindowProps,
  getModalContentMaxHeight,
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';


type ModalScaffoldProps = {
  accessibilityLabel: string;
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  dismissOnBackdropPress?: boolean;
  footer?: React.ReactNode;
  initialFocusRef?: React.RefObject<unknown>;
  onClose: () => void;
  returnFocusRef?: React.RefObject<unknown>;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: 'dialog' | 'sheet';
  showHandle?: boolean;
  visible: boolean;
};

export function ModalScaffold({
  accessibilityLabel,
  children,
  contentContainerStyle,
  dismissOnBackdropPress = false,
  footer,
  initialFocusRef,
  onClose,
  returnFocusRef,
  scroll = false,
  style,
  variant = 'dialog',
  showHandle,
  visible,
}: ModalScaffoldProps) {
  const animationType = useModalAnimationType(variant === 'sheet' ? 'slide' : 'fade');
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { paddingTop, paddingBottom } = getModalSafeAreaPadding({
    topInset: insets.top,
    bottomInset: insets.bottom,
    topSpacing: variant === 'sheet' ? 20 : 16,
    bottomSpacing: variant === 'sheet' ? 12 : 16,
    minBottomPadding: Platform.OS === 'android' ? 24 : 16,
  });
  const maxHeight = getModalContentMaxHeight({
    viewportHeight: height,
    paddingTop,
    paddingBottom,
    maxHeightRatio: variant === 'sheet' ? 0.9 : 0.82,
    minHeight: 224,
  });

  useModalAccessibilityFocus({
    accessibilityLabel,
    initialFocusRef,
    returnFocusRef,
    visible,
  });

  return (
    <Modal
      {...getAndroidModalWindowProps({
        navigationBarTranslucent: true,
        statusBarTranslucent: true,
      })}
      visible={visible}
      transparent
      animationType={animationType}
      hardwareAccelerated
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        onAccessibilityEscape={onClose}
        style={[
          styles.overlay,
          variant === 'sheet' ? styles.sheetOverlay : styles.dialogOverlay,
          { paddingTop, paddingBottom },
        ]}
        accessibilityViewIsModal
        importantForAccessibility="yes"
      >
        {dismissOnBackdropPress ? (
          <InstantPressable
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onPress={onClose}
            style={StyleSheet.absoluteFillObject}
          />
        ) : null}
        <View
          accessible={false}
          style={[
            styles.container,
            variant === 'sheet' ? styles.sheet : styles.dialog,
            { maxHeight },
            style,
          ]}
        >
          {variant === 'sheet' && showHandle !== false ? (
            <View accessibilityElementsHidden style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>
          ) : null}
          {scroll ? (
            <ScrollView
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
              contentContainerStyle={[styles.content, contentContainerStyle]}
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.content, contentContainerStyle]}>{children}</View>
          )}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    backgroundColor: colors.overlay,
  },
  dialogOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOverlay: {
    justifyContent: 'flex-end',
  },
  container: {
    width: '100%',
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...elevation.modal,
  },
  dialog: {
    maxWidth: 396,
    borderRadius: radius.xl,
  },
  sheet: {
    maxWidth: contentWidth.sheet,
    alignSelf: 'center',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handleWrap: {
    height: 16,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  handle: {
    width: 34,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
  content: {
    padding: spacing.section,
    gap: spacing.lg,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    padding: spacing.section,
    paddingTop: spacing.md,
  },
});
