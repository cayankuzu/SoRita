import React from 'react';
import {
  Modal,
  ScrollView,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getLegalDocument,
  type LegalDocumentId,
} from '@/mobile/app/features/auth/ui/content/legalDocuments';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type AuthLegalSheetProps = {
  documentId: LegalDocumentId | null;
  visible: boolean;
  onClose: () => void;
};

function renderDocumentIcon(documentId: LegalDocumentId) {
  switch (documentId) {
    case 'terms':
      return <Scale color={colors.primary} size={18} />;
    case 'community':
      return <Users color={colors.warning} size={18} />;
    case 'privacy':
      return <ShieldCheck color={colors.secondary} size={18} />;
    case 'kvkk':
      return <FileText color={colors.purple} size={18} />;
    default:
      return <FileText color={colors.primary} size={18} />;
  }
}

export function AuthLegalSheet({
  documentId,
  visible,
  onClose,
}: AuthLegalSheetProps) {
  const insets = useSafeAreaInsets();

  if (!documentId) {
    return null;
  }

  const document = getLegalDocument(documentId);
  const bottomInset = Math.max(insets.bottom, 16);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <View style={[styles.overlay, { paddingTop: insets.top + 12, paddingBottom: bottomInset }]}>
        <InstantPressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconWrap}>{renderDocumentIcon(document.id)}</View>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>{document.title}</Text>
                <Text style={styles.summary}>{document.summary}</Text>
              </View>
            </View>

            <InstantPressable onPress={onClose} style={styles.closeButton}>
              <X color={colors.textSoft} size={16} />
            </InstantPressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
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
          </ScrollView>

          <PrimaryButton title="Kapat" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: colors.overlay,
  },
  sheet: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    maxHeight: '88%',
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
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
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  summary: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSoft,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 4,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
});
