import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import type { LegalDocumentId } from '@/mobile/app/features/auth/ui/content/legalDocuments';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

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
    try {
      await Linking.openURL(SORITA_WEB_URL);
    } catch {
      showToast('Detayli bilgi sayfasi acilamadi. Lutfen daha sonra tekrar dene.', 'error');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.copyBlock}>
        <Text style={styles.title}>Guvenli topluluk onayi gerekli</Text>
        <Text style={styles.subtitle}>
          Uygunsuz icerik ve kotuye kullanim icin sifir tolerans uygulanir. Raporlar en gec 24 saat
          icinde incelenir.
        </Text>
        <Text style={styles.linksText}>
          Devam ederek{' '}
          <Text style={styles.inlineLink} onPress={() => onOpenDocument('terms')}>
            Kullanim Kosullari
          </Text>
          ,{' '}
          <Text style={styles.inlineLink} onPress={() => onOpenDocument('community')}>
            Topluluk Kurallari
          </Text>
          ,{' '}
          <Text style={styles.inlineLink} onPress={() => onOpenDocument('privacy')}>
            Gizlilik Politikasi
          </Text>
          {' '}ve{' '}
          <Text style={styles.inlineLink} onPress={() => onOpenDocument('kvkk')}>
            KVKK Aydinlatma Metni
          </Text>
          'ni kabul edersin.
        </Text>
        <Text style={styles.linksText}>
          Detayli bilgi icin{' '}
          <Text style={styles.inlineLink} onPress={openWebsite}>
            web sitesi
          </Text>
          .
        </Text>
      </View>

      <InstantPressable style={styles.checkboxRow} onPress={onToggle}>
        <View style={[styles.checkbox, accepted ? styles.checkboxChecked : null]}>
          {accepted ? <Check color={colors.onPrimary} size={14} /> : null}
        </View>
        <Text style={styles.checkboxLabel}>
          Yukaridaki metinleri okudum, kabul ediyorum ve uygulamaya bu onayla devam ediyorum.
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
  inlineLink: {
    color: colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  checkboxRow: {
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
