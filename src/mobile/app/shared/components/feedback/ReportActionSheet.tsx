import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Flag, X } from 'lucide-react-native';

import { ModalScaffold } from '@/mobile/app/shared/components/feedback/ModalScaffold';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type ReportActionSheetProps = {
  visible: boolean;
  title: string;
  description?: string;
  reportDetails?: string;
  reportReason: string;
  onReportDetailsChange?: (value: string) => void;
  onReportReasonChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function ReportActionSheet({
  visible,
  title,
  description,
  reportDetails = '',
  reportReason,
  onReportDetailsChange,
  onReportReasonChange,
  onClose,
  onSubmit,
}: ReportActionSheetProps) {
  return (
    <ModalScaffold
      visible={visible}
      onClose={onClose}
      variant="sheet"
      scroll
      dismissOnBackdropPress
      contentContainerStyle={styles.sheetContent}
      footer={
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
      }
    >
      <View style={styles.handle} />

      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <View style={styles.iconWrap}>
            <Flag color={colors.warning} size={16} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </View>
        </View>
        <IconButton accessibilityLabel={tr.common.close} onPress={onClose} variant="surface">
          <X color={colors.textMuted} size={16} />
        </IconButton>
      </View>

      <View style={styles.options}>
        {tr.cards.reportReasons.map((reason) => {
          const selected = reportReason === reason;

          return (
            <InstantPressable
              key={reason}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.option,
                selected ? styles.optionActive : null,
              ]}
              onPress={() => onReportReasonChange(reason)}
            >
              <Text
                style={[
                  styles.optionText,
                  selected ? styles.optionTextActive : null,
                ]}
              >
                {reason}
              </Text>
            </InstantPressable>
          );
        })}
      </View>

      <View style={styles.detailsWrap}>
        <Text style={styles.detailsLabel}>{tr.cards.reportDetailsLabel}</Text>
        <TextInput
          multiline
          maxLength={600}
          placeholder={tr.cards.reportDetailsPlaceholder}
          placeholderTextColor={colors.textMuted}
          style={styles.detailsInput}
          textAlignVertical="top"
          value={reportDetails}
          onChangeText={onReportDetailsChange}
        />
      </View>
    </ModalScaffold>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    paddingTop: 10,
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
    color: colors.textMuted,
  },
  options: {
    gap: 10,
  },
  detailsWrap: {
    gap: 8,
  },
  detailsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  detailsInput: {
    minHeight: 108,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  option: {
    minHeight: 48,
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
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: 140,
  },
});
