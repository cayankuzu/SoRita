import React from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { ModalScaffold } from '@/mobile/app/shared/components/feedback/ModalScaffold';
import { AppText, type AppTextRef } from '@/mobile/app/shared/components/ui/AppText';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';

type ConfirmActionModalProps = {
  visible: boolean;
  title: string;
  description: string;
  cancelLabel?: string;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger';
  onClose: () => void;
  confirmingLabel?: string;
  onConfirm: () => Promise<void> | void;
  returnFocusRef?: React.RefObject<unknown>;
};

export function ConfirmActionModal({
  visible,
  title,
  description,
  cancelLabel = tr.common.cancel,
  confirmLabel,
  confirmingLabel,
  confirmVariant = 'primary',
  onClose,
  onConfirm,
  returnFocusRef,
}: ConfirmActionModalProps) {
  const isDanger = confirmVariant === 'danger';
  const titleRef = React.useRef<AppTextRef | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!visible) {
      setIsSubmitting(false);
      setErrorMessage(null);
    }
  }, [visible]);

  const handleClose = React.useCallback(() => {
    if (isSubmitting) {
      return;
    }

    onClose();
  }, [isSubmitting, onClose]);

  const handleConfirm = React.useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onConfirm();
      onClose();
    } catch (error) {
      logger.warn('ui', 'Confirm action failed', error);
      const message = getUserFacingErrorMessage(error, tr.common.unexpectedError);
      setErrorMessage(message);
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, onClose, onConfirm]);

  return (
    <ModalScaffold
      visible={visible}
      accessibilityLabel={title}
      initialFocusRef={titleRef}
      onClose={handleClose}
      returnFocusRef={returnFocusRef}
      variant="dialog"
      footer={
        <View style={styles.modalActions}>
          <PrimaryButton
            title={cancelLabel}
            disabled={isSubmitting}
            variant="secondary"
            onPress={handleClose}
            style={styles.modalButton}
          />
          <PrimaryButton
            title={isSubmitting ? confirmingLabel || `${confirmLabel}...` : confirmLabel}
            loading={isSubmitting}
            variant={confirmVariant}
            onPress={handleConfirm}
            style={styles.modalButton}
          />
        </View>
      }
    >
      <View style={styles.confirmHeader}>
        <View style={[styles.confirmIcon, isDanger ? styles.confirmIconDanger : styles.confirmIconPrimary]}>
          <AlertTriangle color={isDanger ? colors.danger : colors.primary} size={18} />
        </View>
        <View style={styles.confirmCopy}>
          <AppText ref={titleRef} accessibilityRole="header" style={styles.confirmTitle}>{title}</AppText>
          <AppText style={styles.confirmText}>{description}</AppText>
          {errorMessage ? (
            <AppText
              accessibilityLiveRegion="assertive"
              accessibilityRole="alert"
              style={styles.errorText}
            >
              {errorMessage}
            </AppText>
          ) : null}
        </View>
      </View>
    </ModalScaffold>
  );
}

const styles = StyleSheet.create({
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  confirmIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    ...typography.section,
    color: colors.text,
  },
  confirmText: {
    ...typography.bodyText,
    color: colors.textMuted,
  },
  errorText: {
    marginTop: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...typography.captionText,
    color: colors.danger,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  modalButton: {
    flex: 1,
    minWidth: 120,
  },
});
