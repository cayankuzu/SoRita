import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type ConfirmActionModalProps = {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger';
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmActionModal({
  visible,
  title,
  description,
  confirmLabel,
  confirmVariant = 'primary',
  onClose,
  onConfirm,
}: ConfirmActionModalProps) {
  const insets = useSafeAreaInsets();
  const isDanger = confirmVariant === 'danger';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <View style={[styles.modalOverlay, { paddingTop: 20 + insets.top, paddingBottom: 20 + insets.bottom }]}>
        <View style={styles.confirmCard}>
          <View style={styles.confirmHeader}>
            <View style={[styles.confirmIcon, isDanger ? styles.confirmIconDanger : styles.confirmIconPrimary]}>
              <AlertTriangle color={isDanger ? colors.danger : colors.primary} size={20} />
            </View>
            <View style={styles.confirmCopy}>
              <Text style={styles.confirmTitle}>{title}</Text>
              <Text style={styles.confirmText}>{description}</Text>
            </View>
          </View>

          <View style={styles.modalActions}>
            <PrimaryButton title={tr.common.cancel} variant="secondary" onPress={onClose} style={styles.modalButton} />
            <PrimaryButton title={confirmLabel} variant={confirmVariant} onPress={onConfirm} style={styles.modalButton} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 16,
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  confirmIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmIconPrimary: {
    backgroundColor: colors.primaryBg,
  },
  confirmIconDanger: {
    backgroundColor: colors.dangerBg,
  },
  confirmCopy: {
    flex: 1,
    gap: 4,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  confirmText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
});
