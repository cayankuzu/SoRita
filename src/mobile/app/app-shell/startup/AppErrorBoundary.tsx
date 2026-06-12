import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { captureAppException } from '@/mobile/app/platform/observability/sentry';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

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
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Bir seyler ters gitti</Text>
          <Text style={styles.description}>
            Uygulama beklenmeyen bir hatayla karsilasti. Yeniden deneyerek akisa geri donebilirsin.
          </Text>
          {isDevMode && error?.message ? (
            <View style={styles.debugBox}>
              <Text style={styles.debugLabel}>Gelistirme mesaji</Text>
              <Text style={styles.debugMessage}>{error.message}</Text>
            </View>
          ) : null}
          <PrimaryButton title="Yeniden dene" onPress={onRetry} />
        </View>
      </View>
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
    gap: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textMuted,
  },
  debugBox: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: 12,
    gap: 6,
  },
  debugLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSoft,
  },
  debugMessage: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text,
  },
});
