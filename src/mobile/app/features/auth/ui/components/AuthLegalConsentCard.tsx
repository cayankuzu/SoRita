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
  minTouchSize,
  radius,
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
          {accepted ? <Check color={colors.onPrimary} size={12} /> : null}
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
    gap: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    padding: 10,
  },
  copyBlock: {
    gap: 4,
  },
  title: {
    ...typography.compactTitleText,
    color: colors.text,
  },
  linksText: {
    ...typography.captionText,
    fontWeight: fontWeight.regular,
    color: colors.textMuted,
  },
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  linkButton: {
    minHeight: minTouchSize,
    justifyContent: 'center',
    paddingHorizontal: 4,
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
    gap: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: 6,
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
    ...typography.supportingText,
    color: colors.textMuted,
  },
});
