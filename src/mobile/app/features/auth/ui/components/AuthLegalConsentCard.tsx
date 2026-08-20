import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import type { LegalDocumentId } from '@/mobile/app/features/auth/ui/content/legalDocuments';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

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
        <Text style={styles.title}>{tr.auth.legalConsent.title}</Text>
        <Text style={styles.linksText}>
          {tr.auth.legalConsent.descriptionPrefix}{' '}
          <Text accessibilityRole="link" onPress={() => onOpenDocument('terms')} style={styles.inlineLink}>
            {tr.auth.legalConsent.terms}
          </Text>
          {', '}
          <Text accessibilityRole="link" onPress={() => onOpenDocument('community')} style={styles.inlineLink}>
            {tr.auth.legalConsent.community}
          </Text>
          {tr.auth.legalConsent.descriptionSuffix}
        </Text>
        <Text style={styles.linksText}>
          {tr.auth.legalConsent.noticePrefix}{' '}
          <Text accessibilityRole="link" onPress={() => onOpenDocument('privacy')} style={styles.inlineLink}>
            {tr.auth.legalConsent.privacy}
          </Text>
          {tr.common.andConnector}
          <Text accessibilityRole="link" onPress={() => onOpenDocument('kvkk')} style={styles.inlineLink}>
            {tr.auth.legalConsent.kvkk}
          </Text>
          {tr.auth.legalConsent.noticeSuffix}
        </Text>
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
        <Text style={styles.checkboxLabel}>
          {tr.auth.legalConsent.consentLabel}
        </Text>
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
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  linksText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  inlineLink: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  checkboxRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
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
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
});
