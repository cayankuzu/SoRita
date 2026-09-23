import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { FileText, Scale, ShieldCheck, Users } from 'lucide-react-native';

import {
  getLegalDocument,
  type LegalDocumentId,
} from '@/mobile/app/features/auth/ui/content/legalDocuments';
import { SheetHeader } from '@/mobile/app/shared/components/feedback/SheetHeader';
import { ModalScaffold } from '@/mobile/app/shared/components/feedback/ModalScaffold';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';

import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize, spacing, textStyle } from '@/mobile/app/shared/theme/tokens';

type AuthLegalSheetProps = {
  documentId: LegalDocumentId | null;
  visible: boolean;
  onClose: () => void;
};

function renderDocumentIcon(documentId: LegalDocumentId) {
  switch (documentId) {
    case 'terms':
      return <Scale color={colors.primary} size={iconSize.sm} />;
    case 'community':
      return <Users color={colors.warning} size={iconSize.sm} />;
    case 'privacy':
      return <ShieldCheck color={colors.secondary} size={iconSize.sm} />;
    case 'kvkk':
      return <FileText color={colors.purple} size={iconSize.sm} />;
    default:
      return <FileText color={colors.primary} size={iconSize.sm} />;
  }
}

export function AuthLegalSheet({
  documentId,
  visible,
  onClose,
}: AuthLegalSheetProps) {
  if (!documentId) {
    return null;
  }

  const document = getLegalDocument(documentId);

  return (
    <ModalScaffold
      accessibilityLabel={document.title}
      visible={visible}
      onClose={onClose}
      variant="dialog"
      scroll
      dismissOnBackdropPress
      footer={<PrimaryButton title={tr.common.close} onPress={onClose} />}
    >
      <SheetHeader
        leading={{ background: colors.primaryBg, icon: renderDocumentIcon(document.id) }}
        onClose={onClose}
        subtitle={document.summary}
        title={document.title}
      />

      <View style={styles.scrollContent}>
        {document.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <AppText accessibilityRole="header" style={styles.sectionTitle}>{section.title}</AppText>
            {section.body.map((paragraph) => (
              <AppText key={paragraph} style={styles.paragraph}>
                {paragraph}
              </AppText>
            ))}
          </View>
        ))}
      </View>
    </ModalScaffold>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: textStyle('compactTitleText', colors.text),
  paragraph: textStyle('readingBodyText', colors.textMuted),
});
