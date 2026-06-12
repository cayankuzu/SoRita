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
  return (
    <Screen contentContainerStyle={styles.landingScreen}>
      <View style={styles.landingContent}>
        <View style={styles.logoWrap}>
          <SoRitaLogo size="xl" />
        </View>
        <Text style={styles.landingSubtitle}>{tr.auth.landing.subtitle}</Text>

        <PrimaryButton
          title={tr.auth.landing.login}
          variant="secondary"
          onPress={onLoginPress}
          disabled={!hasAcceptedLegal}
        />
        <PrimaryButton
          title={tr.auth.landing.register}
          onPress={onRegisterPress}
          disabled={!hasAcceptedLegal}
        />

        <AuthLegalConsentCard
          accepted={hasAcceptedLegal}
          onToggle={onToggleLegalConsent}
          onOpenDocument={onOpenLegalDocument}
        />

        <AuthBrandFooter />
      </View>
    </Screen>
  );
}
