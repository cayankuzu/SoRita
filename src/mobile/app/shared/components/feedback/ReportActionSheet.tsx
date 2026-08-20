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
  onSubmit: () => void | Promise<void>;
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
      accessibilityLabel={title}
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
            <Flag color={colors.warning} size={14} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </View>
        </View>
        <IconButton accessibilityLabel={tr.common.close} onPress={onClose} variant="surface">
          <X color={colors.textMuted} size={14} />
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
          accessibilityLabel={tr.cards.reportDetailsPlaceholder}
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
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
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
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  options: {
    gap: 8,
  },
  detailsWrap: {
    gap: 6,
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  detailsInput: {
    minHeight: 92,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text,
  },
  option: {
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  optionActive: {
    borderColor: colors.warning,
    backgroundColor: colors.warningBg,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  optionTextActive: {
    color: colors.warningText,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: 120,
  },
});
