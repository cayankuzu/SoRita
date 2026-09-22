import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';

import type { LegalDocumentId } from '@/mobile/app/features/auth/ui/content/legalDocuments';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
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

type AuthLegalConsentCardProps = {
  accepted: boolean;
  onToggle: () => void;
  onOpenDocument: (documentId: LegalDocumentId) => void;
};

export function AuthLegalConsentCard({
  accepted,
  onToggle,
  onOpenDocument,
}: AuthLegalConsentCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.copyBlock}>
        <AppText accessibilityRole="header" style={styles.title}>{tr.auth.legalConsent.title}</AppText>
        <AppText style={styles.linksText}>{tr.auth.legalConsent.descriptionPrefix}</AppText>
        <View style={styles.linksRow}>
          <InstantPressable
            accessibilityLabel={tr.auth.legalConsent.terms}
            accessibilityRole="link"
            hitSlop={0}
            onPress={() => onOpenDocument('terms')}
            style={styles.linkButton}
          >
            <AppText style={styles.inlineLink}>
            {tr.auth.legalConsent.terms}
            </AppText>
          </InstantPressable>
          <InstantPressable
            accessibilityLabel={tr.auth.legalConsent.community}
            accessibilityRole="link"
            hitSlop={0}
            onPress={() => onOpenDocument('community')}
            style={styles.linkButton}
          >
            <AppText style={styles.inlineLink}>
            {tr.auth.legalConsent.community}
            </AppText>
          </InstantPressable>
        </View>
        <AppText style={styles.linksText}>{tr.auth.legalConsent.noticePrefix}</AppText>
        <View style={styles.linksRow}>
          <InstantPressable
            accessibilityLabel={tr.auth.legalConsent.privacy}
            accessibilityRole="link"
            hitSlop={0}
            onPress={() => onOpenDocument('privacy')}
            style={styles.linkButton}
          >
            <AppText style={styles.inlineLink}>
            {tr.auth.legalConsent.privacy}
            </AppText>
          </InstantPressable>
          <InstantPressable
            accessibilityLabel={tr.auth.legalConsent.kvkk}
            accessibilityRole="link"
            hitSlop={0}
            onPress={() => onOpenDocument('kvkk')}
            style={styles.linkButton}
          >
            <AppText style={styles.inlineLink}>
            {tr.auth.legalConsent.kvkk}
            </AppText>
          </InstantPressable>
        </View>
      </View>

      <InstantPressable
        accessibilityLabel={tr.auth.legalConsent.consentLabel}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        style={styles.checkboxRow}
        onPress={onToggle}
      >
        <View style={[styles.checkbox, accepted ? styles.checkboxChecked : null]}>
          {accepted ? <Check color={colors.onPrimary} size={iconSize.xs} /> : null}
        </View>
        <AppText style={styles.checkboxLabel}>
          {tr.auth.legalConsent.consentLabel}
        </AppText>
      </InstantPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.card,
  },
  copyBlock: {
    gap: spacing.xs,
  },
  title: textStyle('compactTitleText', colors.text),
  linksText: textStyle('captionText', colors.textMuted, fontWeight.regular),
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  linkButton: {
    minHeight: minTouchSize,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  inlineLink: {
    ...typography.labelText,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  checkboxRow: {
    minHeight: minTouchSize,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkboxLabel: {
    flex: 1,
    ...typography.bodyText,
    color: colors.textMuted,
  },
});
