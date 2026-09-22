import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import {
  FileText,
  Scale,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react-native';

import {
  getLegalDocument,
  type LegalDocumentId,
} from '@/mobile/app/features/auth/ui/content/legalDocuments';
import { ModalScaffold } from '@/mobile/app/shared/components/feedback/ModalScaffold';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize, radius, spacing, textStyle } from '@/mobile/app/shared/theme/tokens';

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
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.iconWrap}>{renderDocumentIcon(document.id)}</View>
          <View style={styles.headerCopy}>
            <AppText accessibilityRole="header" style={styles.title}>{document.title}</AppText>
            <AppText style={styles.summary}>{document.summary}</AppText>
          </View>
        </View>

        <IconButton accessibilityLabel={tr.common.close} onPress={onClose} variant="surface">
          <X color={colors.textMuted} size={iconSize.sm} />
        </IconButton>
      </View>

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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  title: textStyle('compactTitleText', colors.text),
  summary: textStyle('bodyText', colors.textSoft),
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
