import React, { useMemo } from 'react';
import {
  Camera,
  Lock,
  Sparkles,
  User,
} from 'lucide-react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { useRootStackRoute } from '@/mobile/app/app-shell/navigation/navigation';
import { useAuthScreenState } from '@/mobile/app/features/auth/application/useAuthScreenState';
import { AuthForgotPasswordView } from '@/mobile/app/features/auth/ui/components/AuthForgotPasswordView';
import { AuthLandingView } from '@/mobile/app/features/auth/ui/components/AuthLandingView';
import { AuthLegalSheet } from '@/mobile/app/features/auth/ui/components/AuthLegalSheet';
import { AuthLoginView } from '@/mobile/app/features/auth/ui/components/AuthLoginView';
import { AuthRegisterFlow } from '@/mobile/app/features/auth/ui/components/AuthRegisterFlow';
import { useAndroidBackHandler } from '@/mobile/app/shared/hooks/useAndroidBackHandler';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

const registerStepCopy = tr.auth.register.steps;

export function AuthScreen() {
  const route = useRootStackRoute<'Auth'>();
  const { login, register, requestPasswordResetEmail, resendConfirmationEmail } = useAuth();
  const authState = useAuthScreenState({
    initialEmail: route.params?.email,
    initialView: route.params?.initialView,
    login,
    register,
    requestPasswordResetEmail,
    resendConfirmationEmail,
  });

  const steps = useMemo(
    () => [
      {
        ...registerStepCopy[0],
        icon: <User color={colors.primary} size={20} />,
      },
      {
        ...registerStepCopy[1],
        icon: <Lock color={colors.primary} size={20} />,
      },
      {
        ...registerStepCopy[2],
        icon: <Sparkles color={colors.primary} size={20} />,
      },
      {
        ...registerStepCopy[3],
        icon: <Camera color={colors.primary} size={20} />,
      },
    ],
    [],
  );

  useAndroidBackHandler(authState.view !== 'landing', () => {
    if (authState.view === 'register') {
      authState.handleRegisterBack();
      return true;
    }

    if (authState.view === 'forgotPassword') {
      authState.goToLogin();
      return true;
    }

    if (authState.view === 'login') {
      authState.goToLanding();
      return true;
    }

    return false;
  });

  if (authState.view === 'landing') {
    return (
      <>
        <AuthLandingView
          hasAcceptedLegal={authState.hasAcceptedLegal}
          onLoginPress={authState.goToLogin}
          onOpenLegalDocument={authState.openLegalDocument}
          onRegisterPress={authState.openRegister}
          onToggleLegalConsent={authState.toggleLegalConsent}
        />
        <AuthLegalSheet
          documentId={authState.activeLegalDocument}
          visible={Boolean(authState.activeLegalDocument)}
          onClose={authState.closeLegalDocument}
        />
      </>
    );
  }

  if (authState.view === 'login') {
    return (
      <>
        <AuthLoginView
          confirmationEmail={authState.confirmationEmail}
          loginEmail={authState.loginEmail}
          loginPassword={authState.loginPassword}
          onBack={authState.goToLanding}
          onChangeEmail={authState.setLoginEmail}
          onChangePassword={authState.setLoginPassword}
          onForgotPassword={authState.goToForgotPassword}
          onLogin={authState.handleLogin}
          onOpenRegister={authState.openRegister}
          onResendConfirmation={authState.handleResendConfirmation}
        />
        <AuthLegalSheet
          documentId={authState.activeLegalDocument}
          visible={Boolean(authState.activeLegalDocument)}
          onClose={authState.closeLegalDocument}
        />
      </>
    );
  }

  if (authState.view === 'forgotPassword') {
    return (
      <>
        <AuthForgotPasswordView
          email={authState.forgotPasswordEmail}
          onBack={authState.goToLogin}
          onChangeEmail={authState.setForgotPasswordEmail}
          onSubmit={authState.handleForgotPassword}
        />
        <AuthLegalSheet
          documentId={authState.activeLegalDocument}
          visible={Boolean(authState.activeLegalDocument)}
          onClose={authState.closeLegalDocument}
        />
      </>
    );
  }

  return (
    <>
      <AuthRegisterFlow
        clearCoverPhoto={authState.clearCoverPhoto}
        clearProfilePhoto={authState.clearProfilePhoto}
        coverPhoto={authState.coverPhoto}
        emailAvailabilityStatus={authState.emailAvailabilityStatus}
        emailHelper={authState.emailHelper}
        emailHelperTone={authState.emailHelperTone}
        goToLogin={authState.goToLogin}
        goToNextRegisterStep={authState.goToNextRegisterStep}
        goToPreviousRegisterStep={authState.goToPreviousRegisterStep}
        handleRegister={authState.handleRegister}
        handleRegisterBack={authState.handleRegisterBack}
        passwordHint={authState.passwordHint}
        passwordHintTone={authState.passwordHintTone}
        profilePhoto={authState.profilePhoto}
        registerFieldErrors={authState.registerFieldErrors}
        regBio={authState.regBio}
        regEmail={authState.regEmail}
        regInterests={authState.regInterests}
        regName={authState.regName}
        regPassword={authState.regPassword}
        regStep={authState.regStep}
        regUsername={authState.regUsername}
        selectCoverPhoto={authState.selectCoverPhoto}
        selectProfilePhoto={authState.selectProfilePhoto}
        setRegBio={authState.setRegBio}
        setRegEmail={authState.setRegEmail}
        setRegName={authState.setRegName}
        setRegPassword={authState.setRegPassword}
        steps={steps}
        toggleInterest={authState.toggleInterest}
        updateRegisterUsername={authState.updateRegisterUsername}
        usernameHelper={authState.usernameHelper}
        usernameAvailabilityStatus={authState.usernameAvailabilityStatus}
        usernameHelperTone={authState.usernameHelperTone}
      />
      <AuthLegalSheet
        documentId={authState.activeLegalDocument}
        visible={Boolean(authState.activeLegalDocument)}
        onClose={authState.closeLegalDocument}
      />
    </>
  );
}
