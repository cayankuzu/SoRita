import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Share2 } from 'lucide-react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { openStackScreen, useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import type { Place, User } from '@/mobile/app/data/contracts/entities';
import { useUpdateListsMutation } from '@/mobile/app/data/hooks/useListMutations';
import { useDeletePlaceMutation } from '@/mobile/app/data/hooks/usePlaceMutations';
import type { PlaceEditorDraft } from '@/mobile/app/features/map/public/types';
import { buildOwnedPlaceListUpdates } from '@/mobile/app/features/places/application/ownedPlaceListUpdates';
import { usePlaceCardState } from '@/mobile/app/features/places/application/usePlaceCardState';
import { PlaceCardFull } from '@/mobile/app/features/places/ui/components/place-card/PlaceCardFull';
import { shouldShowPlaceCardMiniMap } from '@/mobile/app/features/places/ui/components/place-card/placeCardMapVisibility';
import {
  buildPlaceActionItems,
  createFallbackOwnedList,
  getPlaceCardMetadata,
  includeFallbackList,
  resolveOptionalPressHandler,
} from '@/mobile/app/features/places/ui/components/place-card/placeCardModel';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { DeferredActionMenuSheet } from '@/mobile/app/shared/components/feedback/DeferredActionMenuSheet';
import { useMiniMapInteraction } from '@/mobile/app/shared/components/maps/useMiniMapInteraction';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { getCreatedUpdatedLabels } from '@/mobile/app/shared/utils/dateTime';
import { buildListContentUrl } from '@/mobile/app/shared/utils/contentLinks';
import { formatPrice } from '@/mobile/app/shared/utils/format';
import { getListMarkerColor } from '@/mobile/app/shared/utils/markerColors';
import { getPlaceMedia } from '@/mobile/app/shared/utils/placeMedia';

type PlaceCardProps = {
  place: Place;
  context?: 'default' | 'list-detail';
  owner?: User | null;
  ownerId?: string | null;
  listId?: string;
  listName?: string;
  listEmoji?: string;
  listIsPublic?: boolean;
  listCoverImage?: string;
  allowAddToList?: boolean;
  markerColor?: string;
  locationPlaceCardsCount?: number;
  locationOriginalPlaceName?: string;
  isVisible?: boolean;
  onPress?: () => void;
  onPressIn?: () => void;
  onOwnerPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onRefresh?: () => void;
  onPlaceNamePress?: (() => void) | null;
};

type ConfirmActionModalProps = React.ComponentProps<
  typeof import('@/mobile/app/shared/components/feedback/ConfirmActionModal')['ConfirmActionModal']
>;
type MediaLightboxProps = React.ComponentProps<
  typeof import('@/mobile/app/shared/components/feedback/MediaLightbox')['MediaLightbox']
>;
type PlaceEditorModalProps = React.ComponentProps<
  typeof import('@/mobile/app/features/map/public/components')['PlaceEditorModal']
>;
type ReportActionSheetProps = React.ComponentProps<
  typeof import('@/mobile/app/shared/components/feedback/ReportActionSheet')['ReportActionSheet']
>;
type SourcePlaceCardModalProps = React.ComponentProps<
  typeof import('@/mobile/app/features/places/ui/components/place-card/SourcePlaceCardModal')['SourcePlaceCardModal']
>;
type PlaceCardOverlay =
  | { type: 'none' }
  | { type: 'action-menu' }
  | { type: 'add-to-list' }
  | { type: 'lightbox'; index: number }
  | { type: 'owned-delete' }
  | { type: 'owned-editor' }
  | { type: 'report' }
  | { type: 'share-menu' }
  | { type: 'source-place' };

function renderWhen(
  visible: boolean,
  render: () => React.ReactNode,
) {
  return visible ? render() : null;
}

function DeferredConfirmActionModal(props: ConfirmActionModalProps) {
  const { ConfirmActionModal } = require('@/mobile/app/shared/components/feedback/ConfirmActionModal') as
    typeof import('@/mobile/app/shared/components/feedback/ConfirmActionModal');
  return <ConfirmActionModal {...props} />;
}

function DeferredMediaLightbox(props: MediaLightboxProps) {
  const { MediaLightbox } = require('@/mobile/app/shared/components/feedback/MediaLightbox') as
    typeof import('@/mobile/app/shared/components/feedback/MediaLightbox');
  return <MediaLightbox {...props} />;
}

function DeferredPlaceEditorModal(props: PlaceEditorModalProps) {
  const { PlaceEditorModal } = require('@/mobile/app/features/map/public/components') as
    typeof import('@/mobile/app/features/map/public/components');
  return <PlaceEditorModal {...props} />;
}

function DeferredReportActionSheet(props: ReportActionSheetProps) {
  const { ReportActionSheet } = require('@/mobile/app/shared/components/feedback/ReportActionSheet') as
    typeof import('@/mobile/app/shared/components/feedback/ReportActionSheet');
  return <ReportActionSheet {...props} />;
}

function DeferredSourcePlaceCardModal(props: SourcePlaceCardModalProps) {
  const { SourcePlaceCardModal } = require('@/mobile/app/features/places/ui/components/place-card/SourcePlaceCardModal') as
    typeof import('@/mobile/app/features/places/ui/components/place-card/SourcePlaceCardModal');
  return <SourcePlaceCardModal {...props} />;
}

function PlaceCardComponent({
  place,
  context,
  owner,
  ownerId,
  listId,
  listName,
  listEmoji,
  listIsPublic,
  listCoverImage,
  allowAddToList = true,
  markerColor,
  locationPlaceCardsCount,
  locationOriginalPlaceName,
  isVisible = true,
  onPress,
  onPressIn,
  onOwnerPress,
  onEdit,
  onDelete,
  onRefresh,
  onPlaceNamePress,
}: PlaceCardProps) {
  const navigation = useAppNavigation();
  const { user } = useAuth();
  const { mutateAsync: deletePlaceAsync } = useDeletePlaceMutation();
  const { mutateAsync: updateListsAsync } = useUpdateListsMutation();
  const [activeOverlay, setActiveOverlay] = useState<PlaceCardOverlay>({ type: 'none' });
  const [isSharingLink, setIsSharingLink] = useState(false);
  const [addToListDraft, setAddToListDraft] = useState<PlaceEditorDraft | null>(null);
  const [commentsActivated, setCommentsActivated] = useState(false);
  const [isMapManuallyHidden, setIsMapManuallyHidden] = useState(false);
  const [likersActivated, setLikersActivated] = useState(false);
  const [reportDetails, setReportDetails] = useState('');
  const [reportReason, setReportReason] = useState('');
  const lightboxIndex = activeOverlay.type === 'lightbox' ? activeOverlay.index : null;
  const showAddToList = activeOverlay.type === 'add-to-list';
  const showActionMenu = activeOverlay.type === 'action-menu';
  const showOwnedPlaceDeleteConfirm = activeOverlay.type === 'owned-delete';
  const showOwnedPlaceEditor = activeOverlay.type === 'owned-editor';
  const showReportSheet = activeOverlay.type === 'report';
  const showShareMenu = activeOverlay.type === 'share-menu';
  const showSourcePlaceCard = activeOverlay.type === 'source-place';
  const closeOverlay = () => setActiveOverlay({ type: 'none' });
  const media = useMemo(() => getPlaceMedia(place), [place]);
  const { bestTimes, categories, dietaryOptions, specialFeatures } = useMemo(
    () => getPlaceCardMetadata(place),
    [place],
  );
  const baseMarkerColor = markerColor ?? getListMarkerColor(listIsPublic);
  const initialResolvedOwnerId = ownerId || owner?.id || place.addedBy?.userId || null;
  const {
    activateMap,
    deactivateMap,
    isMapInteractive,
    mapFocusKey,
    showInteractionHint,
  } = useMiniMapInteraction(place.id);
  const isMapVisible = shouldShowPlaceCardMiniMap({
    hasMedia: media.length > 0,
    interactive: isMapInteractive,
    manuallyHidden: isMapManuallyHidden,
  });

  const priceLabel = formatPrice(place) ?? undefined;
  const shareUrl = useMemo(() => buildListContentUrl(listId, place.id), [listId, place.id]);

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
    () => getCreatedUpdatedLabels(place.addedAt, place.updatedAt),
    [place.addedAt, place.updatedAt],
  );

  useEffect(() => {
    setActiveOverlay({ type: 'none' });
    setAddToListDraft(null);
    setIsSharingLink(false);
    setCommentsActivated(false);
    setIsMapManuallyHidden(false);
    setLikersActivated(false);
    setReportDetails('');
    setReportReason('');
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
    resolvedOwnerId,
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
    listsEnabled: showAddToList || Boolean(user && listId && initialResolvedOwnerId === user.id),
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

  const handleOpenLocationPlaceCards = () => {
    openStackScreen(navigation, 'LocationPlaceCards', {
      lat: place.lat,
      lng: place.lng,
      ownerId: ownerId || undefined,
      placeId: place.id,
      placeName: locationOriginalPlaceName || place.name,
    });
  };

  const resolvedPlaceNamePress = resolveOptionalPressHandler(
    onPlaceNamePress,
    handleOpenLocationPlaceCards,
  );
  const canManageOwnedPlace = Boolean(
    user && listId && (resolvedOwnerId || initialResolvedOwnerId) === user.id,
  );
  const fallbackOwnedList = useMemo(() => createFallbackOwnedList({
    canManage: canManageOwnedPlace,
    listCoverImage,
    listEmoji,
    listId,
    listIsPublic,
    listName,
    place,
    user,
  }), [
    canManageOwnedPlace,
    listCoverImage,
    listEmoji,
    listId,
    listIsPublic,
    listName,
    place,
    user,
  ]);
  const ownedEditableLists = useMemo(
    () => includeFallbackList(myLists, fallbackOwnedList),
    [fallbackOwnedList, myLists],
  );
  const ownedCurrentList =
    ownedEditableLists.find((item) => item.id === listId) || fallbackOwnedList;

  const focusMapPreview = () => {
    setIsMapManuallyHidden(false);
    activateMap();
  };

  const hideMapPreview = () => {
    setIsMapManuallyHidden(true);
    deactivateMap();
  };

  const handleSourcePress = () => {
    if (canOpenSourcePlaceCard && place.sourceAttribution?.listId) {
      setActiveOverlay({ type: 'source-place' });
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

    closeOverlay();
    openStackScreen(navigation, 'ListDetail', {
      listId: sourceAttributionList.id,
      placeId: sourceAttributionPlace.id,
    });
  };

  const handleReportPlaceSubmit = async () => {
    if (!reportReason.trim()) {
      return;
    }

    try {
      await handleReportPlace(reportReason, reportDetails.trim() || undefined);
      closeOverlay();
      setReportDetails('');
      setReportReason('');
      showToast(tr.cards.reportSent, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : tr.cards.placeReportFailed, 'error');
    }
  };

  const mediaOwnerUserId =
    place.sourceAttribution?.userId ||
    place.addedBy?.userId ||
    resolvedOwnerId ||
    initialResolvedOwnerId;
  const canDownloadOwnedPlaceMedia = Boolean(user && mediaOwnerUserId === user.id);

  const handleOwnedPlaceSave = async (
    placeData: Omit<Place, 'id' | 'addedAt'>,
    targetListIds: string[],
  ) => {
    if (!ownedCurrentList) {
      showToast(tr.common.loading, 'info');
      return;
    }

    const nextUpdatedAt = new Date().toISOString();
    const changedLists = buildOwnedPlaceListUpdates({
      editableLists: ownedEditableLists,
      place,
      placeData,
      targetListIds,
      updatedAt: nextUpdatedAt,
    });

    try {
      await updateListsAsync(changedLists);
      closeOverlay();
      showToast(tr.profile.toast.placeUpdated, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : tr.map.savePlaceUnexpected, 'error');
    }
  };

  const handleOwnedPlaceDelete = async () => {
    try {
      await deletePlaceAsync(place.id);
      closeOverlay();
      showToast(tr.profile.toast.placeDeleted, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : tr.map.deletePlaceUnexpected, 'error');
    }
  };

  const openShareMenu = () => {
    setActiveOverlay({ type: 'share-menu' });
  };

  const handleCopyAddressPress = async () => {
    closeOverlay();

    try {
      const { setStringAsync } = await import('expo-clipboard');
      await setStringAsync(shareUrl);
      showToast(tr.cards.copyLinkSuccess, 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : tr.cards.copyLinkFailed,
        'error',
      );
    }
  };

  const handleShareLinkPress = async () => {
    if (isSharingLink) {
      return;
    }

    closeOverlay();
    setIsSharingLink(true);

    try {
      const { shareExternalUrl } = await import('@/mobile/app/platform/sharing/shareExternalUrl');
      const result = await shareExternalUrl(shareUrl);

      if (!result.ok) {
        showToast(result.message || tr.map.savePlaceUnexpected, 'error');
      }
    } finally {
      setIsSharingLink(false);
    }
  };

  const actionItems = buildPlaceActionItems({
    canManageOwnedPlace,
    canReportPlace,
    onDelete,
    onDeletePress: () => {
      if (onDelete) {
        closeOverlay();
        onDelete();
        return;
      }

      setActiveOverlay({ type: 'owned-delete' });
    },
    onEdit,
    onEditPress: () => {
      if (onEdit) {
        closeOverlay();
        onEdit();
        return;
      }

      setActiveOverlay({ type: 'owned-editor' });
    },
    onReportPress: () => {
      setActiveOverlay({ type: 'report' });
    },
  });
  const shareActionItems = [
    {
      key: 'copy-address',
      label: tr.cards.copyLink,
      renderIcon: (color: string) => <Copy color={color} size={14} />,
      onPress: () => {
        void handleCopyAddressPress();
      },
    },
    {
      key: 'share-more',
      label: tr.cards.shareMore,
      renderIcon: (color: string) => <Share2 color={color} size={14} />,
      onPress: () => {
        void handleShareLinkPress();
      },
    },
  ];
  const placeCardFullProps: React.ComponentProps<typeof PlaceCardFull> = {
    actions: {
      onAddToListPress: () => setActiveOverlay({ type: 'add-to-list' }),
      onAddressCopied: () => showToast(tr.cards.addressCopied, 'success'),
      onCommentDelete: handleDeleteComment,
      onCommentsLoadMore: async () => {
        await fetchNextCommentsPage?.();
      },
      onCommentLikeToggle: handleToggleCommentLike,
      onCommentReport: handleReportComment,
      onCommentSubmit: handleCreateComment,
      onCommentUpdate: handleUpdateComment,
      onFocusPress: focusMapPreview,
      onFocusLongPress: hideMapPreview,
      onLikePress: handleLikePress,
      onSharePress: openShareMenu,
      onOpenActionMenu: actionItems.length > 0
        ? () => setActiveOverlay({ type: 'action-menu' })
        : undefined,
      onOwnerPress,
      onMediaPress: (index) => setActiveOverlay({ type: 'lightbox', index }),
      onPlaceNamePress: resolvedPlaceNamePress,
      onPress,
      onPressIn,
      onRefresh,
      onReportPlace: handleReportPlace,
      onUserPress: openUserProfile,
      onCommentsVisibilityChange: (visible) => {
        if (visible) {
          setCommentsActivated(true);
        }
      },
      onLikersVisibilityChange: (visible) => {
        if (visible) {
          setLikersActivated(true);
        }
      },
      onSourcePress: handleSourcePress,
      showActionMenu: actionItems.length > 0,
    },
    content: {
      bestTimes,
      categories,
      context,
      dietaryOptions,
      listCoverImage,
      listEmoji,
      listIsPublic,
      listName,
      locationPlaceCardsCount,
      owner,
      media,
      place,
      placeTimestampLabels,
      priceLabel,
      sourceAttribution: place.sourceAttribution,
      sourceUser: sourceAttributionUser,
      specialFeatures,
    },
    map: {
      focusKey: mapFocusKey,
      interactive: isMapInteractive,
      markers: mapMarkers,
      previewEnabled: isVisible,
      showInteractionHint,
      visible: isMapVisible,
    },
    social: {
      allowAddToList: allowAddToList && Boolean(user),
      comments,
      currentUserName: user?.name,
      currentUserPhoto: user?.profilePhoto,
      hasNextCommentsPage,
      isFetchingNextCommentsPage,
      isLiked,
      likers,
    },
  };

  return (
    <>
      <PlaceCardFull {...placeCardFullProps} />

      {renderWhen(showActionMenu && actionItems.length > 0, () => (
        <DeferredActionMenuSheet
          visible
          title={place.name}
          items={actionItems}
          onClose={closeOverlay}
        />
      ))}

      {renderWhen(showShareMenu, () => (
        <DeferredActionMenuSheet
          visible
          title={tr.cards.share}
          items={shareActionItems}
          onClose={closeOverlay}
        />
      ))}

      {renderWhen(showOwnedPlaceDeleteConfirm, () => (
        <DeferredConfirmActionModal
          visible
          title={tr.listDetail.deletePlaceTitle}
          description={tr.listDetail.deletePlaceDescription}
          confirmLabel={tr.common.delete}
          confirmVariant="danger"
          onClose={closeOverlay}
          onConfirm={handleOwnedPlaceDelete}
        />
      ))}

      {renderWhen(Boolean(allowAddToList && user && showAddToList), () => (
        <DeferredPlaceEditorModal
          visible={showAddToList}
          lat={place.lat}
          lng={place.lng}
          placeName={place.name}
          placeAddress={place.address}
          lists={myLists}
          draft={addToListDraft}
          onClose={() => {
            setAddToListDraft(null);
            closeOverlay();
          }}
          onMinimize={(draft) => {
            setAddToListDraft(draft);
            closeOverlay();
          }}
          onSave={async (placeData, targetListIds) => {
            const saved = await savePlaceToLists(placeData, targetListIds);

            if (saved) {
              setAddToListDraft(null);
              closeOverlay();
            }
          }}
          onCreateList={async (list) => {
            await createList(list);
          }}
        />
      ))}

      {renderWhen(Boolean(showOwnedPlaceEditor && ownedCurrentList), () => (
        <DeferredPlaceEditorModal
          visible
          lat={place.lat}
          lng={place.lng}
          placeName={place.name}
          placeAddress={place.address}
          lists={ownedEditableLists}
          existingPlace={place}
          existingPlaceListName={ownedCurrentList?.name || ''}
          onClose={closeOverlay}
          onDelete={async () => {
            await handleOwnedPlaceDelete();
          }}
          onSave={async (placeData, targetListIds) => {
            await handleOwnedPlaceSave(placeData, targetListIds);
          }}
          onCreateList={async (list) => {
            await createList(list);
          }}
        />
      ))}

      {renderWhen(showSourcePlaceCard, () => (
        <DeferredSourcePlaceCardModal
          onClose={closeOverlay}
          visible
        >
          {sourceAttributionPlace && sourceAttributionList ? (
            <PlaceCard
              allowAddToList={allowAddToList && Boolean(user)}
              listCoverImage={sourceAttributionList.coverImage}
              listEmoji={sourceAttributionList.emoji}
              listId={sourceAttributionList.id}
              listIsPublic={sourceAttributionList.isPublic}
              listName={sourceAttributionList.name}
              markerColor={getListMarkerColor(sourceAttributionList.isPublic)}
              onPress={handleSourceListDetailOpen}
              onOwnerPress={
                sourceAttributionOwner?.id
                  ? () => {
                      closeOverlay();
                      openUserProfile(sourceAttributionOwner.id);
                    }
                  : undefined
              }
              owner={sourceAttributionOwner}
              ownerId={sourceAttributionList.userId}
              place={sourceAttributionPlace}
            />
          ) : null}
        </DeferredSourcePlaceCardModal>
      ))}

      {renderWhen(lightboxIndex != null, () => (
        <DeferredMediaLightbox
          allowDownload={canDownloadOwnedPlaceMedia}
          items={media}
          initialIndex={lightboxIndex ?? 0}
          onClose={closeOverlay}
        />
      ))}

      {renderWhen(showReportSheet, () => (
        <DeferredReportActionSheet
          visible
          title={tr.cards.reportContentTitle}
          description={tr.cards.reportContentDescription}
          reportDetails={reportDetails}
          reportReason={reportReason}
          onReportDetailsChange={setReportDetails}
          onReportReasonChange={setReportReason}
          onClose={() => {
            closeOverlay();
            setReportDetails('');
            setReportReason('');
          }}
          onSubmit={handleReportPlaceSubmit}
        />
      ))}
    </>
  );
}

export const PlaceCard = React.memo(PlaceCardComponent);
