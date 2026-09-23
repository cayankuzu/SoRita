import React from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Flag, X } from 'lucide-react-native';

import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { ModalScaffold } from '@/mobile/app/shared/components/feedback/ModalScaffold';
import {
  getReportReasonsForTarget,
  type ReportTargetType,
} from '@/mobile/app/shared/components/feedback/reportReasonOptions';
import { AppText, type AppTextRef } from '@/mobile/app/shared/components/ui/AppText';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  fontWeight,
  iconSize,
  minTouchSize,
  radius,
  spacing,
  textStyle,
  typography,
} from '@/mobile/app/shared/theme/tokens';

type ReportActionSheetProps = {
  visible: boolean;
  title: string;
  description?: string;
  reportDetails?: string;
  reportReason: string;
  targetType: ReportTargetType;
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
  targetType,
  onReportDetailsChange,
  onReportReasonChange,
  onClose,
  onSubmit,
}: ReportActionSheetProps) {
  const titleRef = React.useRef<AppTextRef | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const reportReasons = React.useMemo(
    () => getReportReasonsForTarget(tr.cards.reportReasons, targetType),
    [targetType],
  );

  React.useEffect(() => {
    if (!visible) {
      setIsSubmitting(false);
      setErrorMessage(null);
    }
  }, [visible]);

  React.useEffect(() => {
    if (reportReason && !reportReasons.includes(reportReason)) {
      onReportReasonChange('');
    }
  }, [onReportReasonChange, reportReason, reportReasons]);

  const handleClose = React.useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  const handleSubmit = React.useCallback(async () => {
    if (!reportReason || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit();
    } catch (error) {
      logger.warn('ui', 'Report submission failed', error);
      const message = getUserFacingErrorMessage(error, tr.cards.reportFailed);
      setErrorMessage(message);
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, onSubmit, reportReason]);

  return (
    <ModalScaffold
      accessibilityLabel={title}
      visible={visible}
      initialFocusRef={titleRef}
      onClose={handleClose}
      variant="sheet"
      scroll
      dismissOnBackdropPress
      contentContainerStyle={styles.sheetContent}
      footer={
        <View style={styles.actions}>
          <PrimaryButton
            title={tr.common.cancel}
            variant="secondary"
            disabled={isSubmitting}
            onPress={handleClose}
            style={styles.actionButton}
          />
          <PrimaryButton
            title={tr.common.send}
            onPress={handleSubmit}
            disabled={!reportReason || isSubmitting}
            loading={isSubmitting}
            style={styles.actionButton}
          />
        </View>
      }
    >
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <View style={styles.iconWrap}>
            <Flag color={colors.warning} size={iconSize.sm} />
          </View>
          <View style={styles.headerTextWrap}>
            <AppText ref={titleRef} accessibilityRole="header" style={styles.title}>{title}</AppText>
            {description ? <AppText style={styles.description}>{description}</AppText> : null}
          </View>
        </View>
        <IconButton
          accessibilityLabel={tr.common.close}
          disabled={isSubmitting}
          onPress={handleClose}
          variant="surface"
        >
          <X color={colors.textMuted} size={iconSize.sm} />
        </IconButton>
      </View>

      <View accessibilityRole="radiogroup" style={styles.options}>
        {reportReasons.map((reason) => {
          const selected = reportReason === reason;

          return (
            <InstantPressable
              key={reason}
              accessibilityLabel={reason}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: isSubmitting }}
              disabled={isSubmitting}
              style={[
                styles.option,
                selected ? styles.optionActive : null,
              ]}
              onPress={() => {
                setErrorMessage(null);
                onReportReasonChange(reason);
              }}
            >
              <AppText
                style={[
                  styles.optionText,
                  selected ? styles.optionTextActive : null,
                ]}
              >
                {reason}
              </AppText>
            </InstantPressable>
          );
        })}
      </View>

      <View style={styles.detailsWrap}>
        <AppText style={styles.detailsLabel}>{tr.cards.reportDetailsLabel}</AppText>
        <TextInput
          accessibilityLabel={tr.cards.reportDetailsPlaceholder}
          multiline
          maxLength={600}
          placeholder={tr.cards.reportDetailsPlaceholder}
          placeholderTextColor={colors.textMuted}
          style={styles.detailsInput}
          textAlignVertical="top"
          value={reportDetails}
          editable={!isSubmitting}
          onChangeText={(value) => {
            setErrorMessage(null);
            onReportDetailsChange?.(value);
          }}
        />
      </View>

      {errorMessage ? (
        <AppText
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
          style={styles.errorText}
        >
          {errorMessage}
        </AppText>
      ) : null}
    </ModalScaffold>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    paddingTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
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
    gap: spacing.xs,
  },
  title: textStyle('section', colors.text),
  description: textStyle('bodyText', colors.textMuted),
  options: {
    gap: spacing.sm,
  },
  detailsWrap: {
    gap: spacing.sm,
  },
  detailsLabel: textStyle('labelText', colors.text),
  detailsInput: {
    minHeight: 92,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.bodyText,
    color: colors.text,
  },
  option: {
    minHeight: minTouchSize,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  optionActive: {
    borderColor: colors.warning,
    backgroundColor: colors.warningBg,
  },
  optionText: textStyle('bodyText', colors.textMuted, fontWeight.medium),
  optionTextActive: {
    color: colors.warning,
    fontWeight: fontWeight.strong,
  },
  errorText: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.captionText,
    fontWeight: fontWeight.medium,
    color: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: 120,
  },
});
