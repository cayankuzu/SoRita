import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  ChevronRight,
  Copy,
  ExternalLink,
} from 'lucide-react-native';

import type { FeedActionLocation } from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius, touch, typography } from '@/mobile/app/shared/theme/tokens';
import { openMapLocationInApp } from '@/mobile/app/shared/utils/mapLinks';

type AddressPanelProps = {
  location: FeedActionLocation;
  onCopied?: () => void;
};

export function AddressPanel({ location, onCopied }: AddressPanelProps) {
  const [isAddressExpanded, setIsAddressExpanded] = React.useState(false);
  const addressText = React.useMemo(
    () => location.address?.trim() || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
    [location.address, location.lat, location.lng],
  );

  React.useEffect(() => {
    setIsAddressExpanded(false);
  }, [addressText, location.name]);

  const copyAddress = async () => {
    await Clipboard.setStringAsync(addressText);
    onCopied?.();
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
      <Text style={styles.panelTitle}>{location.name}</Text>
      <View style={styles.addressCard}>
        <Pressable
          accessibilityLabel={`${location.name}, ${addressText}`}
          accessibilityRole="link"
          onPress={openInMaps}
          style={styles.addressLinkButton}
        >
          <Text style={styles.addressLabel}>{tr.placeEditor.addressLabel}</Text>
          <Text numberOfLines={isAddressExpanded ? undefined : 1} style={styles.addressLinkText}>
            {addressText}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.cards.showAddressAction}
          accessibilityState={{ expanded: isAddressExpanded }}
          hitSlop={6}
          onPress={() => setIsAddressExpanded((current) => !current)}
          style={[
            styles.addressToggleButton,
            isAddressExpanded ? styles.addressToggleButtonExpanded : null,
          ]}
        >
          <ChevronRight color={colors.primary} size={14} />
        </Pressable>
      </View>
      <View style={styles.panelActions}>
        <Pressable
          accessibilityRole="button"
          style={styles.secondaryPanelButton}
          onPress={() => void copyAddress()}
        >
          <Copy color={colors.textMuted} size={12} />
          <Text style={styles.secondaryPanelText}>{tr.cards.copy}</Text>
        </Pressable>
        <Pressable accessibilityRole="link" style={styles.primaryPanelButton} onPress={openInMaps}>
          <ExternalLink color={colors.primary} size={12} />
          <Text style={styles.primaryPanelText}>{tr.cards.openInMaps}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addressLinkButton: {
    flex: 1,
    minWidth: 0,
    minHeight: Platform.OS === 'ios' ? touch.ios : touch.android,
    gap: 4,
  },
  addressLabel: {
    ...typography.metadataText,
    fontWeight: '700',
    color: colors.textSoft,
  },
  addressLinkText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.primary,
    textDecorationLine: 'underline',
    textDecorationColor: colors.primary,
  },
  addressToggleButton: {
    width: Platform.OS === 'ios' ? touch.ios : touch.android,
    height: Platform.OS === 'ios' ? touch.ios : touch.android,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  addressToggleButtonExpanded: {
    backgroundColor: colors.primaryBg,
    transform: [{ rotate: '90deg' }],
  },
  panelActions: {
    flexDirection: 'row',
    gap: 6,
  },
  secondaryPanelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: Platform.OS === 'ios' ? touch.ios : touch.android,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  secondaryPanelText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  primaryPanelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: Platform.OS === 'ios' ? touch.ios : touch.android,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryBg,
  },
  primaryPanelText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});
