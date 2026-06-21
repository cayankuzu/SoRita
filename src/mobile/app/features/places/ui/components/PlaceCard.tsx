import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PLACE_DIETARY_OPTIONS } from '@/mobile/app/catalog/placeOptions';
import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { openStackScreen, useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import type { Place, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import type { PlaceEditorDraft } from '@/mobile/app/features/map/application/placeEditorDraft';
import { PlaceEditorModal } from '@/mobile/app/features/map/public/components';
import { usePlaceCardState } from '@/mobile/app/features/places/application/usePlaceCardState';
import { CompactPlaceCard } from '@/mobile/app/features/places/ui/components/place-card/CompactPlaceCard';
import { PlaceCardFull } from '@/mobile/app/features/places/ui/components/place-card/PlaceCardFull';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { MediaLightbox } from '@/mobile/app/shared/components/feedback/MediaLightbox';
import { useMiniMapInteraction } from '@/mobile/app/shared/components/maps/useMiniMapInteraction';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { getCreatedUpdatedLabels } from '@/mobile/app/shared/utils/dateTime';
import {
  formatPrice,
  getListMarkerColor,
} from '@/mobile/app/shared/utils/format';
import { getModalSafeAreaPadding } from '@/mobile/app/shared/utils/modalLayout';
import { getPlaceMedia } from '@/mobile/app/shared/utils/placeMedia';

type PlaceCardProps = {
  place: Place;
  owner?: User | null;
  ownerId?: string | null;
  listId?: string;
  listName?: string;
  listEmoji?: string;
  listIsPublic?: boolean;
  listCoverImage?: string;
  compact?: boolean;
  allowAddToList?: boolean;
  markerColor?: string;
  markerContext?: 'feed' | 'list';
  onPress?: () => void;
  onOwnerPress?: () => void;
  onDelete?: () => void;
  onRefresh?: () => void;
};

type SourcePlaceCardModalProps = {
  allowAddToList: boolean;
  list: PlaceList | null;
  onClose: () => void;
  onOpenListDetail?: () => void;
  onOwnerPress?: () => void;
  owner: User | null;
  place: Place | null;
  visible: boolean;
};

function SourcePlaceCardModal({
  allowAddToList,
  list,
  onClose,
  onOpenListDetail,
  onOwnerPress,
  owner,
  place,
  visible,
}: SourcePlaceCardModalProps) {
  const insets = useSafeAreaInsets();
  const { paddingTop, paddingBottom } = getModalSafeAreaPadding({
    topInset: insets.top,
    bottomInset: insets.bottom,
    topSpacing: Platform.OS === 'android' ? 16 : 12,
    bottomSpacing: Platform.OS === 'android' ? 20 : 16,
    minTopPadding: Platform.OS === 'android' ? 20 : 16,
    minBottomPadding: Platform.OS === 'android' ? 38 : 16,
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <View style={[styles.sourceModalOverlay, { paddingTop, paddingBottom }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

        <View style={styles.sourceModalSheet}>
          <View style={styles.sourceModalHeader}>
            <Text style={styles.sourceModalTitle}>Alıntılanan mekân</Text>
            <Pressable style={styles.sourceModalCloseButton} onPress={onClose}>
              <X color={colors.textMuted} size={18} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.sourceModalContent}
            showsVerticalScrollIndicator={false}
          >
            {place && list ? (
              <PlaceCard
                allowAddToList={allowAddToList}
                listCoverImage={list.coverImage}
                listEmoji={list.emoji}
                listId={list.id}
                listIsPublic={list.isPublic}
                listName={list.name}
                markerColor={getListMarkerColor(list.isPublic)}
                onPress={onOpenListDetail}
                onOwnerPress={onOwnerPress}
                owner={owner}
                ownerId={list.userId}
                place={place}
              />
            ) : (
              <View style={styles.sourceModalLoadingWrap}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={styles.sourceModalLoadingText}>{tr.common.loading}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PlaceCardComponent({
  place,
  owner,
  ownerId,
  listId,
  listName,
  listEmoji,
  listIsPublic,
  listCoverImage,
  compact = false,
  allowAddToList = true,
  markerColor,
  markerContext = 'feed',
  onPress,
  onOwnerPress,
  onDelete,
  onRefresh,
}: PlaceCardProps) {
  const navigation = useAppNavigation();
  const { user } = useAuth();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showAddToList, setShowAddToList] = useState(false);
  const [showSourcePlaceCard, setShowSourcePlaceCard] = useState(false);
  const [addToListDraft, setAddToListDraft] = useState<PlaceEditorDraft | null>(null);
  const [commentsActivated, setCommentsActivated] = useState(false);
  const [likersActivated, setLikersActivated] = useState(false);
  const media = getPlaceMedia(place);
  const baseMarkerColor = markerColor ?? getListMarkerColor(listIsPublic);
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
    setLightboxIndex(null);
    setAddToListDraft(null);
    setShowAddToList(false);
    setShowSourcePlaceCard(false);
    setCommentsActivated(false);
    setLikersActivated(false);
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
    canOpenSourcePlaceCard,
    sourceAttributionList,
    sourceAttributionOwner,
    sourceAttributionPlace,
    sourceAttributionUser,
    sourceAttributionUserId,
  } = usePlaceCardState({
    currentListId: listId,
    owner,
    ownerId,
    place,
    user,
    commentsEnabled: commentsActivated,
    likersEnabled: likersActivated,
    listsEnabled: showAddToList,
    sourceAttributionEnabled: showSourcePlaceCard,
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
        media={media}
        mapMarkers={mapMarkers}
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

  const handleSourcePress = () => {
    if (canOpenSourcePlaceCard && place.sourceAttribution?.listId) {
      setShowSourcePlaceCard(true);
      return;
    }

    if (sourceAttributionUserId) {
      openUserProfile(sourceAttributionUserId);
    }
  };

  const handleSourceListDetailOpen = () => {
    if (!sourceAttributionList || !sourceAttributionPlace) {
      return;
    }

    setShowSourcePlaceCard(false);
    openStackScreen(navigation, 'ListDetail', {
      listId: sourceAttributionList.id,
      placeId: sourceAttributionPlace.id,
    });
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
        onMediaPress={setLightboxIndex}
        onPress={onPress}
        onRefresh={onRefresh}
        onReportPlace={handleReportPlace}
        onUserPress={openUserProfile}
        onCommentsVisibilityChange={(visible) => {
          if (visible) {
            setCommentsActivated(true);
          }
        }}
        onLikersVisibilityChange={(visible) => {
          if (visible) {
            setLikersActivated(true);
          }
        }}
        owner={owner}
        media={media}
        place={place}
        placeTimestampLabels={placeTimestampLabels}
        priceLabel={priceLabel}
        sourceAttribution={place.sourceAttribution}
        sourceUser={sourceAttributionUser}
        specialFeatures={specialFeatures}
        onSourcePress={handleSourcePress}
        hasNextCommentsPage={hasNextCommentsPage}
      />

      {allowAddToList && user && showAddToList ? (
        <PlaceEditorModal
          visible={showAddToList}
          lat={place.lat}
          lng={place.lng}
          placeName={place.name}
          placeAddress={place.address}
          lists={myLists}
          draft={addToListDraft}
          onClose={() => {
            setAddToListDraft(null);
            setShowAddToList(false);
          }}
          onMinimize={(draft) => {
            setAddToListDraft(draft);
            setShowAddToList(false);
          }}
          onSave={async (placeData, targetListIds) => {
            const saved = await savePlaceToLists(placeData, targetListIds);

            if (saved) {
              setAddToListDraft(null);
              setShowAddToList(false);
            }
          }}
          onCreateList={async (list) => {
            await createList(list);
          }}
        />
      ) : null}

      {showSourcePlaceCard ? (
        <SourcePlaceCardModal
          allowAddToList={allowAddToList && Boolean(user)}
          list={sourceAttributionList}
          onClose={() => setShowSourcePlaceCard(false)}
          onOpenListDetail={handleSourceListDetailOpen}
          onOwnerPress={
            sourceAttributionOwner?.id
              ? () => {
                  setShowSourcePlaceCard(false);
                  openUserProfile(sourceAttributionOwner.id);
                }
              : undefined
          }
          owner={sourceAttributionOwner}
          place={sourceAttributionPlace}
          visible
        />
      ) : null}

      {lightboxIndex != null ? (
        <MediaLightbox
          items={media}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </>
  );
}

function arePlaceCardPropsEqual(previous: PlaceCardProps, next: PlaceCardProps) {
  return (
    previous.place === next.place &&
    previous.owner === next.owner &&
    previous.ownerId === next.ownerId &&
    previous.listId === next.listId &&
    previous.listName === next.listName &&
    previous.listEmoji === next.listEmoji &&
    previous.listIsPublic === next.listIsPublic &&
    previous.listCoverImage === next.listCoverImage &&
    previous.compact === next.compact &&
    previous.allowAddToList === next.allowAddToList &&
    previous.markerColor === next.markerColor &&
    previous.markerContext === next.markerContext
  );
}

export const PlaceCard = React.memo(PlaceCardComponent, arePlaceCardPropsEqual);

const styles = StyleSheet.create({
  sourceModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sourceModalSheet: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '88%',
    alignSelf: 'center',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  sourceModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  sourceModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  sourceModalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  sourceModalContent: {
    paddingBottom: 24,
  },
  sourceModalLoadingWrap: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  sourceModalLoadingText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSoft,
  },
});
