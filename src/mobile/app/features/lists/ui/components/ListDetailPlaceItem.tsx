import React from 'react';
import { Text, View } from 'react-native';

import type { Place, User } from '@/mobile/app/data/contracts/entities';
import { PlaceCard } from '@/mobile/app/features/places/public/components';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { getMarkerAggregationKey, type LocationPlaceStat } from '@/mobile/app/shared/utils/format';

import { listDetailScreenStyles as styles } from './listDetailScreenStyles';

type ListDetailPlaceItemProps = {
  highlighted: boolean;
  isOwner: boolean;
  listCoverImage?: string;
  listEmoji?: string;
  listId: string;
  listIsPublic: boolean;
  listName: string;
  locationStatsByKey: Map<string, LocationPlaceStat>;
  markerColor?: string;
  onDeletePlace: (placeId: string) => void;
  onEditPlace: (place: Place) => void;
  onOpenOwnerProfile?: () => void;
  owner: User | null;
  ownerId: string;
  place: Place;
};

export function ListDetailPlaceItem({
  highlighted,
  isOwner,
  listCoverImage,
  listEmoji,
  listId,
  listIsPublic,
  listName,
  locationStatsByKey,
  markerColor,
  onDeletePlace,
  onEditPlace,
  onOpenOwnerProfile,
  owner,
  ownerId,
  place,
}: ListDetailPlaceItemProps) {
  const locationStats = locationStatsByKey.get(getMarkerAggregationKey(place));

  return (
    <View
      accessibilityLabel={highlighted ? tr.listDetail.mapSelectedPlace : undefined}
      accessibilityState={highlighted ? { selected: true } : undefined}
      style={[
        styles.placeCardShell,
        highlighted ? styles.placeCardShellHighlighted : null,
      ]}
    >
      {highlighted ? (
        <View style={styles.highlightPill}>
          <Text style={styles.highlightPillText}>{tr.listDetail.mapSelectedPlace}</Text>
        </View>
      ) : null}

      <PlaceCard
        context="list-detail"
        place={place}
        owner={owner}
        ownerId={ownerId}
        listId={listId}
        listName={listName}
        listEmoji={listEmoji}
        listIsPublic={listIsPublic}
        listCoverImage={listCoverImage}
        locationPlaceCardsCount={locationStats?.count}
        locationOriginalPlaceName={locationStats?.originalPlaceName}
        markerColor={markerColor}
        onEdit={isOwner ? () => onEditPlace(place) : undefined}
        onOwnerPress={onOpenOwnerProfile}
        onDelete={isOwner ? () => onDeletePlace(place.id) : undefined}
      />
    </View>
  );
}
