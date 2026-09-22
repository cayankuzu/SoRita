import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Globe, Layers3, Lock, X } from 'lucide-react-native';

import { env } from '@/mobile/app/platform/config/env';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize, radius, spacing, textStyle, typography } from '@/mobile/app/shared/theme/tokens';

type MapPriorityNoticeProps = {
  hasMapDataPartialError: boolean;
  locationErrorMessage: string | null;
  locationPermissionCanAskAgain: boolean;
  locationPermissionDenied: boolean;
  onRetryLists: () => void;
  onRetryLocation: () => void;
  onRetrySearch: () => void;
  searchErrorMessage: string | null;
  visibleDataErrorMessage: string | null;
};

export function MapPriorityNotice({
  hasMapDataPartialError,
  locationErrorMessage,
  locationPermissionCanAskAgain,
  locationPermissionDenied,
  onRetryLists,
  onRetryLocation,
  onRetrySearch,
  searchErrorMessage,
  visibleDataErrorMessage,
}: MapPriorityNoticeProps) {
  if (visibleDataErrorMessage) {
    return (
      <InlineNotice
        tone={hasMapDataPartialError ? 'warning' : 'danger'}
        title={hasMapDataPartialError ? tr.map.cachedDataTitle : tr.map.dataErrorTitle}
        description={visibleDataErrorMessage}
        actionLabel={tr.common.retry}
        onAction={onRetryLists}
      />
    );
  }

  if (searchErrorMessage) {
    return (
      <InlineNotice
        tone="warning"
        title={tr.map.searchUnavailableTitle}
        description={searchErrorMessage}
        actionLabel={tr.map.searchRetry}
        onAction={onRetrySearch}
      />
    );
  }

  if (locationErrorMessage) {
    const openSettings = locationPermissionDenied && !locationPermissionCanAskAgain;
    return (
      <InlineNotice
        tone={locationPermissionDenied ? 'warning' : 'danger'}
        title={
          locationPermissionDenied
            ? tr.map.locationPermissionRequired
            : tr.map.locationUnavailableTitle
        }
        description={locationErrorMessage}
        actionLabel={
          openSettings
            ? tr.map.openSettings
            : locationPermissionDenied
              ? tr.map.permissionRetry
              : tr.common.retry
        }
        onAction={() => {
          if (openSettings) {
            void Linking.openSettings();
            return;
          }
          onRetryLocation();
        }}
      />
    );
  }

  return env.isExpoGo ? (
    <InlineNotice
      tone="warning"
      title={tr.system.expoGoMapLimitationTitle}
      description={tr.system.expoGoMapLimitationDescription}
    />
  ) : null;
}

export function MapVisibilityLegend({ bottom }: { bottom: number }) {
  return (
    <View accessibilityLabel={tr.map.filterTitle} style={[styles.legend, { bottom }]}>
      <View style={styles.legendItem}>
        <Globe color={colors.visibilityPublic} size={iconSize.xs} />
        <AppText style={styles.legendText}>{tr.map.filterPublic}</AppText>
      </View>
      <View style={styles.legendItem}>
        <Lock color={colors.visibilityPrivate} size={iconSize.xs} />
        <AppText style={styles.legendText}>{tr.map.filterPrivate}</AppText>
      </View>
      <View style={styles.legendItem}>
        <Layers3 color={colors.visibilityMixed} size={iconSize.xs} />
        <AppText style={styles.legendText}>{tr.map.filterMixed}</AppText>
      </View>
    </View>
  );
}

export function MapAddHint({ bottom, onClose }: { bottom: number; onClose: () => void }) {
  return (
    <View style={[styles.addHint, { bottom }]}>
      <AppText style={styles.addHintText}>{tr.map.addPlaceHint}</AppText>
      <IconButton
        accessibilityLabel={tr.common.close}
        onPress={onClose}
        size="sm"
        style={styles.addHintClose}
        variant="inverse"
      >
        <X color={colors.onPrimary} size={iconSize.sm} />
      </IconButton>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    position: 'absolute',
    right: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.glassSurface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendText: textStyle('metadataText', colors.textMuted),
  addHint: {
    position: 'absolute',
    left: 12,
    right: 60,
    minHeight: 44,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.text,
  },
  addHintText: {
    flex: 1,
    ...typography.captionText,
    color: colors.onPrimary,
  },
  addHintClose: {
    marginVertical: -8,
    marginRight: -8,
  },
});
