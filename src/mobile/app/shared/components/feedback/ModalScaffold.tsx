import React from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
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

import { colors, contentWidth, elevation, radius } from '@/mobile/app/shared/theme/tokens';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import {
  getAndroidModalWindowProps,
  getModalContentMaxHeight,
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';

type FocusTarget = Parameters<typeof findNodeHandle>[0];

type ModalScaffoldProps = {
  accessibilityLabel?: string;
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
  visible,
}: ModalScaffoldProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const containerRef = React.useRef<View>(null);
  const wasVisibleRef = React.useRef(false);
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
    minHeight: 260,
  });

  React.useEffect(() => {
    if (visible) {
      wasVisibleRef.current = true;
      const focusTimer = setTimeout(() => {
        const target = initialFocusRef?.current ?? containerRef.current;
        const targetHandle = findNodeHandle(target as FocusTarget);

        if (targetHandle) {
          AccessibilityInfo.setAccessibilityFocus(targetHandle);
        }
      }, 120);

      return () => clearTimeout(focusTimer);
    }

    if (wasVisibleRef.current && returnFocusRef?.current) {
      const restoreTimer = setTimeout(() => {
        const targetHandle = findNodeHandle(returnFocusRef.current as FocusTarget);

        if (targetHandle) {
          AccessibilityInfo.setAccessibilityFocus(targetHandle);
        }
      }, 80);

      wasVisibleRef.current = false;
      return () => clearTimeout(restoreTimer);
    }

    return undefined;
  }, [initialFocusRef, returnFocusRef, visible]);

  return (
    <Modal
      {...getAndroidModalWindowProps({
        navigationBarTranslucent: true,
        statusBarTranslucent: true,
      })}
      visible={visible}
      transparent
      animationType="fade"
      hardwareAccelerated
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onPress={onClose}
            style={StyleSheet.absoluteFillObject}
          />
        ) : null}
        <View
          ref={containerRef}
          accessible={Boolean(accessibilityLabel)}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole={variant === 'dialog' ? 'alert' : undefined}
          style={[
            styles.container,
            variant === 'sheet' ? styles.sheet : styles.dialog,
            { maxHeight },
            style,
          ]}
        >
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
    paddingHorizontal: 16,
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
    maxWidth: 440,
    borderRadius: radius.xl,
  },
  sheet: {
    maxWidth: contentWidth.sheet,
    alignSelf: 'center',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  content: {
    padding: 18,
    gap: 16,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    padding: 18,
    paddingTop: 14,
  },
});
