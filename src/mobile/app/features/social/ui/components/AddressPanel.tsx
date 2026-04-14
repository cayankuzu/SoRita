import React from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, ExternalLink } from 'lucide-react-native';

import { buildExternalMapUrl } from '@/mobile/app/platform/config/maps';
import type { FeedActionLocation } from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type AddressPanelProps = {
  location: FeedActionLocation;
  onCopied?: () => void;
};

export function AddressPanel({ location, onCopied }: AddressPanelProps) {
  const copyAddress = async () => {
    const value = location.address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
    await Clipboard.setStringAsync(value);
    onCopied?.();
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{location.name}</Text>
      <Text style={styles.panelMuted}>
        {location.address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}
      </Text>
      <View style={styles.panelActions}>
        <Pressable style={styles.secondaryPanelButton} onPress={() => void copyAddress()}>
          <Copy color={colors.textMuted} size={14} />
          <Text style={styles.secondaryPanelText}>{tr.cards.copy}</Text>
        </Pressable>
        <Pressable
          style={styles.primaryPanelButton}
          onPress={() => Linking.openURL(buildExternalMapUrl(location.lat, location.lng))}
        >
          <ExternalLink color={colors.primary} size={14} />
          <Text style={styles.primaryPanelText}>{tr.cards.openInMaps}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  panelMuted: {
    fontSize: 12,
    color: colors.textSoft,
  },
  panelActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryPanelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
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
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryBg,
  },
  primaryPanelText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});
