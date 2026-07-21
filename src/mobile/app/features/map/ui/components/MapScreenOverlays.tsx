import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Globe, Layers3, Lock, X } from 'lucide-react-native';

import { env } from '@/mobile/app/platform/config/env';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';

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
        <Globe color={colors.visibilityPublic} size={12} />
        <Text style={styles.legendText}>{tr.map.filterPublic}</Text>
      </View>
      <View style={styles.legendItem}>
        <Lock color={colors.visibilityPrivate} size={12} />
        <Text style={styles.legendText}>{tr.map.filterPrivate}</Text>
      </View>
      <View style={styles.legendItem}>
        <Layers3 color={colors.visibilityMixed} size={12} />
        <Text style={styles.legendText}>{tr.map.filterMixed}</Text>
      </View>
    </View>
  );
}

export function MapAddHint({ bottom, onClose }: { bottom: number; onClose: () => void }) {
  return (
    <View style={[styles.addHint, { bottom }]}>
      <Text style={styles.addHintText}>{tr.map.addPlaceHint}</Text>
      <InstantPressable
        accessibilityLabel={tr.common.close}
        accessibilityRole="button"
        onPress={onClose}
      >
        <X color={colors.onPrimary} size={14} />
      </InstantPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    position: 'absolute',
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.glassSurface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendText: {
    ...typography.metadataText,
    color: colors.textMuted,
  },
  addHint: {
    position: 'absolute',
    left: 12,
    right: 60,
    minHeight: 44,
    borderRadius: radius.lg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.text,
  },
  addHintText: {
    flex: 1,
    ...typography.captionText,
    color: colors.onPrimary,
  },
});
