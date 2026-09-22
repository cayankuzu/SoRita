import React from 'react';
import { Pressable, View } from 'react-native';
import { ExternalLink, UtensilsCrossed } from 'lucide-react-native';

import { placeCardStyles as styles } from '@/mobile/app/features/places/ui/components/place-card/placeCardStyles';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize } from '@/mobile/app/shared/theme/tokens';
import { openSafeExternalUrl } from '@/mobile/app/shared/utils/safeLinks';

type PlaceMenuButtonProps = {
  menuUrl: string;
};

export function PlaceMenuButton({ menuUrl }: PlaceMenuButtonProps) {
  const openingRef = React.useRef(false);
  const [isOpening, setIsOpening] = React.useState(false);

  const openMenu = async () => {
    if (openingRef.current) {
      return;
    }

    openingRef.current = true;
    setIsOpening(true);

    try {
      const opened = await openSafeExternalUrl(menuUrl);

      if (!opened) {
        showToast(tr.cards.menuLinkUnsafe, 'error');
      }
    } finally {
      openingRef.current = false;
      setIsOpening(false);
    }
  };

  return (
    <Pressable
      accessibilityHint={tr.cards.menuLinkOpenHint}
      accessibilityLabel={tr.cards.menuLinkLabel}
      accessibilityRole="link"
      accessibilityState={{ busy: isOpening, disabled: isOpening }}
      disabled={isOpening}
      hitSlop={4}
      onPress={(event) => {
        event.stopPropagation();
        void openMenu();
      }}
      style={({ pressed }) => [
        styles.menuAction,
        pressed ? styles.menuActionPressed : null,
      ]}
    >
      <View style={styles.menuActionHeader}>
        <View style={styles.menuActionIcon}>
          <UtensilsCrossed color={colors.primary} size={iconSize.xs} />
        </View>
        <AppText style={styles.menuActionLabel}>{tr.cards.menuLinkLabel}</AppText>
        <ExternalLink color={colors.primary} size={iconSize.xs} />
      </View>
    </Pressable>
  );
}
