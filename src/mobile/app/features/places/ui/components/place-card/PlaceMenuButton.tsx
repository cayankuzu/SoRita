import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, ExternalLink, UtensilsCrossed } from 'lucide-react-native';

import { placeCardStyles as styles } from '@/mobile/app/features/places/ui/components/place-card/placeCardStyles';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { openSafeExternalUrl } from '@/mobile/app/shared/utils/safeLinks';

type PlaceMenuButtonProps = {
  menuUrl: string;
};

export function PlaceMenuButton({ menuUrl }: PlaceMenuButtonProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const longPressTriggeredRef = React.useRef(false);

  const openMenu = async () => {
    const opened = await openSafeExternalUrl(menuUrl);

    if (!opened) {
      showToast(tr.cards.menuLinkUnsafe, 'error');
    }
  };

  return (
    <Pressable
      accessibilityActions={[
        { name: 'longpress', label: tr.cards.menuLinkOpenHint },
      ]}
      accessibilityHint={
        isExpanded
          ? tr.cards.menuLinkExpandedHint
          : tr.cards.menuLinkCollapsedHint
      }
      accessibilityLabel={tr.cards.menuLinkLabel}
      accessibilityRole="link"
      accessibilityState={{ expanded: isExpanded }}
      delayLongPress={500}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'longpress') {
          void openMenu();
        }
      }}
      onPress={(event) => {
        event.stopPropagation();

        if (longPressTriggeredRef.current) {
          longPressTriggeredRef.current = false;
          return;
        }

        setIsExpanded((current) => !current);
      }}
      onPressIn={() => {
        longPressTriggeredRef.current = false;
      }}
      onLongPress={(event) => {
        event.stopPropagation();
        longPressTriggeredRef.current = true;
        void openMenu();
      }}
      style={({ pressed }) => [
        styles.menuAction,
        pressed ? styles.menuActionPressed : null,
      ]}
    >
      <View style={styles.menuActionHeader}>
        <View style={styles.menuActionIcon}>
          <UtensilsCrossed color={colors.primary} size={14} />
        </View>
        <Text style={styles.menuActionLabel}>{tr.cards.menuLinkLabel}</Text>
        {isExpanded ? (
          <ChevronUp color={colors.primary} size={14} />
        ) : (
          <ChevronDown color={colors.primary} size={14} />
        )}
      </View>
      {isExpanded ? (
        <View style={styles.menuUrlPreview}>
          <Text
            accessibilityLabel={tr.cards.menuLinkUrlLabel}
            ellipsizeMode="middle"
            numberOfLines={3}
            selectable
            style={styles.menuUrlText}
          >
            {menuUrl}
          </Text>
          <View style={styles.menuHoldHintRow}>
            <ExternalLink color={colors.textSoft} size={12} />
            <Text style={styles.menuHoldHintText}>{tr.cards.menuLinkHoldHint}</Text>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}
