import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ban, Flag, X } from 'lucide-react-native';

import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type UserProfileActionsSheetProps = {
  visible: boolean;
  isBlockedByCurrent: boolean;
  onClose: () => void;
  onOpenBlockConfirm: () => void;
  onOpenReport: () => void;
  onUnblock: () => void;
};

export function UserProfileActionsSheet({
  visible,
  isBlockedByCurrent,
  onClose,
  onOpenBlockConfirm,
  onOpenReport,
  onUnblock,
}: UserProfileActionsSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <View style={styles.sheetCard}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Profil islemleri</Text>
            <Pressable onPress={onClose} style={styles.sheetCloseButton}>
              <X color={colors.textSoft} size={16} />
            </Pressable>
          </View>

          {isBlockedByCurrent ? (
            <Pressable style={styles.sheetAction} onPress={onUnblock}>
              <Ban color={colors.secondary} size={16} />
              <Text style={styles.sheetActionText}>Engeli kaldir</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={styles.sheetAction}
                onPress={onOpenReport}
              >
                <Flag color={colors.warning} size={16} />
                <Text style={styles.sheetActionText}>Sikayet et</Text>
              </Pressable>
              <Pressable
                style={styles.sheetAction}
                onPress={onOpenBlockConfirm}
              >
                <Ban color={colors.danger} size={16} />
                <Text style={[styles.sheetActionText, styles.sheetActionTextDanger]}>Engelle</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetOverlay: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
  },
  sheetCard: {
    width: '100%',
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  sheetCloseButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sheetActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  sheetActionTextDanger: {
    color: colors.danger,
  },
});
