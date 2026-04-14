import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Flag, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type ReportActionSheetProps = {
  visible: boolean;
  title: string;
  description?: string;
  reportReason: string;
  onReportReasonChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function ReportActionSheet({
  visible,
  title,
  description,
  reportReason,
  onReportReasonChange,
  onClose,
  onSubmit,
}: ReportActionSheetProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 16);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingBottom: bottomInset }]}>
        <InstantPressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: bottomInset }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <View style={styles.iconWrap}>
                <Flag color={colors.warning} size={16} />
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={styles.title}>{title}</Text>
                {description ? <Text style={styles.description}>{description}</Text> : null}
              </View>
            </View>
            <InstantPressable onPress={onClose} style={styles.closeButton}>
              <X color={colors.textSoft} size={16} />
            </InstantPressable>
          </View>

          <View style={styles.options}>
            {tr.cards.reportReasons.map((reason) => (
              <InstantPressable
                key={reason}
                style={[
                  styles.option,
                  reportReason === reason ? styles.optionActive : null,
                ]}
                onPress={() => onReportReasonChange(reason)}
              >
                <Text
                  style={[
                    styles.optionText,
                    reportReason === reason ? styles.optionTextActive : null,
                  ]}
                >
                  {reason}
                </Text>
              </InstantPressable>
            ))}
          </View>

          <View style={styles.actions}>
            <PrimaryButton
              title={tr.common.cancel}
              variant="secondary"
              onPress={onClose}
              style={styles.actionButton}
            />
            <PrimaryButton
              title={tr.common.send}
              onPress={onSubmit}
              disabled={!reportReason}
              style={styles.actionButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 18,
  },
  handle: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warningBg,
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSoft,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  options: {
    gap: 10,
  },
  option: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  optionActive: {
    borderColor: colors.warning,
    backgroundColor: colors.warningBg,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  optionTextActive: {
    color: colors.warningText,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
});
