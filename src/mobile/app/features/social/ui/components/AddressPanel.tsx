import React from 'react';
import { StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  ChevronRight,
  Copy,
} from 'lucide-react-native';

import type { FeedActionLocation } from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  controlSize,
  fontWeight,
  hitSlopFor,
  iconSize,
  opacity,
  radius,
  spacing,
  textStyle,
  typography,
} from '@/mobile/app/shared/theme/tokens';
import { openMapLocationInApp } from '@/mobile/app/shared/utils/mapLinks';

type AddressPanelProps = {
  location: FeedActionLocation;
  onCopied?: () => void;
};

export function AddressPanel({ location, onCopied }: AddressPanelProps) {
  const [isAddressExpanded, setIsAddressExpanded] = React.useState(false);
  const [isCopying, setIsCopying] = React.useState(false);
  const addressText = React.useMemo(
    () => location.address?.trim() || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
    [location.address, location.lat, location.lng],
  );

  React.useEffect(() => {
    setIsAddressExpanded(false);
    setIsCopying(false);
  }, [addressText, location.name]);

  const copyAddress = async () => {
    if (isCopying) {
      return;
    }

    setIsCopying(true);
    try {
      await Clipboard.setStringAsync(addressText);
      onCopied?.();
    } catch {
      showToast(tr.cards.copyAddressFailed, 'error');
    } finally {
      setIsCopying(false);
    }
  };

  const openInMaps = () => {
    void openMapLocationInApp({
      lat: location.lat,
      lng: location.lng,
      name: location.name,
      address: location.address,
    });
  };

  return (
    <View style={styles.panel}>
      <AppText accessibilityRole="header" style={styles.panelTitle}>{location.name}</AppText>
      <View style={styles.addressCard}>
        <InstantPressable
          hitSlop={hitSlopFor(controlSize.default)}
          accessibilityLabel={`${location.name}, ${addressText}`}
          accessibilityHint={tr.cards.openInMaps}
          accessibilityRole="link"
          onPress={openInMaps}
          style={styles.addressLinkButton}
        >
          <AppText style={styles.addressLabel}>{tr.placeEditor.addressLabel}</AppText>
          <AppText numberOfLines={isAddressExpanded ? undefined : 1} style={styles.addressLinkText}>
            {addressText}
          </AppText>
        </InstantPressable>
        <InstantPressable
          accessibilityRole="button"
          accessibilityLabel={
            isAddressExpanded
              ? `${tr.placeEditor.addressLabel}: ${tr.common.minimize}`
              : tr.cards.showAddressAction
          }
          accessibilityState={{ expanded: isAddressExpanded }}
          hitSlop={6}
          onPress={() => setIsAddressExpanded((current) => !current)}
          style={[
            styles.addressToggleButton,
            isAddressExpanded ? styles.addressToggleButtonExpanded : null,
          ]}
        >
          <View
            accessibilityElementsHidden
            style={isAddressExpanded ? styles.addressToggleIconExpanded : null}
          >
            <ChevronRight color={colors.primary} size={iconSize.sm} />
          </View>
        </InstantPressable>
      </View>
      <View style={styles.panelActions}>
        <InstantPressable
          hitSlop={hitSlopFor(controlSize.default)}
          accessibilityLabel={tr.cards.copy}
          accessibilityRole="button"
          accessibilityState={{ busy: isCopying, disabled: isCopying }}
          disabled={isCopying}
          style={[styles.secondaryPanelButton, isCopying ? styles.buttonDisabled : null]}
          onPress={() => void copyAddress()}
        >
          <Copy color={colors.textMuted} size={iconSize.xs} />
          <AppText style={styles.secondaryPanelText}>{tr.cards.copy}</AppText>
        </InstantPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  panelTitle: textStyle('bodyText', colors.text, fontWeight.strong),
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addressLinkButton: {
    flex: 1,
    minWidth: 0,
    minHeight: controlSize.default,
    gap: spacing.xs,
  },
  addressLabel: textStyle('metadataText', colors.textSoft, fontWeight.strong),
  addressLinkText: {
    ...typography.bodyText,
    color: colors.primary,
    textDecorationLine: 'underline',
    textDecorationColor: colors.primary,
  },
  addressToggleButton: {
    width: controlSize.default,
    height: controlSize.default,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  addressToggleButtonExpanded: {
    backgroundColor: colors.primaryBg,
  },
  addressToggleIconExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  panelActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryPanelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: controlSize.default,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  secondaryPanelText: textStyle('labelText', colors.textMuted),
  buttonDisabled: {
    opacity: opacity.disabled,
  },
});
