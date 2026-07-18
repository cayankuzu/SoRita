import React from 'react';
import {
  Pressable,
  Text,
  View,
} from 'react-native';

import type { Place, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { tr } from '@/mobile/app/shared/i18n/tr';
import type { MapMarkerItem } from '@/mobile/app/shared/utils/markerColors';

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
        <Pressable style={styles.ownerCard} onPress={onOpenOwnerProfile}>
          <View style={styles.ownerAvatarWrap}>
            <AvatarView uri={owner.profilePhoto} name={owner.name} size={42} />
          </View>
          <View style={styles.ownerBody}>
            <Text style={styles.ownerEyebrow}>Liste sahibi</Text>
            <ExpandableText
              text={owner.name}
              collapsedLines={1}
              textStyle={styles.ownerName}
              showIndicator={false}
            />
            <Text numberOfLines={1} style={styles.ownerUsername}>
              @{owner.username}
            </Text>
          </View>
          <View style={styles.ownerBadge}>
            <Text style={styles.ownerBadgeText}>{isOwner ? 'Senin listen' : 'Profili ac'}</Text>
          </View>
        </Pressable>
      ) : null}

      {list.description ? (
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionCardLabel}>Liste aciklamasi</Text>
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
              <Text style={styles.mapCardEyebrow}>Harita</Text>
              <Text style={styles.mapCardTitle}>Mekan konumlari</Text>
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
          <Text style={styles.mapHelper}>{tr.listDetail.mapHelper}</Text>
        </View>
      ) : null}

      {displayPlaces.length > 0 ? (
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionEyebrow}>{tr.cards.placesCount(displayPlaces.length)}</Text>
            <Text style={styles.sectionTitle}>Mekanlar</Text>
            <Text style={styles.sectionSubtitle}>
              Haritadaki secili pinin karti burada vurgulanir.
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
