import React from 'react';
import { MapPin } from 'lucide-react-native';
import { Text, View } from 'react-native';

import type { Place, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { PlaceCard } from '@/mobile/app/features/places/public/components';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import type { MapMarkerItem } from '@/mobile/app/shared/utils/format';

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
  onRequestDeletePlace: (placeId: string) => void;
};

export function ListDetailPlacesSection({
  list,
  displayPlaces,
  mapPlaces,
  highlightedIndex,
  highlightedPlaceId,
  owner,
  isOwner,
  onHighlightPlace,
  onOpenOwnerProfile,
  onRequestDeletePlace,
}: ListDetailPlacesSectionProps) {
  return (
    <>
      {list.places.length > 0 ? (
        <View style={styles.mapSection}>
          <MiniMapPreview
            places={mapPlaces}
            height={200}
            interactive
            highlightedIndex={highlightedIndex}
            focusIndex={highlightedIndex}
            focusTrigger={highlightedIndex ?? 0}
            onMarkerPress={(index) => {
              const targetPlace = displayPlaces[index];
              onHighlightPlace(targetPlace?.id || null);
            }}
          />
          <Text style={styles.mapHelper}>{tr.listDetail.mapHelper}</Text>
        </View>
      ) : null}

      {list.description ? (
        <ExpandableText
          text={list.description}
          collapsedLines={3}
          textStyle={styles.description}
        />
      ) : null}

      {displayPlaces.length > 0 ? (
        <View style={styles.feed}>
          {displayPlaces.map((place) => (
            <View
              key={place.id}
              style={highlightedPlaceId === place.id ? styles.highlightedCard : null}
            >
              <PlaceCard
                place={place}
                owner={owner}
                ownerId={list.userId}
                listName={list.name}
                listEmoji={list.emoji}
                listIsPublic={list.isPublic}
                listCoverImage={list.coverImage}
                markerContext="list"
                onOwnerPress={owner ? onOpenOwnerProfile : undefined}
                onDelete={isOwner ? () => onRequestDeletePlace(place.id) : undefined}
              />
            </View>
          ))}
        </View>
      ) : (
        <EmptyState
          icon={<MapPin color={colors.textSoft} size={34} />}
          title={tr.listDetail.emptyTitle}
          description={tr.listDetail.emptyDescription}
        />
      )}
    </>
  );
}
