import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { Place, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { MiniMapInteractionHint } from '@/mobile/app/shared/components/maps/MiniMapInteractionHint';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import { useMiniMapInteraction } from '@/mobile/app/shared/components/maps/useMiniMapInteraction';
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
  // The map starts still, so a swipe over it scrolls the page; a tap wakes
  // it for panning and zooming, and Bitti puts it back.
  const {
    activateMap,
    deactivateMap,
    isMapInteractive,
    mapFocusKey,
    showInteractionHint,
  } = useMiniMapInteraction(`list-detail:${list.id}`);

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
            <AvatarView uri={owner.profilePhoto} name={owner.name} size={avatarSize.md} />
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
              interactive={isMapInteractive}
              instanceId={mapFocusKey}
              highlightedIndex={highlightedIndex}
              focusIndex={highlightedIndex}
              focusTrigger={highlightedIndex ?? 0}
              onMarkerPress={(index) => {
                const targetPlace = displayPlaces[index];
                onHighlightPlace(targetPlace?.id || null);
              }}
            />
            {isMapInteractive ? (
              <>
                <MiniMapInteractionHint visible={showInteractionHint} />
                <InstantPressable
                  accessibilityLabel={tr.listDetail.mapDone}
                  accessibilityRole="button"
                  onPress={deactivateMap}
                  style={styles.mapDoneButton}
                >
                  <AppText style={styles.mapDoneLabel}>{tr.listDetail.mapDone}</AppText>
                </InstantPressable>
              </>
            ) : (
              <InstantPressable
                accessibilityHint={tr.listDetail.mapActivateHint}
                accessibilityLabel={tr.listDetail.mapPlacesTitle}
                accessibilityRole="button"
                disableFeedback
                onPress={activateMap}
                style={StyleSheet.absoluteFill}
              />
            )}
          </View>
          <AppText style={styles.mapHelper}>
            {isMapInteractive ? tr.listDetail.mapHelper : tr.listDetail.mapActivateHint}
          </AppText>
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
