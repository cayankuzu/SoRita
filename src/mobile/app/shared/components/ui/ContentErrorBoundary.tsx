import React from 'react';
import { StyleSheet, View } from 'react-native';

import { logger } from '@/mobile/app/platform/feedback/logger';
import { captureAppException } from '@/mobile/app/platform/observability/sentry';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, hitSlopFor, radius, spacing, textStyle } from '@/mobile/app/shared/theme/tokens';

/**
 * Keeps a crash inside one piece of content the size of that content.
 *
 * `AppErrorBoundary` sits at the root, so until now any render error anywhere
 * - including a single feed card fed a field shape the server changed - took
 * the whole app to its crash screen. A card that cannot render is a card-sized
 * problem. This catches it there, reports it with the surface named, and leaves
 * the rest of the list alone.
 *
 * Retry re-mounts the subtree, which recovers a transient failure and simply
 * fails again for genuinely malformed data. That is the honest behaviour: the
 * notice stays rather than pretending the content exists.
 */
type ContentErrorBoundaryProps = {
  children: React.ReactNode;
  /** Names the surface in logs and crash reports. */
  source: string;
};

type ContentErrorBoundaryState = {
  hasFailed: boolean;
  retryCount: number;
};

function ContentFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.fallback}>
      <AppText style={styles.message}>{tr.system.contentFailedDescription}</AppText>
      <InstantPressable
        accessibilityLabel={tr.system.contentFailedRetry}
        accessibilityRole="button"
        hitSlop={hitSlopFor(24)}
        onPress={onRetry}
        style={styles.retry}
      >
        <AppText style={styles.retryLabel}>{tr.system.contentFailedRetry}</AppText>
      </InstantPressable>
    </View>
  );
}

export class ContentErrorBoundary extends React.Component<
  ContentErrorBoundaryProps,
  ContentErrorBoundaryState
> {
  state: ContentErrorBoundaryState = {
    hasFailed: false,
    retryCount: 0,
  };

  static getDerivedStateFromError(): Partial<ContentErrorBoundaryState> {
    return { hasFailed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error('content-error-boundary', 'Content failed to render', {
      componentStack: info.componentStack,
      message: error.message,
      name: error.name,
      source: this.props.source,
    });
    captureAppException(error, {
      componentStack: info.componentStack,
      source: this.props.source,
    });
  }

  private handleRetry = () => {
    this.setState((current) => ({
      hasFailed: false,
      retryCount: current.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasFailed) {
      return <ContentFallback onRetry={this.handleRetry} />;
    }

    return (
      <React.Fragment key={this.state.retryCount}>{this.props.children}</React.Fragment>
    );
  }
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.card,
  },
  message: textStyle('captionText', colors.textMuted),
  retry: {
    minHeight: 24,
    justifyContent: 'center',
  },
  retryLabel: textStyle('captionText', colors.primary),
});
