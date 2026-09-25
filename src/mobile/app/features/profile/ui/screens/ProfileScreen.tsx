import React, { startTransition, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image as ImageIcon, MapPin } from 'lucide-react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import {
  openStackScreen,
  useAppNavigation,
} from '@/mobile/app/app-shell/navigation/navigation';
import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import { PlaceFeedScreen } from '@/mobile/app/features/places/public/feed';
import { buildOwnedPlaceListUpdates } from '@/mobile/app/features/places/public/ownedPlaceListUpdates';
import { useOwnProfileScreenState } from '@/mobile/app/features/profile/application/useOwnProfileScreenState';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { PlaceEditorModal } from '@/mobile/app/features/map/public/components';
import { ProfileConnectionsSummary } from '@/mobile/app/features/profile/ui/components/ProfileConnectionsSummary';
import {
  ProfileContentPager,
  type ProfileContentTab,
  type ProfileGridItem,
} from '@/mobile/app/features/profile/ui/components/ProfileContentPager';
import { OwnProfileActionBar } from '@/mobile/app/features/profile/ui/components/OwnProfileActionBar';
import { ProfilePagedScrollContainer } from '@/mobile/app/features/profile/ui/components/ProfilePagedScrollContainer';
import { ImageLightbox } from '@/mobile/app/shared/components/feedback/ImageLightbox';
import { OverlayHost } from '@/mobile/app/shared/components/navigation/OverlayHost';
import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { MosaicGridSkeleton, ProfileSkeleton } from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { useTabReselect } from '@/mobile/app/shared/hooks/useTabReselect';
import {
  useProfileTabPager,
  useProfileTabState,
} from '@/mobile/app/features/profile/ui/components/useProfileTabPager';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize, spacing } from '@/mobile/app/shared/theme/tokens';
import { ProfileHero } from '@/mobile/app/features/profile/ui/components/ProfileHero';
import { ProfileConnectionsModal } from '@/mobile/app/features/profile/ui/components/ProfileConnectionsModal';
import { ProfileFilteredEmptyState } from '@/mobile/app/features/profile/ui/components/ProfileFilteredEmptyState';
import {
  ProfileTabs,
  type ProfileVisibilityFilter,
} from '@/mobile/app/features/profile/ui/components/ProfileTabs';
import { useScreenPerformanceMetric } from '@/mobile/app/shared/performance/useScreenPerformanceMetric';

type ProfileTab = ProfileContentTab;
const PROFILE_VISIBILITY_OPTIONS: Array<{
  key: ProfileVisibilityFilter;
  label: string;
}> = [
  { key: 'all', label: tr.map.filterAll },
  { key: 'public', label: tr.listDetail.public },
  { key: 'private', label: tr.listDetail.private },
];

function matchesVisibilityFilter(
  isPublic: boolean,
  filter: ProfileVisibilityFilter,
) {
  if (filter === 'all') {
    return true;
  }

  return filter === 'public' ? isPublic : !isPublic;
}

export function ProfileScreen() {
  const navigation = useAppNavigation();
  const { user } = useAuth();
  const tabState = useProfileTabState();
  const { activeTab, pagerProgress, profileListRef, visibleTab } = tabState;
  const [visibilityFilter, setVisibilityFilter] =
    useState<ProfileVisibilityFilter>('all');
  const [showVisibilityFilterMenu, setShowVisibilityFilterMenu] =
    useState(false);
  const [deletePlaceId, setDeletePlaceId] = useState<string | null>(null);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [feedMode, setFeedMode] = useState<{
    startIndex: number;
    kind: 'gallery' | 'places';
  } | null>(null);
  const [connectionMode, setConnectionMode] = useState<
    'followers' | 'following' | null
  >(null);
  const [editingPlaceTarget, setEditingPlaceTarget] = useState<{
    list: PlaceList;
    place: Place;
  } | null>(null);
  const {
    allPhotos,
    allPlaces,
    createList,
    deletePlace,
    errorMessage,
    fetchNextPage,
    followerCount,
    followerUsers,
    followingCount,
    followingUsers,
    freshUser,
    hasNextPage,
    hasPartialDataError,
    isContentComplete,
    isFetchingNextPage,
    isInitialLoading,
    lists,
    onRefresh,
    refreshing,
    retry,
    tabTotals,
    updateLists,
  } = useOwnProfileScreenState({ activeTab, user });
  const filteredLists = useMemo(
    () =>
      lists.filter((list) =>
        matchesVisibilityFilter(list.isPublic, visibilityFilter),
      ),
    [lists, visibilityFilter],
  );
  const filteredPlaces = useMemo(
    () =>
      allPlaces.filter((item) =>
        matchesVisibilityFilter(item.listIsPublic, visibilityFilter),
      ),
    [allPlaces, visibilityFilter],
  );
  const filteredPhotos = useMemo(
    () =>
      allPhotos.filter((item) =>
        matchesVisibilityFilter(item.listIsPublic, visibilityFilter),
      ),
    [allPhotos, visibilityFilter],
  );
  const hasAnyContent =
    lists.length > 0 || allPlaces.length > 0 || allPhotos.length > 0;
  useScreenPerformanceMetric({
    hasContent: hasAnyContent,
    hasError: Boolean(errorMessage),
    isLoading: isInitialLoading,
    screen: 'profile',
  });
  const shouldShowErrorState = Boolean(errorMessage && !hasAnyContent);
  const pagerSwipeEnabled = ![
    refreshing,
    deletePlaceId,
    editingPlaceTarget,
    lightboxUri,
    connectionMode,
  ].some(Boolean);
  const dataByTab = {
    gallery: filteredPhotos,
    lists: filteredLists,
    places: filteredPlaces,
  } satisfies Record<ProfileTab, ProfileGridItem[]>;

  const closeVisibilityFilterMenu = useCallback(() => {
    setShowVisibilityFilterMenu(false);
  }, []);
  const {
    handlePageProgressChange,
    handleProfileEndReached,
    handleTabChange,
    handleTabPreviewChange,
    pagerTabs,
    tabs,
  } = useProfileTabPager({
    counts: {
      gallery: {
        complete: isContentComplete.places,
        loaded: filteredPhotos.length,
        total: visibilityFilter !== 'all' ? undefined : tabTotals.gallery,
      },
      lists: {
        complete: isContentComplete.lists,
        loaded: filteredLists.length,
        total: visibilityFilter !== 'all' ? undefined : tabTotals.lists,
      },
      places: {
        complete: isContentComplete.places,
        loaded: filteredPlaces.length,
        total: visibilityFilter !== 'all' ? undefined : tabTotals.places,
      },
    },
    onTabPress: closeVisibilityFilterMenu,
    pagination: { fetchNextPage, hasNextPage, isFetchingNextPage },
    tabState,
  });
  useTabReselect(Boolean(feedMode), () => setFeedMode(null));

  if (isInitialLoading) {
    return (
      <Screen safeTop={false} padded={false} scroll={false}>
        <ProfileSkeleton />
      </Screen>
    );
  }

  const confirmDeletePlace = async () => {
    if (!deletePlaceId) {
      return;
    }

    await deletePlace(deletePlaceId);
    setDeletePlaceId(null);
    showToast(tr.profile.toast.placeDeleted, 'success');
  };

  const savePlaceEdits = async (
    placeData: Omit<Place, 'id' | 'addedAt'>,
    targetListIds: string[],
  ) => {
    if (!editingPlaceTarget) {
      return;
    }

    const nextUpdatedAt = new Date().toISOString();
    const changedLists = buildOwnedPlaceListUpdates({
      editableLists: lists,
      place: editingPlaceTarget.place,
      placeData,
      targetListIds,
      updatedAt: nextUpdatedAt,
    });

    await updateLists(changedLists);

    setEditingPlaceTarget(null);
    showToast(tr.profile.toast.placeUpdated, 'success');
  };

  const deleteEditedPlace = async (placeId: string) => {
    await deletePlace(placeId);

    setEditingPlaceTarget(null);
    showToast(tr.profile.toast.placeDeleted, 'success');
  };

  if (!freshUser) {
    if (errorMessage) {
      return (
        <Screen>
          <EmptyState
            icon={<MapPin color={colors.danger} size={iconSize.xl} />}
            title={tr.profile.error.ownUnavailable}
            description={errorMessage}
            actionLabel={tr.common.retry}
            onAction={retry}
            tone="danger"
          />
        </Screen>
      );
    }

    return (
      <Screen safeTop={false} padded={false} scroll={false}>
        <ProfileSkeleton />
      </Screen>
    );
  }

  const openEditingPlaceTarget = (listId: string, placeId: string) => {
    const targetList = lists.find((list) => list.id === listId);
    const targetPlace = targetList?.places.find(
      (place) => place.id === placeId,
    );

    if (!targetList || !targetPlace) {
      return;
    }

    setEditingPlaceTarget({ list: targetList, place: targetPlace });
  };

  // Opened over the grid rather than in its place, so the grid keeps its
  // scroll, and the delete and edit sheets below serve the feed too.
  const feedOverlay = feedMode ? (
    <PlaceFeedScreen
      // The Profile tab's header already clears the status bar; clearing it
      // again left a grey band above "Galeri".
      safeTop={false}
      title={
        feedMode.kind === 'places'
          ? tr.profile.feedTitle.places
          : tr.profile.feedTitle.gallery
      }
      items={feedMode.kind === 'places' ? filteredPlaces : filteredPhotos}
      startIndex={feedMode.startIndex}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onBack={() => setFeedMode(null)}
      onDeletePlace={(item) => {
        setDeletePlaceId(item.place.id);
      }}
      onEditPlace={(item) => {
        openEditingPlaceTarget(item.listId, item.place.id);
      }}
      onOpenListDetail={(item) =>
        openStackScreen(navigation, 'ListDetail', {
          listId: item.listId,
          placeId: item.place.id,
        })
      }
    />
  ) : null;

  const renderEmptyState = (tab: ProfileTab) => {
    // The summary already counted this tab's content: an empty list means it
    // has not arrived yet, not that there is none. "Henüz fotoğraf yok" under
    // a Galeri tab reading 31 was the result.
    if (!shouldShowErrorState && visibilityFilter === 'all' && (tabTotals[tab] ?? 0) > 0) {
      return <MosaicGridSkeleton rows={3} />;
    }

    if (shouldShowErrorState) {
      return (
        <EmptyState
          icon={<MapPin color={colors.danger} size={iconSize.xl} />}
          title={tr.profile.error.contentUnavailable}
          description={errorMessage || tr.profile.error.loadingUnavailable}
          actionLabel={tr.common.retry}
          onAction={retry}
          tone="danger"
        />
      );
    }

    if (visibilityFilter !== 'all') {
      return (
        <ProfileFilteredEmptyState
          onShowAll={() => setVisibilityFilter('all')}
          tab={tab}
          visibility={visibilityFilter}
        />
      );
    }

    if (tab === 'lists') {
      return (
        <EmptyState
          icon={<MapPin color={colors.textSoft} size={iconSize.xl} />}
          title={tr.profile.empty.myNoList}
          description={tr.profile.empty.myNoListDescription}
        />
      );
    }

    if (tab === 'places') {
      return (
        <EmptyState
          icon={<MapPin color={colors.textSoft} size={iconSize.xl} />}
          title={tr.profile.empty.myNoPlace}
          description={tr.profile.empty.myNoPlaceDescription}
        />
      );
    }

    return (
      <EmptyState
        icon={<ImageIcon color={colors.textSoft} size={iconSize.xl} />}
        title={tr.profile.empty.myNoPhoto}
        description={tr.profile.empty.myNoPhotoDescription}
      />
    );
  };

  const renderProfileHero = () => (
      <ProfileHero
        name={freshUser.name}
        username={freshUser.username}
        bio={freshUser.bio}
        profilePhoto={freshUser.profilePhoto}
        coverPhoto={freshUser.coverPhoto}
        coverBackgroundColor={colors.coverFallback}
        detailsContent={
          <ProfileConnectionsSummary
            interestIds={freshUser.interests}
            followerCount={followerCount}
            followingCount={followingCount}
            onOpenFollowers={() => setConnectionMode('followers')}
            onOpenFollowing={() => setConnectionMode('following')}
          />
        }
        onProfilePhotoPress={() =>
          freshUser.profilePhoto && setLightboxUri(freshUser.profilePhoto)
        }
        onCoverPhotoPress={() =>
          freshUser.coverPhoto && setLightboxUri(freshUser.coverPhoto)
        }
        action={
          <OwnProfileActionBar
            onOpenSettings={() => openStackScreen(navigation, 'Settings')}
          />
        }
      />
  );

  // Stays on screen when the hero scrolls away, so the tabs are always there.
  const renderProfileStickyHeader = () => (
    <View style={styles.stickyHeader}>
      <ProfileTabs
        activeTab={visibleTab}
        activeFilter={visibilityFilter}
        filterOpen={showVisibilityFilterMenu}
        progressIndex={pagerProgress}
        onChange={handleTabChange}
        onFilterChange={(filter) => {
          startTransition(() => {
            setVisibilityFilter(filter);
            setShowVisibilityFilterMenu(false);
          });
        }}
        onFilterToggle={() =>
          setShowVisibilityFilterMenu((current) => !current)
        }
        filterOptions={PROFILE_VISIBILITY_OPTIONS}
        tabs={tabs}
      />

      <View style={styles.headerContent}>
        {hasPartialDataError && hasAnyContent ? (
          <View style={styles.noticeWrap}>
            <InlineNotice
              tone="warning"
              title={tr.profile.error.partialTitle}
              description={tr.profile.error.partialDescription}
              actionLabel={tr.common.retry}
              onAction={() => {
                void retry();
              }}
            />
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <>
      <OverlayHost overlay={feedOverlay}>
        <Screen safeTop={false} padded={false} scroll={false}>
          <ProfilePagedScrollContainer
            pager={
              <ProfileContentPager
                activeTab={activeTab}
                dataByTab={dataByTab}
                emptyStateForTab={renderEmptyState}
                enabled={pagerSwipeEnabled}
                header={renderProfileHero()}
                stickyHeader={renderProfileStickyHeader()}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                listRef={profileListRef}
                onEndReached={handleProfileEndReached}
                onListPress={(list) =>
                  openStackScreen(navigation, 'ListDetail', { listId: list.id })
                }
                onPageProgressChange={handlePageProgressChange}
                onPlacePress={(tab, index) =>
                  setFeedMode({
                    startIndex: index,
                    kind: tab === 'gallery' ? 'gallery' : 'places',
                  })
                }
                onRefresh={onRefresh}
                onTabChange={handleTabChange}
                onTabPreviewChange={handleTabPreviewChange}
                refreshing={refreshing}
                shouldShowErrorState={shouldShowErrorState}
                showPrivacyBadge
                tabs={pagerTabs}
              />
            }
          />
        </Screen>
      </OverlayHost>

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

      {lightboxUri ? (
        <ImageLightbox
          allowDownload={Boolean(user && freshUser.id === user.id)}
          uri={lightboxUri}
          onClose={() => setLightboxUri(null)}
        />
      ) : null}
      {editingPlaceTarget ? (
        <PlaceEditorModal
          visible
          lat={editingPlaceTarget.place.lat}
          lng={editingPlaceTarget.place.lng}
          placeName={editingPlaceTarget.place.name}
          placeAddress={editingPlaceTarget.place.address}
          lists={lists}
          existingPlace={editingPlaceTarget.place}
          existingPlaceListName={editingPlaceTarget.list.name}
          onClose={() => setEditingPlaceTarget(null)}
          onSave={savePlaceEdits}
          onDelete={deleteEditedPlace}
          onCreateList={async (list) => {
            await createList(list);
          }}
        />
      ) : null}

      {connectionMode ? (
        <ProfileConnectionsModal
          visible
          title={
            connectionMode === 'followers'
              ? tr.profile.connections.followers
              : tr.profile.connections.following
          }
          users={
            connectionMode === 'followers' ? followerUsers : followingUsers
          }
          emptyTitle={
            connectionMode === 'followers'
              ? tr.profile.connections.emptyFollowers
              : tr.profile.connections.emptyFollowing
          }
          refreshing={refreshing}
          onRefresh={onRefresh}
          onClose={() => setConnectionMode(null)}
          onUserPress={(selectedUser) => {
            setConnectionMode(null);
            if (selectedUser.id !== freshUser.id) {
              openStackScreen(navigation, 'UserProfile', {
                userId: selectedUser.id,
              });
            }
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  headerContent: {
    paddingTop: spacing.md,
  },
  stickyHeader: {
    backgroundColor: colors.surface,
  },
  noticeWrap: {
    paddingBottom: spacing.md,
  },
});
