import type { ComponentType } from 'react';
import * as Sentry from '@sentry/react-native';

import { env } from '@/mobile/app/platform/config/env';

const sentryEnabled = Boolean(env.sentryDsn);
const isDevMode = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
const sentryTracingEnabled = sentryEnabled && !isDevMode;
type SentryRootComponent = ComponentType<Record<string, unknown>>;

export const sentryReactNavigationIntegration = sentryTracingEnabled
  ? Sentry.reactNavigationIntegration({
      enableTimeToInitialDisplay: true,
    })
  : null;

Sentry.init({
  dsn: env.sentryDsn || undefined,
  enabled: sentryEnabled,
  debug: false,
  enableLogs: false,
  sendDefaultPii: false,
  tracesSampleRate: sentryTracingEnabled ? 0.1 : 0,
  integrations: sentryReactNavigationIntegration ? [sentryReactNavigationIntegration] : [],
});

export function wrapWithSentry<TComponent extends ComponentType<object>>(Component: TComponent): TComponent {
  return sentryEnabled ? (Sentry.wrap(Component as SentryRootComponent) as unknown as TComponent) : Component;
}

export function registerSentryNavigationContainer(navigationContainerRef: unknown) {
  if (!sentryEnabled || !sentryReactNavigationIntegration) {
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
