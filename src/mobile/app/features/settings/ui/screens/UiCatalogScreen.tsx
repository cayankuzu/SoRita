import { CircleSlash2 } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import { SettingsHeader } from '@/mobile/app/features/settings/ui/components/SettingsHeader';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { PlaceCardSkeleton } from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  contentWidth,
  iconSize,
  radius,
  spacing,
  textStyle,
} from '@/mobile/app/shared/theme/tokens';

function CatalogSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.section}>
      <AppText accessibilityRole="header" style={styles.sectionTitle}>{title}</AppText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export function UiCatalogScreen() {
  const navigation = useAppNavigation();
  const [fieldValue, setFieldValue] = React.useState('SoRita');
  const [showModal, setShowModal] = React.useState(false);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <SettingsHeader title={tr.uiCatalog.title} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <CatalogSection title={tr.uiCatalog.typography}>
          <AppText style={styles.displayText}>{tr.brand.first}{tr.brand.second}</AppText>
          <AppText style={styles.titleText}>{tr.uiCatalog.screenTitleSample}</AppText>
          <AppText style={styles.sectionText}>{tr.uiCatalog.sectionTitleSample}</AppText>
          <AppText style={styles.bodyText}>{tr.uiCatalog.bodySample}</AppText>
          <AppText style={styles.metadataText}>{tr.uiCatalog.metadataSample}</AppText>
        </CatalogSection>

        <CatalogSection title={tr.uiCatalog.buttons}>
          <PrimaryButton title={tr.uiCatalog.primary} onPress={() => undefined} />
          <PrimaryButton title={tr.uiCatalog.secondary} onPress={() => undefined} variant="secondary" />
          <PrimaryButton title={tr.uiCatalog.danger} onPress={() => undefined} variant="danger" />
          <PrimaryButton title={tr.uiCatalog.success} onPress={() => undefined} variant="success" />
          <PrimaryButton title={tr.uiCatalog.loading} loading onPress={() => undefined} />
          <PrimaryButton title={tr.uiCatalog.disabled} disabled onPress={() => undefined} />
        </CatalogSection>

        <CatalogSection title={tr.uiCatalog.fields}>
          <TextField label={tr.uiCatalog.defaultField} placeholder={tr.uiCatalog.valuePlaceholder} />
          <TextField
            label={tr.uiCatalog.filledField}
            maxLength={8}
            onChangeText={setFieldValue}
            status="success"
            helper={tr.uiCatalog.successHelper}
            value={fieldValue}
          />
          <TextField
            editable={false}
            label={tr.uiCatalog.disabled}
            value={tr.uiCatalog.disabled}
          />
        </CatalogSection>

        <CatalogSection title={tr.uiCatalog.notices}>
          <InlineNotice title={tr.uiCatalog.infoTitle} description={tr.uiCatalog.infoDescription} />
          <InlineNotice title={tr.uiCatalog.warningTitle} description={tr.uiCatalog.warningDescription} tone="warning" />
          <InlineNotice title={tr.uiCatalog.errorTitle} description={tr.uiCatalog.errorDescription} tone="danger" />
          <PrimaryButton
            title={tr.uiCatalog.showToast}
            onPress={() => showToast(tr.uiCatalog.successHelper, 'success')}
            variant="secondary"
          />
          <PrimaryButton
            title={tr.uiCatalog.openModal}
            onPress={() => setShowModal(true)}
            variant="secondary"
          />
        </CatalogSection>

        <CatalogSection title={tr.uiCatalog.skeleton}>
          <PlaceCardSkeleton />
        </CatalogSection>

        <EmptyState
          actionLabel={tr.common.retry}
          description={tr.uiCatalog.emptyDescription}
          icon={<CircleSlash2 color={colors.primary} size={iconSize.lg} />}
          onAction={() => undefined}
          secondaryActionLabel={tr.common.clear}
          onSecondaryAction={() => undefined}
          title={tr.uiCatalog.emptyTitle}
          tone="info"
        />
      </ScrollView>

      <ConfirmActionModal
        confirmLabel={tr.common.continue}
        description={tr.uiCatalog.modalDescription}
        onClose={() => setShowModal(false)}
        onConfirm={() => showToast(tr.uiCatalog.successHelper, 'success')}
        title={tr.uiCatalog.modalTitle}
        visible={showModal}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
    paddingHorizontal: spacing.screen,
  },
  content: {
    alignSelf: 'center',
    gap: spacing.xl,
    maxWidth: contentWidth.settings,
    paddingBottom: spacing['2xl'],
    width: '100%',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: textStyle('section', colors.text),
  sectionBody: {
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  displayText: textStyle('display', colors.text),
  titleText: textStyle('title', colors.text),
  sectionText: textStyle('section', colors.text),
  bodyText: textStyle('bodyText', colors.textMuted),
  metadataText: textStyle('metadataText', colors.textSoft),
});
