import React from 'react';
import { View } from 'react-native';

import type { Place, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { Badge } from '@/mobile/app/shared/components/ui/Badge';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import type { MapMarkerItem } from '@/mobile/app/shared/utils/markerColors';
import { avatarSize } from '@/mobile/app/shared/theme/tokens';

import { listDetailScreenStyles as styles } from './listDetailScreenStyles';

type ListDetailPlacesSectionProps = {
  list: PlaceList;
  displayPlaces: Place[];
  mapPlaces: MapMarkerItem[];
  highlightedIndex: number | null;
  highlightedPlaceId: string | null;
  owner: User | null;
  isOwner: boolean;
  onHighlightPlace: (placeId: string | null) => void;
  onOpenOwnerProfile: () => void;
};

export function ListDetailPlacesSection({
  list,
  displayPlaces,
  mapPlaces,
  highlightedIndex,
  owner,
  isOwner,
  onHighlightPlace,
  onOpenOwnerProfile,
}: ListDetailPlacesSectionProps) {
  return (
    <View style={styles.sectionStack}>
      {owner ? (
        <InstantPressable
          accessibilityLabel={`${owner.name}, @${owner.username}`}
          accessibilityHint={tr.listDetail.openOwnerProfile}
          accessibilityRole="button"
          style={styles.ownerCard}
          onPress={onOpenOwnerProfile}
        >
          <View style={styles.ownerAvatarWrap}>
            <AvatarView uri={owner.profilePhoto} name={owner.name} size={avatarSize.sm} />
          </View>
          <View style={styles.ownerBody}>
            <AppText style={styles.ownerEyebrow}>{tr.listDetail.ownerLabel}</AppText>
            <ExpandableText
              text={owner.name}
              collapsedLines={1}
              textStyle={styles.ownerName}
              showIndicator={false}
            />
            <AppText numberOfLines={1} style={styles.ownerUsername}>
              @{owner.username}
            </AppText>
          </View>
          <Badge
            label={isOwner ? tr.listDetail.ownedByViewer : tr.listDetail.openOwnerProfile}
            tone="primary"
          />
        </InstantPressable>
      ) : null}

      {list.description ? (
        <View style={styles.descriptionCard}>
          <AppText style={styles.descriptionCardLabel}>{tr.listDetail.descriptionLabel}</AppText>
          <ExpandableText
            text={list.description}
            collapsedLines={4}
            textStyle={styles.description}
          />
        </View>
      ) : null}

      {displayPlaces.length > 0 ? (
        <View style={styles.mapSection}>
          <View style={styles.mapCardHeader}>
            <View>
              <AppText style={styles.mapCardEyebrow}>{tr.cards.map}</AppText>
              <AppText accessibilityRole="header" style={styles.mapCardTitle}>{tr.listDetail.mapPlacesTitle}</AppText>
            </View>
          </View>

          <View style={styles.mapFrame}>
            <MiniMapPreview
              places={mapPlaces}
              height={192}
              interactive
              highlightedIndex={highlightedIndex}
              focusIndex={highlightedIndex}
              focusTrigger={highlightedIndex ?? 0}
              onMarkerPress={(index) => {
                const targetPlace = displayPlaces[index];
                onHighlightPlace(targetPlace?.id || null);
              }}
            />
          </View>
          <AppText style={styles.mapHelper}>{tr.listDetail.mapHelper}</AppText>
        </View>
      ) : null}

      {displayPlaces.length > 0 ? (
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <AppText style={styles.sectionEyebrow}>{tr.cards.placesCount(displayPlaces.length)}</AppText>
            <AppText accessibilityRole="header" style={styles.sectionTitle}>{tr.listDetail.placesSectionTitle}</AppText>
            <AppText style={styles.sectionSubtitle}>{tr.listDetail.selectedPinHint}</AppText>
          </View>
        </View>
      ) : null}
    </View>
  );
}
