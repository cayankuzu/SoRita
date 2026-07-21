import React from 'react';
import {
  StyleSheet,
  Text,
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
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type AuthLegalSheetProps = {
  documentId: LegalDocumentId | null;
  visible: boolean;
  onClose: () => void;
};

function renderDocumentIcon(documentId: LegalDocumentId) {
  switch (documentId) {
    case 'terms':
      return <Scale color={colors.primary} size={16} />;
    case 'community':
      return <Users color={colors.warning} size={16} />;
    case 'privacy':
      return <ShieldCheck color={colors.secondary} size={16} />;
    case 'kvkk':
      return <FileText color={colors.purple} size={16} />;
    default:
      return <FileText color={colors.primary} size={16} />;
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
            <Text accessibilityRole="header" style={styles.title}>{document.title}</Text>
            <Text style={styles.summary}>{document.summary}</Text>
          </View>
        </View>

        <IconButton accessibilityLabel={tr.common.close} onPress={onClose} variant="surface">
          <X color={colors.textMuted} size={14} />
        </IconButton>
      </View>

      <View style={styles.scrollContent}>
        {document.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.body.map((paragraph) => (
              <Text key={paragraph} style={styles.paragraph}>
                {paragraph}
              </Text>
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
    gap: 10,
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
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
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  summary: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSoft,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 4,
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  paragraph: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
