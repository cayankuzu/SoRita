import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, useWindowDimensions, View } from 'react-native';
import {
  ChevronUp,
  Ellipsis,
  Flag,
  MapPin,
  Pencil,
  Trash2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import {
  openStackScreen,
  useAppNavigation,
  useRootStackRoute,
} from '@/mobile/app/app-shell/navigation/navigation';
import type { Place } from '@/mobile/app/data/contracts/entities';
import {
  useDeleteListMutation,
  useUpdateListMutation,
} from '@/mobile/app/data/hooks/useListMutations';
import { useListDetailScreenState } from '@/mobile/app/features/lists/application/useListDetailScreenState';
import { ListEditorModal } from '@/mobile/app/features/lists/ui/components/ListEditorModal';
import { ListDetailHeader } from '@/mobile/app/features/lists/ui/components/ListDetailHeader';
import { ListDetailPlaceItem } from '@/mobile/app/features/lists/ui/components/ListDetailPlaceItem';
import { ListDetailPlacesSection } from '@/mobile/app/features/lists/ui/components/ListDetailPlacesSection';
import { listDetailScreenStyles as styles } from '@/mobile/app/features/lists/ui/components/listDetailScreenStyles';
import { PlaceEditorModal } from '@/mobile/app/features/map/public/components';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import {
  clearPersistedListEditorDraft,
  getPersistedListEditorDraft,
  type PersistedListEditorDraft,
} from '@/mobile/app/platform/storage/listEditorDraft';
import { ActionMenuSheet } from '@/mobile/app/shared/components/feedback/ActionMenuSheet';
import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { ImageLightbox } from '@/mobile/app/shared/components/feedback/ImageLightbox';
import { ReportActionSheet } from '@/mobile/app/shared/components/feedback/ReportActionSheet';
import { StackScreenHeader } from '@/mobile/app/shared/components/navigation/StackScreenHeader';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { ListDetailSkeleton } from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { useScreenPerformanceMetric } from '@/mobile/app/shared/performance/useScreenPerformanceMetric';
import { colors, iconSize } from '@/mobile/app/shared/theme/tokens';
import { buildAdaptiveFlatListProps } from '@/mobile/app/shared/utils/flatList';
import { buildLocationPlaceStats } from '@/mobile/app/shared/utils/format';

type ListDetailScreenContentProps = {
  listId: string;
  placeId?: string;
};

// A notification opens a list on the place it is about. The first attempt
// runs as the data lands, before the tall header and the rows below it are
// measured, and fails. Each retry first steps to the furthest measured row,
// which makes the list render the next ones, then aims for the place again.
const MAX_LIST_SCROLL_RETRIES = 6;
const LIST_SCROLL_RETRY_DELAY_MS = 120;

function recoverListScroll({
  highestMeasuredFrameIndex,
  index,
  listRef,
  retryCountRef,
  retryTimeoutRef,
}: {
  highestMeasuredFrameIndex: number;
  index: number;
  listRef: React.RefObject<FlatList<Place> | null>;
  retryCountRef: React.MutableRefObject<number>;
  retryTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}) {
  if (retryCountRef.current >= MAX_LIST_SCROLL_RETRIES) {
    retryCountRef.current = 0;
    return;
  }

  retryCountRef.current += 1;
  if (highestMeasuredFrameIndex >= 0 && highestMeasuredFrameIndex < index) {
    listRef.current?.scrollToIndex({ animated: false, index: highestMeasuredFrameIndex });
  }
  if (retryTimeoutRef.current) {
    clearTimeout(retryTimeoutRef.current);
  }
  retryTimeoutRef.current = setTimeout(() => {
    retryTimeoutRef.current = null;
    listRef.current?.scrollToIndex({
      animated: true,
      index,
      viewOffset: 12,
      viewPosition: 0.08,
    });
  }, LIST_SCROLL_RETRY_DELAY_MS);
}

function ListDetailLoadingState() {
  return (
    <Screen safeTop={false} padded={false} scroll={false}>
      <ListDetailSkeleton />
    </Screen>
  );
}

// A deleted or hidden list keeps the back bar the list itself has.
function ListDetailUnavailableState({
  errorMessage,
  onBack,
  onRetry,
}: {
  errorMessage?: string | null;
  onBack: () => void;
  onRetry: () => void;
}) {
  return (
    <Screen safeTop={false} padded={false} scroll={false}>
      <StackScreenHeader onBack={onBack} title={tr.common.list} />
      <View style={styles.unavailableBody}>
        <EmptyState
          icon={<MapPin color={errorMessage ? colors.danger : colors.textSoft} size={iconSize.xl} />}
          title={errorMessage ? tr.profile.error.contentUnavailable : tr.listDetail.notFoundTitle}
          description={errorMessage || tr.listDetail.notFoundDescription}
          actionLabel={errorMessage ? tr.common.retry : undefined}
          onAction={errorMessage ? onRetry : undefined}
          tone={errorMessage ? 'danger' : 'default'}
        />
      </View>
    </Screen>
  );
}

function ListDetailScreenContent({ listId, placeId }: ListDetailScreenContentProps) {
  const navigation = useAppNavigation();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { user } = useAuth();
  const listRef = React.useRef<FlatList<Place> | null>(null);
  const scrollRetryTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRetryCountRef = React.useRef(0);
  const [deleteListVisible, setDeleteListVisible] = useState(false);
  const [deletePlaceId, setDeletePlaceId] = useState<string | null>(null);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [highlightedPlaceId, setHighlightedPlaceId] = useState<string | null>(null);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [listActionMenuVisible, setListActionMenuVisible] = useState(false);
  const [editingListVisible, setEditingListVisible] = useState(false);
  const [listEditorResumeDraft, setListEditorResumeDraft] = useState<PersistedListEditorDraft | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportDetails, setReportDetails] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [showScrollTopButton, setShowScrollTopButton] = useState(false);
  const [pendingScrollTargetId, setPendingScrollTargetId] = useState<string | null>(null);
  const { mutateAsync: deleteListAsync } = useDeleteListMutation();
  const { mutateAsync: updateListAsync } = useUpdateListMutation();

  const {
    canReportList,
    deletePlace,
    displayPlaces,
    errorMessage,
    fetchNextPage,
    hasNextPage,
    hasPartialDataError,
    isFetchingNextPage,
    isInitialLoading,
    isOwner,
    list,
    mapPlaces,
    onRefresh,
    owner,
    placeMarkerColorsById,
    refreshing,
    reportList,
    retry,
  } = useListDetailScreenState({
    listId,
    user,
  });
  useScreenPerformanceMetric({
    hasContent: Boolean(list),
    hasError: Boolean(errorMessage),
    isLoading: isInitialLoading,
    screen: 'list-detail',
  });

  useEffect(() => {
    setHighlightedPlaceId(placeId ?? null);
    setPendingScrollTargetId(placeId ?? null);
    scrollRetryCountRef.current = 0;
  }, [placeId, listId]);

  useEffect(
    () => () => {
      if (scrollRetryTimeoutRef.current) {
        clearTimeout(scrollRetryTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    setListEditorResumeDraft(null);
    setEditingListVisible(false);

    if (!user?.id) {
      return;
    }

    let active = true;
    const ownerUserId = user.id;

    void getPersistedListEditorDraft(ownerUserId, listId).then((draft) => {
      if (!active || !draft) {
        return;
      }

      setListEditorResumeDraft(draft);
      setEditingListVisible(true);
    });

    return () => {
      active = false;
    };
  }, [listId, user?.id]);

  const highlightedIndex = useMemo(() => {
    if (!list || !highlightedPlaceId) {
      return null;
    }

    const index = displayPlaces.findIndex((place) => place.id === highlightedPlaceId);
    return index >= 0 ? index : null;
  }, [displayPlaces, highlightedPlaceId, list]);
  const listProps = useMemo(
    () =>
      buildAdaptiveFlatListProps<Place>({
        containsNativeMaps: true,
        itemCount: displayPlaces.length,
        viewportHeight: height,
        viewportWidth: width,
      }),
    [displayPlaces.length, height, width],
  );
  const locationStatsByKey = useMemo(
    () => buildLocationPlaceStats(displayPlaces),
    [displayPlaces],
  );

  const requestDeletePlace = (placeIdToDelete: string) => {
    setDeletePlaceId(placeIdToDelete);
  };
  const handleHighlightPlace = React.useCallback((nextPlaceId: string | null) => {
    setHighlightedPlaceId(nextPlaceId);
    setPendingScrollTargetId(nextPlaceId);
  }, []);

  const handleScroll = (offsetY: number) => {
    const shouldShow = offsetY > 280;
    setShowScrollTopButton((current) => (current === shouldShow ? current : shouldShow));
  };

  useEffect(() => {
    if (!pendingScrollTargetId) {
      return;
    }

    const targetIndex = displayPlaces.findIndex((place) => place.id === pendingScrollTargetId);
    if (targetIndex < 0) {
      if (isInitialLoading) {
        return;
      }
      if (hasNextPage && !isFetchingNextPage && fetchNextPage) {
        void fetchNextPage();
      } else if (hasNextPage === false) {
        setPendingScrollTargetId((current) =>
          current === pendingScrollTargetId ? null : current,
        );
      }
      return;
    }

    const frameId = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index: targetIndex,
        animated: true,
        viewOffset: 12,
        viewPosition: 0.08,
      });
      setPendingScrollTargetId((current) =>
        current === pendingScrollTargetId ? null : current,
      );
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [
    displayPlaces,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isInitialLoading,
    pendingScrollTargetId,
  ]);

  const confirmDeletePlace = async () => {
    if (!list || !deletePlaceId) {
      return;
    }

    await deletePlace(deletePlaceId);
    setDeletePlaceId(null);
    showToast(tr.listDetail.deletePlaceSuccess, 'success');
  };

  const confirmDeleteList = async () => {
    if (!list || !user?.id) {
      return;
    }

    await deleteListAsync(list.id);
    await clearPersistedListEditorDraft(user.id, list.id);
    setDeleteListVisible(false);
    setListActionMenuVisible(false);
    navigation.goBack();
    showToast(tr.profile.toast.listDeleted, 'success');
  };

  const handleReportList = async () => {
    if (!list || !user || !reportReason) {
      return;
    }

    try {
      await reportList(reportReason, reportDetails.trim() || undefined);
      setReportVisible(false);
      setReportDetails('');
      setReportReason('');
      showToast(tr.cards.reportSent, 'success');
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error.code === 'duplicate_report' || error.code === '23505')
      ) {
        showToast(tr.listDetail.reportDuplicate, 'error');
        return;
      }

      showToast(error instanceof Error ? error.message : tr.listDetail.reportFailed, 'error');
    }
  };

  const savePlaceEdits = async (
    placeData: Omit<Place, 'id' | 'addedAt'>,
    _targetListIds?: string[],
  ) => {
    if (!list || !editingPlace) {
      return;
    }

    const nextUpdatedAt = new Date().toISOString();
    const nextPlace: Place = {
      ...placeData,
      id: editingPlace.id,
      addedAt: editingPlace.addedAt,
      updatedAt: nextUpdatedAt,
      addedBy: editingPlace.addedBy || placeData.addedBy,
    };

    const nextList = {
      ...list,
      places: list.places.map((item) => (item.id === editingPlace.id ? nextPlace : item)),
      updatedAt: list.updatedAt,
    };

    await updateListAsync({ list: nextList, previousList: list });
    setEditingPlace(null);
    showToast(tr.profile.toast.placeUpdated, 'success');
  };

  if (isInitialLoading) {
    return <ListDetailLoadingState />;
  }

  if (!list) {
    return (
      <ListDetailUnavailableState
        errorMessage={errorMessage}
        onBack={() => navigation.goBack()}
        onRetry={retry}
      />
    );
  }

  const actionItems = [
    isOwner
      ? {
          key: 'edit',
          label: tr.common.edit,
          renderIcon: (color: string) => <Pencil color={color} size={iconSize.sm} />,
          onPress: () => {
            setListActionMenuVisible(false);
            setListEditorResumeDraft(null);
            setEditingListVisible(true);
          },
        }
      : null,
    isOwner
      ? {
          key: 'delete',
          label: tr.common.delete,
          renderIcon: (color: string) => <Trash2 color={color} size={iconSize.sm} />,
          tone: 'danger' as const,
          onPress: () => {
            setListActionMenuVisible(false);
            setDeleteListVisible(true);
          },
        }
      : null,
    canReportList
      ? {
          key: 'report',
          label: tr.profile.actions.report,
          renderIcon: (color: string) => <Flag color={color} size={iconSize.sm} />,
          tone: 'danger' as const,
          onPress: () => {
            setListActionMenuVisible(false);
            setReportVisible(true);
          },
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const handleCloseListEditor = () => {
    setEditingListVisible(false);
    setListEditorResumeDraft(null);
    if (user?.id) {
      void clearPersistedListEditorDraft(user.id, list.id);
    }
  };

  return (
    <Screen safeTop={false} padded={false} scroll={false}>
      <View style={styles.screenShell}>
        <StackScreenHeader
          onBack={() => navigation.goBack()}
          title={tr.common.list}
          subtitle={tr.cards.placesCount(displayPlaces.length)}
          rightAction={actionItems.length > 0 ? (
            <IconButton
              accessibilityLabel={tr.common.contentActionsTitle}
              onPress={() => setListActionMenuVisible(true)}
            >
              <Ellipsis color={colors.text} size={iconSize.sm} />
            </IconButton>
          ) : undefined}
        />

        <FlatList
          {...listProps}
          ref={listRef}
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          data={displayPlaces}
          keyExtractor={(place) => place.id}
          renderItem={({ item: place }) => (
            <ListDetailPlaceItem
              highlighted={highlightedPlaceId === place.id}
              isOwner={isOwner}
              listCoverImage={list.coverImage}
              listEmoji={list.emoji}
              listId={list.id}
              listIsPublic={list.isPublic}
              listName={list.name}
              locationStatsByKey={locationStatsByKey}
              markerColor={placeMarkerColorsById.get(place.id)}
              onDeletePlace={requestDeletePlace}
              onEditPlace={setEditingPlace}
              onOpenOwnerProfile={
                owner ? () => openStackScreen(navigation, 'UserProfile', { userId: owner.id }) : undefined
              }
              owner={owner}
              ownerId={list.userId}
              place={place}
            />
          )}
          ListHeaderComponent={
            <View style={styles.feed}>
              <ListDetailHeader
                list={list}
                onOpenCover={() => list.coverImage && setLightboxUri(list.coverImage)}
              />
              <ListDetailPlacesSection
                list={list}
                displayPlaces={displayPlaces}
                mapPlaces={mapPlaces}
                highlightedIndex={highlightedIndex}
                highlightedPlaceId={highlightedPlaceId}
                owner={owner}
                isOwner={isOwner}
                onHighlightPlace={handleHighlightPlace}
                onOpenOwnerProfile={() =>
                  owner && openStackScreen(navigation, 'UserProfile', { userId: owner.id })
                }
              />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                icon={<MapPin color={colors.textSoft} size={iconSize.xl} />}
                title={tr.listDetail.emptyTitle}
                description={
                  isOwner
                    ? tr.listDetail.emptyOwnerDescription
                    : tr.listDetail.emptyDescription
                }
              />
            </View>
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View
                accessible
                accessibilityLabel={tr.common.loadingMore}
                accessibilityLiveRegion="polite"
                accessibilityRole="progressbar"
                accessibilityState={{ busy: true }}
                style={styles.feedLoader}
              >
                <ActivityIndicator color={colors.primary} size="small" />
              </View>
            ) : hasPartialDataError && errorMessage ? (
              <View style={styles.emptyWrap}>
                <InlineNotice
                  tone="warning"
                  title={tr.profile.error.contentUnavailable}
                  description={errorMessage}
                  actionLabel={tr.common.retry}
                  onAction={retry}
                />
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReached={() => {
            if (!hasNextPage || isFetchingNextPage || !fetchNextPage) {
              return;
            }

            void fetchNextPage();
          }}
          onEndReachedThreshold={0.45}
          onScroll={(event) => {
            handleScroll(event.nativeEvent.contentOffset.y);
          }}
          onScrollToIndexFailed={({ highestMeasuredFrameIndex, index }) => {
            recoverListScroll({
              highestMeasuredFrameIndex,
              index,
              listRef,
              retryCountRef: scrollRetryCountRef,
              retryTimeoutRef: scrollRetryTimeoutRef,
            });
          }}
        />

        {showScrollTopButton ? (
          <InstantPressable
            accessibilityLabel={tr.common.scrollToTop}
            accessibilityRole="button"
            onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
            style={[styles.scrollTopButton, { bottom: Math.max(insets.bottom, 18) + 16 }]}
          >
            <ChevronUp color={colors.onPrimary} size={iconSize.md} />
          </InstantPressable>
        ) : null}
      </View>

      {deleteListVisible ? (
        <ConfirmActionModal
          visible
          title={tr.profile.deleteList.title}
          description={tr.profile.deleteList.description}
          confirmLabel={tr.common.delete}
          confirmVariant="danger"
          onClose={() => setDeleteListVisible(false)}
          onConfirm={confirmDeleteList}
        />
      ) : null}

      {deletePlaceId ? (
        <ConfirmActionModal
          visible
          title={tr.listDetail.deletePlaceTitle}
          description={tr.listDetail.deletePlaceDescription}
          confirmLabel={tr.common.delete}
          confirmVariant="danger"
          onClose={() => setDeletePlaceId(null)}
          onConfirm={confirmDeletePlace}
        />
      ) : null}

      {listActionMenuVisible ? (
        <ActionMenuSheet
          visible
          title={list.name}
          items={actionItems}
          onClose={() => setListActionMenuVisible(false)}
        />
      ) : null}

      {lightboxUri ? (
        <ImageLightbox
          allowDownload={isOwner}
          uri={lightboxUri}
          onClose={() => setLightboxUri(null)}
        />
      ) : null}
      {reportVisible ? (
        <ReportActionSheet
          visible
          targetType="list"
          title={tr.listDetail.reportTitle}
          description={tr.listDetail.reportDescription}
          reportDetails={reportDetails}
          reportReason={reportReason}
          onReportDetailsChange={setReportDetails}
          onReportReasonChange={setReportReason}
          onClose={() => {
            setReportVisible(false);
            setReportDetails('');
            setReportReason('');
          }}
          onSubmit={handleReportList}
        />
      ) : null}

      {editingListVisible && user ? (
        <ListEditorModal
          visible
          list={list}
          ownerUserId={user.id}
          resumeDraft={listEditorResumeDraft}
          onClose={handleCloseListEditor}
          onSave={async (nextList) => {
            await updateListAsync({ list: nextList, previousList: list });
            await clearPersistedListEditorDraft(user.id, nextList.id);
            setEditingListVisible(false);
            setListEditorResumeDraft(null);
            showToast(tr.profile.toast.listUpdated, 'success');
          }}
        />
      ) : null}

      {editingPlace ? (
        <PlaceEditorModal
          visible
          lat={editingPlace.lat}
          lng={editingPlace.lng}
          placeName={editingPlace.name}
          placeAddress={editingPlace.address}
          lists={[list]}
          existingPlace={editingPlace}
          existingPlaceListName={list.name}
          onClose={() => setEditingPlace(null)}
          onDelete={async (placeId) => {
            await deletePlace(placeId);
            setEditingPlace(null);
            showToast(tr.profile.toast.placeDeleted, 'success');
          }}
          onSave={async (placeData) => {
            await savePlaceEdits(placeData);
          }}
        />
      ) : null}
    </Screen>
  );
}

export function ListDetailScreen() {
  const route = useRootStackRoute<'ListDetail'>();
  const listId = route.params?.listId ?? '';
  const placeId = route.params?.placeId;

  return <ListDetailScreenContent listId={listId} placeId={placeId} />;
}
