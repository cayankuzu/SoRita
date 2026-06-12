import type { ComponentType } from 'react';
import * as Sentry from '@sentry/react-native';

import { env } from '@/mobile/app/platform/config/env';

const sentryEnabled = Boolean(env.sentryDsn);
const isDevMode = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
type SentryRootComponent = ComponentType<Record<string, unknown>>;

export const sentryReactNavigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

Sentry.init({
  dsn: env.sentryDsn || undefined,
  enabled: sentryEnabled,
  debug: isDevMode && sentryEnabled,
  enableLogs: isDevMode,
  sendDefaultPii: false,
  tracesSampleRate: isDevMode ? 1.0 : 0.1,
  integrations: [sentryReactNavigationIntegration],
});

export function wrapWithSentry<TComponent extends ComponentType<object>>(Component: TComponent): TComponent {
  return sentryEnabled ? (Sentry.wrap(Component as SentryRootComponent) as unknown as TComponent) : Component;
}

export function registerSentryNavigationContainer(navigationContainerRef: unknown) {
  if (!sentryEnabled) {
    return;
  }

  sentryReactNavigationIntegration.registerNavigationContainer(navigationContainerRef);
}

export function captureAppException(error: unknown, extras?: Record<string, unknown>) {
  if (!sentryEnabled) {
    return;
  }

  Sentry.captureException(error, extras ? { extra: extras } : undefined);
}

export function captureAppMessage(
  message: string,
  params?: {
    extras?: Record<string, unknown>;
    level?: 'debug' | 'info' | 'warning' | 'error' | 'fatal' | 'log';
  },
) {
  if (!sentryEnabled) {
    return;
  }

  Sentry.captureMessage(message, {
    extra: params?.extras,
    level: params?.level,
  });
}
