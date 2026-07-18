import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import type { LegalDocumentId } from '@/mobile/app/features/auth/ui/content/legalDocuments';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { openSafeExternalUrl } from '@/mobile/app/shared/utils/safeLinks';

const SORITA_WEB_URL = 'https://cayankuzu.github.io/SoRita_web/';

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
  const openWebsite = async () => {
    const opened = await openSafeExternalUrl(SORITA_WEB_URL);

    if (!opened) {
      showToast(tr.auth.legal.openWebsiteFailed, 'error');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.copyBlock}>
        <Text style={styles.title}>{tr.auth.legalConsent.title}</Text>
        <Text style={styles.subtitle}>{tr.auth.legalConsent.subtitle}</Text>
        <View style={styles.linksFlow}>
          <Text style={styles.linksText}>{tr.auth.legalConsent.descriptionPrefix} </Text>
          <InstantPressable
            accessibilityLabel={tr.auth.legalConsent.terms}
            accessibilityRole="link"
            onPress={() => onOpenDocument('terms')}
            style={styles.inlineLinkButton}
          >
            <Text style={styles.inlineLink}>{tr.auth.legalConsent.terms}</Text>
          </InstantPressable>
          <Text style={styles.linksText}>, </Text>
          <InstantPressable
            accessibilityLabel={tr.auth.legalConsent.community}
            accessibilityRole="link"
            onPress={() => onOpenDocument('community')}
            style={styles.inlineLinkButton}
          >
            <Text style={styles.inlineLink}>{tr.auth.legalConsent.community}</Text>
          </InstantPressable>
          <Text style={styles.linksText}>, </Text>
          <InstantPressable
            accessibilityLabel={tr.auth.legalConsent.privacy}
            accessibilityRole="link"
            onPress={() => onOpenDocument('privacy')}
            style={styles.inlineLinkButton}
          >
            <Text style={styles.inlineLink}>{tr.auth.legalConsent.privacy}</Text>
          </InstantPressable>
          <Text style={styles.linksText}> ve </Text>
          <InstantPressable
            accessibilityLabel={tr.auth.legalConsent.kvkk}
            accessibilityRole="link"
            onPress={() => onOpenDocument('kvkk')}
            style={styles.inlineLinkButton}
          >
            <Text style={styles.inlineLink}>{tr.auth.legalConsent.kvkk}</Text>
          </InstantPressable>
          <Text style={styles.linksText}>{tr.auth.legalConsent.descriptionSuffix}</Text>
        </View>
        <View style={styles.linksFlow}>
          <Text style={styles.linksText}>{tr.auth.legalConsent.websitePrefix} </Text>
          <InstantPressable
            accessibilityLabel={tr.auth.legalConsent.websiteLink}
            accessibilityRole="link"
            onPress={openWebsite}
            style={styles.inlineLinkButton}
          >
            <Text style={styles.inlineLink}>{tr.auth.legalConsent.websiteLink}</Text>
          </InstantPressable>
          <Text style={styles.linksText}>.</Text>
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
          {accepted ? <Check color={colors.onPrimary} size={14} /> : null}
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
    gap: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    padding: 14,
  },
  copyBlock: {
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  linksText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  linksFlow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  inlineLinkButton: {
    minHeight: 32,
    justifyContent: 'center',
  },
  inlineLink: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  checkboxRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
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
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
