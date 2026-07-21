import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Flag, Pencil, Share2, Trash2 } from 'lucide-react-native';

import { PLACE_DIETARY_OPTIONS } from '@/mobile/app/catalog/placeOptions';
import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { openStackScreen, useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import type { Place, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { useUpdateListsMutation } from '@/mobile/app/data/hooks/useListMutations';
import { useDeletePlaceMutation } from '@/mobile/app/data/hooks/usePlaceMutations';
import type { PlaceEditorDraft } from '@/mobile/app/features/map/public/types';
import { buildOwnedPlaceListUpdates } from '@/mobile/app/features/places/application/ownedPlaceListUpdates';
import { usePlaceCardState } from '@/mobile/app/features/places/application/usePlaceCardState';
import { CompactPlaceCard } from '@/mobile/app/features/places/ui/components/place-card/CompactPlaceCard';
import { PlaceCardFull } from '@/mobile/app/features/places/ui/components/place-card/PlaceCardFull';
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
  compact?: boolean;
  allowAddToList?: boolean;
  markerColor?: string;
  markerContext?: 'feed' | 'list';
  locationPlaceCardsCount?: number;
  locationOriginalPlaceName?: string;
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
type ActionMenuItem = React.ComponentProps<typeof DeferredActionMenuSheet>['items'][number];

function renderWhen(
  visible: boolean,
  render: () => React.ReactNode,
) {
  return visible ? render() : null;
}

function uniqueValues(values?: string[], fallback?: string) {
  if (values?.length) {
    return Array.from(new Set(values));
  }

  return fallback ? [fallback] : [];
}

function getPlaceCardMetadata(place: Place) {
  const features = uniqueValues(place.specialFeatures);

  return {
    bestTimes: uniqueValues(place.bestTimes, place.bestTime),
    categories: uniqueValues(place.categories, place.category),
    dietaryOptions: features.filter((item) => PLACE_DIETARY_OPTIONS.includes(item)),
    specialFeatures: features.filter((item) => !PLACE_DIETARY_OPTIONS.includes(item)),
  };
}

function createFallbackOwnedList(params: {
  canManage: boolean;
  listCoverImage?: string;
  listEmoji?: string;
  listId?: string;
  listIsPublic?: boolean;
  listName?: string;
  place: Place;
  user: User | null;
}): PlaceList | null {
  if (!params.canManage || !params.user || !params.listId) {
    return null;
  }

  return {
    id: params.listId,
    userId: params.user.id,
    name: params.listName || tr.cards.savedPlaceFallback,
    description: undefined,
    emoji: params.listEmoji,
    coverImage: params.listCoverImage,
    places: [params.place],
    isPublic: params.listIsPublic !== false,
    createdAt: params.place.addedAt,
    updatedAt: params.place.updatedAt || params.place.addedAt,
  };
}

function includeFallbackList(lists: PlaceList[], fallback: PlaceList | null) {
  if (!fallback || lists.some((item) => item.id === fallback.id)) {
    return lists;
  }

  return [fallback, ...lists];
}

function buildPlaceActionItems(params: {
  canManageOwnedPlace: boolean;
  canReportPlace: boolean;
  onDelete?: () => void;
  onDeletePress: () => void;
  onEdit?: () => void;
  onEditPress: () => void;
  onReportPress: () => void;
  onSharePress: () => void;
}) {
  const items: Array<ActionMenuItem | null> = [
    {
      key: 'share',
      label: tr.cards.share,
      renderIcon: (color) => <Share2 color={color} size={14} />,
      onPress: params.onSharePress,
    },
    params.onEdit || params.canManageOwnedPlace
      ? {
          key: 'edit',
          label: tr.common.edit,
          renderIcon: (color) => <Pencil color={color} size={14} />,
          onPress: params.onEditPress,
        }
      : null,
    params.onDelete || params.canManageOwnedPlace
      ? {
          key: 'delete',
          label: tr.common.delete,
          renderIcon: (color) => <Trash2 color={color} size={14} />,
          tone: 'danger',
          onPress: params.onDeletePress,
        }
      : null,
    params.canReportPlace
      ? {
          key: 'report',
          label: tr.profile.actions.report,
          renderIcon: (color) => <Flag color={color} size={14} />,
          tone: 'danger',
          onPress: params.onReportPress,
        }
      : null,
  ];

  return items.filter((item): item is ActionMenuItem => Boolean(item));
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
  compact = false,
  allowAddToList = true,
  markerColor,
  markerContext = 'feed',
  locationPlaceCardsCount,
  locationOriginalPlaceName,
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showAddToList, setShowAddToList] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showOwnedPlaceDeleteConfirm, setShowOwnedPlaceDeleteConfirm] = useState(false);
  const [showOwnedPlaceEditor, setShowOwnedPlaceEditor] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [showSourcePlaceCard, setShowSourcePlaceCard] = useState(false);
  const [isSharingLink, setIsSharingLink] = useState(false);
  const [addToListDraft, setAddToListDraft] = useState<PlaceEditorDraft | null>(null);
  const [commentsActivated, setCommentsActivated] = useState(false);
  const [likersActivated, setLikersActivated] = useState(false);
  const [reportDetails, setReportDetails] = useState('');
  const [reportReason, setReportReason] = useState('');
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
    () => getCreatedUpdatedLabels(place.addedAt, place.updatedAt || place.addedAt),
    [place.addedAt, place.updatedAt],
  );

  useEffect(() => {
    setLightboxIndex(null);
    setAddToListDraft(null);
    setShowAddToList(false);
    setShowActionMenu(false);
    setShowShareMenu(false);
    setShowOwnedPlaceDeleteConfirm(false);
    setShowOwnedPlaceEditor(false);
    setShowReportSheet(false);
    setShowSourcePlaceCard(false);
    setIsSharingLink(false);
    setCommentsActivated(false);
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

  const resolvedPlaceNamePress = onPlaceNamePress === undefined
    ? handleOpenLocationPlaceCards
    : onPlaceNamePress || undefined;
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

  if (compact) {
    return (
      <CompactPlaceCard
        media={media}
        mapMarkers={mapMarkers}
        locationPlaceCardsCount={locationPlaceCardsCount}
        place={place}
        placeTimestampLabels={placeTimestampLabels}
        onPlaceNamePress={resolvedPlaceNamePress}
        onPress={onPress}
        onPressIn={onPressIn}
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

  const handleReportPlaceSubmit = async () => {
    if (!reportReason.trim()) {
      return;
    }

    try {
      await handleReportPlace(reportReason, reportDetails.trim() || undefined);
      setShowReportSheet(false);
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
      setShowOwnedPlaceEditor(false);
      showToast(tr.profile.toast.placeUpdated, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : tr.map.savePlaceUnexpected, 'error');
    }
  };

  const handleOwnedPlaceDelete = async () => {
    try {
      await deletePlaceAsync(place.id);
      setShowOwnedPlaceDeleteConfirm(false);
      setShowOwnedPlaceEditor(false);
      showToast(tr.profile.toast.placeDeleted, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : tr.map.deletePlaceUnexpected, 'error');
    }
  };

  const openShareMenu = () => {
    setShowActionMenu(false);
    setShowShareMenu(true);
  };

  const handleCopyAddressPress = async () => {
    setShowShareMenu(false);

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

    setShowShareMenu(false);
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
      setShowActionMenu(false);
      if (onDelete) {
        onDelete();
        return;
      }

      setShowOwnedPlaceDeleteConfirm(true);
    },
    onEdit,
    onEditPress: () => {
      setShowActionMenu(false);
      if (onEdit) {
        onEdit();
        return;
      }

      setShowOwnedPlaceEditor(true);
    },
    onReportPress: () => {
      setShowActionMenu(false);
      setShowReportSheet(true);
    },
    onSharePress: openShareMenu,
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
    allowAddToList: allowAddToList && Boolean(user),
    bestTimes,
    canReportPlace,
    categories,
    comments,
    context,
    currentUserName: user?.name,
    currentUserPhoto: user?.profilePhoto,
    dietaryOptions,
    isLiked,
    isFetchingNextCommentsPage,
    likers,
    listCoverImage,
    listEmoji,
    listIsPublic,
    listName,
    isMapInteractive,
    locationPlaceCardsCount,
    mapFocusKey,
    mapMarkers,
    showMapInteractionHint: showInteractionHint,
    onAddToListPress: () => setShowAddToList(true),
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
    onFocusLongPress: deactivateMap,
    onLikePress: handleLikePress,
    onSharePress: () => {
      openShareMenu();
    },
    onOpenActionMenu: actionItems.length > 0 ? () => setShowActionMenu(true) : undefined,
    onOwnerPress,
    onMediaPress: setLightboxIndex,
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
    owner,
    media,
    place,
    placeTimestampLabels,
    priceLabel,
    sourceAttribution: place.sourceAttribution,
    sourceUser: sourceAttributionUser,
    specialFeatures,
    onSourcePress: handleSourcePress,
    showActionMenu: actionItems.length > 0,
    hasNextCommentsPage,
  };

  return (
    <>
      <PlaceCardFull {...placeCardFullProps} />

      {renderWhen(showActionMenu && actionItems.length > 0, () => (
        <DeferredActionMenuSheet
          visible
          title={place.name}
          items={actionItems}
          onClose={() => setShowActionMenu(false)}
        />
      ))}

      {renderWhen(showShareMenu, () => (
        <DeferredActionMenuSheet
          visible
          title={tr.cards.share}
          items={shareActionItems}
          onClose={() => setShowShareMenu(false)}
        />
      ))}

      {renderWhen(showOwnedPlaceDeleteConfirm, () => (
        <DeferredConfirmActionModal
          visible
          title={tr.listDetail.deletePlaceTitle}
          description={tr.listDetail.deletePlaceDescription}
          confirmLabel={tr.common.delete}
          confirmVariant="danger"
          onClose={() => setShowOwnedPlaceDeleteConfirm(false)}
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
          onClose={() => setShowOwnedPlaceEditor(false)}
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
          onClose={() => setShowSourcePlaceCard(false)}
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
                      setShowSourcePlaceCard(false);
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
          onClose={() => setLightboxIndex(null)}
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
            setShowReportSheet(false);
            setReportDetails('');
            setReportReason('');
          }}
          onSubmit={() => {
            void handleReportPlaceSubmit();
          }}
        />
      ))}
    </>
  );
}

export const PlaceCard = React.memo(PlaceCardComponent);
