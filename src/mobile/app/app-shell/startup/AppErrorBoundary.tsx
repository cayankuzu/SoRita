import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { captureAppException } from '@/mobile/app/platform/observability/sentry';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  fontWeight,
  radius,
  typography,
} from '@/mobile/app/shared/theme/tokens';

const isDevMode = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

type AppErrorBoundaryProps = {
  children: React.ReactNode;
  onReset?: () => void;
};

type AppErrorBoundaryState = {
  error: Error | null;
  retryCount: number;
};

function AppCrashFallback({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry: () => void;
}) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <AppText accessibilityRole="header" style={styles.title}>{tr.system.crashTitle}</AppText>
          <AppText accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.description}>
            {tr.system.crashDescription}
          </AppText>
          {isDevMode && error?.message ? (
            <View style={styles.debugBox}>
              <AppText style={styles.debugLabel}>{tr.system.developmentMessage}</AppText>
              <AppText style={styles.debugMessage}>{error.message}</AppText>
            </View>
          ) : null}
          <PrimaryButton title={tr.system.crashRetry} onPress={onRetry} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    error: null,
    retryCount: 0,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      error,
      retryCount: 0,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error('app-error-boundary', 'Unhandled render error', {
      componentStack: info.componentStack,
      message: error.message,
      name: error.name,
    });
    captureAppException(error, {
      componentStack: info.componentStack,
      source: 'AppErrorBoundary',
    });
  }

  private handleRetry = () => {
    this.props.onReset?.();
    this.setState((currentState) => ({
      error: null,
      retryCount: currentState.retryCount + 1,
    }));
  };

  render() {
    if (this.state.error) {
      return <AppCrashFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return <React.Fragment key={this.state.retryCount}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 396,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: typography.dialogTitleText.fontSize,
    fontWeight: fontWeight.strong,
    color: colors.text,
  },
  description: {
    ...typography.bodyText,
    color: colors.textMuted,
  },
  debugBox: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: 10,
    gap: 4,
  },
  debugLabel: {
    fontSize: typography.labelText.fontSize,
    fontWeight: fontWeight.strong,
    color: colors.textSoft,
  },
  debugMessage: {
    ...typography.captionText,
    fontWeight: fontWeight.regular,
    color: colors.text,
  },
});
