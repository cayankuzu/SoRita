import React, { useEffect, useMemo, useState } from 'react';

import { PLACE_DIETARY_OPTIONS } from '@/mobile/app/catalog/placeOptions';
import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { openStackScreen, useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import type { Place, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { PlaceEditorModal } from '@/mobile/app/features/map/public/components';
import { usePlaceCardState } from '@/mobile/app/features/places/application/usePlaceCardState';
import { CompactPlaceCard } from '@/mobile/app/features/places/ui/components/place-card/CompactPlaceCard';
import { PlaceCardFull } from '@/mobile/app/features/places/ui/components/place-card/PlaceCardFull';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { useMiniMapInteraction } from '@/mobile/app/shared/components/maps/useMiniMapInteraction';
import { ImageLightbox } from '@/mobile/app/shared/components/feedback/ImageLightbox';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { getCreatedUpdatedLabels } from '@/mobile/app/shared/utils/dateTime';
import {
  formatPrice,
  getListMarkerColor,
} from '@/mobile/app/shared/utils/format';

type PlaceCardProps = {
  place: Place;
  owner?: User | null;
  ownerId?: string | null;
  listName?: string;
  listEmoji?: string;
  listIsPublic?: boolean;
  listCoverImage?: string;
  compact?: boolean;
  allowAddToList?: boolean;
  markerContext?: 'feed' | 'list';
  onPress?: () => void;
  onOwnerPress?: () => void;
  onDelete?: () => void;
  onRefresh?: () => void;
};

function PlaceCardComponent({
  place,
  owner,
  ownerId,
  listName,
  listEmoji,
  listIsPublic,
  listCoverImage,
  compact = false,
  allowAddToList = true,
  markerContext = 'feed',
  onPress,
  onOwnerPress,
  onDelete,
  onRefresh,
}: PlaceCardProps) {
  const navigation = useAppNavigation();
  const { user } = useAuth();
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [showAddToList, setShowAddToList] = useState(false);
  const [commentsActivated, setCommentsActivated] = useState(false);
  const photos = place.photos || [];
  const baseMarkerColor = getListMarkerColor(listIsPublic);
  const {
    activateMap,
    deactivateMap,
    isMapInteractive,
    mapFocusKey,
    showInteractionHint,
  } = useMiniMapInteraction(place.id);

  const categories = Array.from(
    new Set(place.categories?.length ? place.categories : place.category ? [place.category] : []),
  );
  const bestTimes = Array.from(
    new Set(place.bestTimes?.length ? place.bestTimes : place.bestTime ? [place.bestTime] : []),
  );
  const dietaryOptions = Array.from(
    new Set((place.specialFeatures || []).filter((item) => PLACE_DIETARY_OPTIONS.includes(item))),
  );
  const specialFeatures = Array.from(
    new Set((place.specialFeatures || []).filter((item) => !PLACE_DIETARY_OPTIONS.includes(item))),
  );
  const priceLabel = formatPrice(place);

  const mapMarkers = useMemo(
    () => [
      {
        lat: place.lat,
        lng: place.lng,
        name: place.name,
        markerColor: baseMarkerColor,
      },
    ],
    [baseMarkerColor, place.lat, place.lng, place.name],
  );

  const placeTimestampLabels = useMemo(
    () => getCreatedUpdatedLabels(place.addedAt, place.updatedAt || place.addedAt),
    [place.addedAt, place.updatedAt],
  );

  useEffect(() => {
    setCommentsActivated(false);
  }, [place.id]);

  const {
    canReportPlace,
    comments,
    createList,
    fetchNextCommentsPage,
    handleCreateComment,
    handleDeleteComment,
    handleLikePress,
    handleReportComment,
    handleReportPlace,
    handleToggleCommentLike,
    handleUpdateComment,
    hasNextCommentsPage,
    isFetchingNextCommentsPage,
    isLiked,
    likers,
    myLists,
    savePlaceToLists,
  } = usePlaceCardState({
    owner,
    ownerId,
    place,
    user,
    commentsEnabled: commentsActivated,
  });

  const openUserProfile = (targetUserId: string) => {
    if (!targetUserId) {
      return;
    }

    if (user && targetUserId === user.id) {
      navigation.navigate('MainTabs', { screen: 'Profile' });
      return;
    }

    openStackScreen(navigation, 'UserProfile', { userId: targetUserId });
  };

  if (compact) {
    return (
      <CompactPlaceCard
        mapMarkers={mapMarkers}
        photos={photos}
        place={place}
        placeTimestampLabels={placeTimestampLabels}
        onPress={onPress}
      />
    );
  }

  void markerContext;

  const focusMapPreview = () => {
    activateMap();
  };

  return (
    <>
      <PlaceCardFull
        allowAddToList={allowAddToList && Boolean(user)}
        bestTimes={bestTimes}
        canReportPlace={canReportPlace}
        categories={categories}
        comments={comments}
        currentUserName={user?.name}
        currentUserPhoto={user?.profilePhoto}
        dietaryOptions={dietaryOptions}
        isLiked={isLiked}
        isFetchingNextCommentsPage={isFetchingNextCommentsPage}
        likers={likers}
        listCoverImage={listCoverImage}
        listEmoji={listEmoji}
        listIsPublic={listIsPublic}
        listName={listName}
        isMapInteractive={isMapInteractive}
        mapFocusKey={mapFocusKey}
        mapMarkers={mapMarkers}
        showMapInteractionHint={showInteractionHint}
        onAddToListPress={() => setShowAddToList(true)}
        onAddressCopied={() => showToast(tr.cards.addressCopied, 'success')}
        onCommentDelete={handleDeleteComment}
        onCommentsLoadMore={async () => {
          await fetchNextCommentsPage?.();
        }}
        onCommentLikeToggle={handleToggleCommentLike}
        onCommentReport={handleReportComment}
        onCommentSubmit={handleCreateComment}
        onCommentUpdate={handleUpdateComment}
        onDelete={onDelete}
        onFocusPress={focusMapPreview}
        onFocusLongPress={deactivateMap}
        onLikePress={handleLikePress}
        onOwnerPress={onOwnerPress}
        onPhotoPress={setLightboxUri}
        onPress={onPress}
        onRefresh={onRefresh}
        onReportPlace={handleReportPlace}
        onUserPress={openUserProfile}
        onCommentsVisibilityChange={(visible) => {
          if (visible) {
            setCommentsActivated(true);
          }
        }}
        owner={owner}
        photos={photos}
        place={place}
        placeTimestampLabels={placeTimestampLabels}
        priceLabel={priceLabel}
        specialFeatures={specialFeatures}
        hasNextCommentsPage={hasNextCommentsPage}
      />

      {allowAddToList && user ? (
        <PlaceEditorModal
          visible={showAddToList}
          lat={place.lat}
          lng={place.lng}
          placeName={place.name}
          placeAddress={place.address}
          lists={myLists}
          onClose={() => setShowAddToList(false)}
          onSave={async (placeData, targetListIds) => {
            await savePlaceToLists(placeData, targetListIds);
            setShowAddToList(false);
          }}
          onCreateList={async (list) => {
            await createList(list);
          }}
        />
      ) : null}

      <ImageLightbox uri={lightboxUri} onClose={() => setLightboxUri(null)} />
    </>
  );
}

function arePlaceCardPropsEqual(previous: PlaceCardProps, next: PlaceCardProps) {
  return (
    previous.place === next.place &&
    previous.owner === next.owner &&
    previous.ownerId === next.ownerId &&
    previous.listName === next.listName &&
    previous.listEmoji === next.listEmoji &&
    previous.listIsPublic === next.listIsPublic &&
    previous.listCoverImage === next.listCoverImage &&
    previous.compact === next.compact &&
    previous.allowAddToList === next.allowAddToList &&
    previous.markerContext === next.markerContext
  );
}

export const PlaceCard = React.memo(PlaceCardComponent, arePlaceCardPropsEqual);
