import React, { useEffect, useMemo, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Copy, Flag, Pencil, Share2, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PLACE_DIETARY_OPTIONS } from '@/mobile/app/catalog/placeOptions';
import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { openStackScreen, useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import type { Place, PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { useUpdateListsMutation } from '@/mobile/app/data/hooks/useListMutations';
import { useDeletePlaceMutation } from '@/mobile/app/data/hooks/usePlaceMutations';
import { PlaceEditorModal } from '@/mobile/app/features/map/public/components';
import type { PlaceEditorDraft } from '@/mobile/app/features/map/public/types';
import { usePlaceCardState } from '@/mobile/app/features/places/application/usePlaceCardState';
import { CompactPlaceCard } from '@/mobile/app/features/places/ui/components/place-card/CompactPlaceCard';
import { PlaceCardFull } from '@/mobile/app/features/places/ui/components/place-card/PlaceCardFull';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { shareExternalUrl } from '@/mobile/app/platform/sharing/shareExternalUrl';
import { ActionMenuSheet } from '@/mobile/app/shared/components/feedback/ActionMenuSheet';
import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { MediaLightbox } from '@/mobile/app/shared/components/feedback/MediaLightbox';
import { ReportActionSheet } from '@/mobile/app/shared/components/feedback/ReportActionSheet';
import { useMiniMapInteraction } from '@/mobile/app/shared/components/maps/useMiniMapInteraction';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { getCreatedUpdatedLabels } from '@/mobile/app/shared/utils/dateTime';
import { buildListContentUrl } from '@/mobile/app/shared/utils/contentLinks';
import { formatPrice } from '@/mobile/app/shared/utils/format';
import { getListMarkerColor } from '@/mobile/app/shared/utils/markerColors';
import { normalizeSearchText } from '@/mobile/app/shared/utils/textSort';
import {
  getAndroidModalWindowProps,
  getModalContentMaxHeight,
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';
import { getPlaceMedia } from '@/mobile/app/shared/utils/placeMedia';
import { normalizeOptionalMultilineText } from '@/mobile/app/shared/validation/contentLimits';
import { createUuid } from '@/shared/utils/id';

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
  locationPlaceCardsCount?: number;
  locationOriginalPlaceName?: string;
  onPress?: () => void;
  onOwnerPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onRefresh?: () => void;
  onPlaceNamePress?: (() => void) | null;
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

function normalizePlaceIdentityValue(value: string) {
  return normalizeSearchText(value);
}

function isMatchingPlace(
  left: Pick<Place, 'id' | 'name' | 'lat' | 'lng'>,
  right: Pick<Place, 'id' | 'name' | 'lat' | 'lng'>,
) {
  if (left.id && right.id) {
    return left.id === right.id;
  }

  return (
    Math.abs(left.lat - right.lat) < 0.00001 &&
    Math.abs(left.lng - right.lng) < 0.00001 &&
    normalizePlaceIdentityValue(left.name) === normalizePlaceIdentityValue(right.name)
  );
}

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
  const { height: windowHeight } = useWindowDimensions();
  const { paddingTop, paddingBottom } = getModalSafeAreaPadding({
    topInset: insets.top,
    bottomInset: insets.bottom,
    topSpacing: Platform.OS === 'android' ? 16 : 12,
    bottomSpacing: Platform.OS === 'android' ? 20 : 16,
    minTopPadding: Platform.OS === 'android' ? 20 : 16,
    minBottomPadding: Platform.OS === 'android' ? 38 : 16,
  });
  const sheetMaxHeight = getModalContentMaxHeight({
    viewportHeight: windowHeight,
    paddingTop,
    paddingBottom,
    maxHeightRatio: 0.88,
    minHeight: 320,
  });

  return (
    <Modal
      {...getAndroidModalWindowProps({
        navigationBarTranslucent: true,
        statusBarTranslucent: true,
      })}
      visible={visible}
      transparent
      animationType="slide"
      hardwareAccelerated
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <View style={[styles.sourceModalOverlay, { paddingTop, paddingBottom }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

        <View style={[styles.sourceModalSheet, { maxHeight: sheetMaxHeight }]}>
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
  locationPlaceCardsCount,
  locationOriginalPlaceName,
  onPress,
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
  const media = getPlaceMedia(place);
  const baseMarkerColor = markerColor ?? getListMarkerColor(listIsPublic);
  const initialResolvedOwnerId = ownerId || owner?.id || place.addedBy?.userId || null;
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
  const fallbackOwnedList = useMemo<PlaceList | null>(() => {
    if (!canManageOwnedPlace || !user || !listId) {
      return null;
    }

    return {
      id: listId,
      userId: user.id,
      name: listName || tr.cards.savedPlaceFallback,
      description: undefined,
      emoji: listEmoji,
      coverImage: listCoverImage,
      places: [place],
      isPublic: listIsPublic !== false,
      createdAt: place.addedAt,
      updatedAt: place.updatedAt || place.addedAt,
    };
  }, [
    canManageOwnedPlace,
    listCoverImage,
    listEmoji,
    listId,
    listIsPublic,
    listName,
    place,
    user,
  ]);
  const ownedEditableLists = useMemo(() => {
    if (!fallbackOwnedList) {
      return myLists;
    }

    return myLists.some((item) => item.id === fallbackOwnedList.id)
      ? myLists
      : [fallbackOwnedList, ...myLists];
  }, [fallbackOwnedList, myLists]);
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

    const selectedListIds = Array.from(new Set(targetListIds));
    const nextUpdatedAt = new Date().toISOString();
    const normalizedPlaceData: Omit<Place, 'id' | 'addedAt'> = {
      ...placeData,
      address: placeData.address?.trim() || undefined,
      notes: normalizeOptionalMultilineText(placeData.notes),
      title: normalizeOptionalMultilineText(placeData.title),
    };
    const changedLists = ownedEditableLists
      .map((list) => {
        const matchedPlaceIndex = list.places.findIndex((item) => isMatchingPlace(item, place));
        const hasPlace = matchedPlaceIndex >= 0;
        const shouldContainPlace = selectedListIds.includes(list.id);
        const listMembershipChanged =
          (hasPlace && !shouldContainPlace) ||
          (!hasPlace && shouldContainPlace);

        if (!hasPlace && !shouldContainPlace) {
          return null;
        }

        const matchedPlace = matchedPlaceIndex >= 0 ? list.places[matchedPlaceIndex] : null;
        const nextPlace: Place = {
          ...normalizedPlaceData,
          id: matchedPlace?.id || createUuid(),
          addedAt: matchedPlace?.addedAt || place.addedAt,
          updatedAt: nextUpdatedAt,
          addedBy: matchedPlace?.addedBy || placeData.addedBy || place.addedBy,
        };

        const nextPlaces = shouldContainPlace
          ? hasPlace
            ? list.places.map((item, index) => (index === matchedPlaceIndex ? nextPlace : item))
            : [...list.places, nextPlace]
          : list.places.filter((_, index) => index !== matchedPlaceIndex);

        return {
          ...list,
          places: nextPlaces,
          updatedAt: listMembershipChanged ? nextUpdatedAt : list.updatedAt,
        };
      })
      .filter((item): item is PlaceList => Boolean(item));

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
      await Clipboard.setStringAsync(shareUrl);
      showToast("Bağlantı URL'si kopyalandı", 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Bağlantı URL'si kopyalanamadı",
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
      const result = await shareExternalUrl(shareUrl);

      if (!result.ok) {
        showToast(result.message || tr.map.savePlaceUnexpected, 'error');
      }
    } finally {
      setIsSharingLink(false);
    }
  };

  const actionItems = [
    {
      key: 'share',
      label: tr.cards.share,
      renderIcon: (color: string) => <Share2 color={color} size={16} />,
      onPress: () => {
        openShareMenu();
      },
    },
    onEdit || canManageOwnedPlace
      ? {
          key: 'edit',
          label: tr.common.edit,
          renderIcon: (color: string) => <Pencil color={color} size={16} />,
          onPress: () => {
            setShowActionMenu(false);
            if (onEdit) {
              onEdit();
              return;
            }

            setShowOwnedPlaceEditor(true);
          },
        }
      : null,
    onDelete || canManageOwnedPlace
      ? {
          key: 'delete',
          label: tr.common.delete,
          renderIcon: (color: string) => <Trash2 color={color} size={16} />,
          tone: 'danger' as const,
          onPress: () => {
            setShowActionMenu(false);
            if (onDelete) {
              onDelete();
              return;
            }

            setShowOwnedPlaceDeleteConfirm(true);
          },
        }
      : null,
    canReportPlace
      ? {
          key: 'report',
          label: tr.profile.actions.report,
          renderIcon: (color: string) => <Flag color={color} size={16} />,
          tone: 'danger' as const,
          onPress: () => {
            setShowActionMenu(false);
            setShowReportSheet(true);
          },
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  const shareActionItems = [
    {
      key: 'copy-address',
      label: "Bağlantı URL'sini kopyala",
      renderIcon: (color: string) => <Copy color={color} size={16} />,
      onPress: () => {
        void handleCopyAddressPress();
      },
    },
    {
      key: 'share-more',
      label: tr.cards.shareMore,
      renderIcon: (color: string) => <Share2 color={color} size={16} />,
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

      {showActionMenu && actionItems.length > 0 ? (
        <ActionMenuSheet
          visible
          title={place.name}
          items={actionItems}
          onClose={() => setShowActionMenu(false)}
        />
      ) : null}

      {showShareMenu ? (
        <ActionMenuSheet
          visible
          title={tr.cards.share}
          items={shareActionItems}
          onClose={() => setShowShareMenu(false)}
        />
      ) : null}

      {showOwnedPlaceDeleteConfirm ? (
        <ConfirmActionModal
          visible
          title={tr.listDetail.deletePlaceTitle}
          description={tr.listDetail.deletePlaceDescription}
          confirmLabel={tr.common.delete}
          confirmVariant="danger"
          onClose={() => setShowOwnedPlaceDeleteConfirm(false)}
          onConfirm={handleOwnedPlaceDelete}
        />
      ) : null}

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

      {showOwnedPlaceEditor && ownedCurrentList ? (
        <PlaceEditorModal
          visible
          lat={place.lat}
          lng={place.lng}
          placeName={place.name}
          placeAddress={place.address}
          lists={ownedEditableLists}
          existingPlace={place}
          existingPlaceListName={ownedCurrentList.name}
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
          allowDownload={canDownloadOwnedPlaceMedia}
          items={media}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}

      {showReportSheet ? (
        <ReportActionSheet
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
    previous.markerContext === next.markerContext &&
    previous.locationPlaceCardsCount === next.locationPlaceCardsCount &&
    previous.locationOriginalPlaceName === next.locationOriginalPlaceName &&
    previous.onEdit === next.onEdit &&
    previous.onDelete === next.onDelete &&
    previous.onPlaceNamePress === next.onPlaceNamePress
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
    width: 44,
    height: 44,
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
