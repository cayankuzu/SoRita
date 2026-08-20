import React from 'react';
import { Text, View } from 'react-native';

import { AuthBrandFooter } from '@/mobile/app/features/auth/ui/components/AuthBrandFooter';
import { AuthLegalConsentCard } from '@/mobile/app/features/auth/ui/components/AuthLegalConsentCard';
import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { authScreenStyles as styles } from '@/mobile/app/features/auth/ui/components/authScreenStyles';
import type { LegalDocumentId } from '@/mobile/app/features/auth/ui/content/legalDocuments';
import { useAuthLayoutMode } from '@/mobile/app/features/auth/ui/components/useAuthLayoutMode';

type AuthLandingViewProps = {
  hasAcceptedLegal: boolean;
  onLoginPress: () => void;
  onOpenLegalDocument: (documentId: LegalDocumentId) => void;
  onRegisterPress: () => void;
  onToggleLegalConsent: () => void;
};

export function AuthLandingView({
  hasAcceptedLegal,
  onLoginPress,
  onOpenLegalDocument,
  onRegisterPress,
  onToggleLegalConsent,
}: AuthLandingViewProps) {
  const compact = useAuthLayoutMode();

  return (
    <Screen
      variant="form"
      contentContainerStyle={[
        styles.landingScreen,
        compact ? styles.landingScreenCompact : styles.landingScreenRegular,
      ]}
    >
      <View style={styles.landingContent}>
        <View style={styles.logoWrap}>
          <SoRitaLogo size={compact ? 'lg' : 'xl'} />
        </View>
        <Text style={styles.landingSubtitle}>{tr.auth.landing.subtitle}</Text>

        <AuthLegalConsentCard
          accepted={hasAcceptedLegal}
          onToggle={onToggleLegalConsent}
          onOpenDocument={onOpenLegalDocument}
        />

        <PrimaryButton
          title={tr.auth.landing.login}
          variant="secondary"
          onPress={onLoginPress}
        />
        <PrimaryButton
          title={tr.auth.landing.register}
          onPress={onRegisterPress}
          disabled={!hasAcceptedLegal}
        />

        <AuthBrandFooter />
      </View>
    </Screen>
  );
}
