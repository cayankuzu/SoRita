import React, { startTransition, useCallback, useMemo, useState } from 'react';
import { useScrollToTop } from '@react-navigation/native';
import { Animated, StyleSheet, View } from 'react-native';
import type { FlatList } from 'react-native';
import { Image as ImageIcon, List, MapPin } from 'lucide-react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import {
  openStackScreen,
  useAppNavigation,
} from '@/mobile/app/app-shell/navigation/navigation';
import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
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
import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { ProfileSkeleton } from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { ProfileFeedScreen } from '@/mobile/app/features/profile/ui/components/ProfileFeedScreen';
import { ProfileHero } from '@/mobile/app/features/profile/ui/components/ProfileHero';
import { ProfileConnectionsModal } from '@/mobile/app/features/profile/ui/components/ProfileConnectionsModal';
import {
  ProfileTabs,
  type ProfileTabOption,
  type ProfileVisibilityFilter,
} from '@/mobile/app/features/profile/ui/components/ProfileTabs';
import { estimateProfilePagerHeights } from '@/mobile/app/features/profile/ui/profilePagerLayout';
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
  const { columnCount, columnGap, screenPadding, width } = useAppLayout();
  const profileListRef = React.useRef<FlatList<'profile-content'> | null>(null);
  const pagerProgress = React.useRef(new Animated.Value(0)).current;
  const [activeTab, setActiveTab] = useState<ProfileTab>('lists');
  const [visibleTab, setVisibleTab] = useState<ProfileTab>('lists');
  const [measuredPagerHeights, setMeasuredPagerHeights] = useState<
    Partial<Record<ProfileTab, number>>
  >({});
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
    isFetchingNextPage,
    isInitialLoading,
    lists,
    onRefresh,
    refreshing,
    retry,
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

  const tabs = useMemo<ProfileTabOption[]>(
    () => [
      {
        key: 'lists',
        label: tr.profile.tabs.lists,
        count: filteredLists.length,
        renderIcon: (active) => (
          <List color={active ? colors.primary : colors.textSoft} size={15} />
        ),
      },
      {
        key: 'places',
        label: tr.profile.tabs.places,
        count: filteredPlaces.length,
        renderIcon: (active) => (
          <MapPin color={active ? colors.primary : colors.textSoft} size={15} />
        ),
      },
      {
        key: 'gallery',
        label: tr.profile.tabs.gallery,
        count: filteredPhotos.length,
        renderIcon: (active) => (
          <ImageIcon
            color={active ? colors.primary : colors.textSoft}
            size={15}
          />
        ),
      },
    ],
    [filteredLists.length, filteredPhotos.length, filteredPlaces.length],
  );
  const pagerTabs = useMemo(
    () => tabs.map((tab) => ({ key: tab.key as ProfileTab, label: tab.label })),
    [tabs],
  );
  const pagerHeights = useMemo(
    () =>
      estimateProfilePagerHeights({
        columnCount,
        columnGap,
        hasNextPage,
        pageWidth: width,
        screenPadding,
        tabs: {
          gallery: filteredPhotos,
          lists: filteredLists,
          places: filteredPlaces,
        },
      }),
    [
      columnCount,
      columnGap,
      filteredLists,
      filteredPhotos,
      filteredPlaces,
      hasNextPage,
      screenPadding,
      width,
    ],
  );
  const pagerHeight = Math.max(
    measuredPagerHeights[activeTab] ?? pagerHeights[activeTab],
    measuredPagerHeights[visibleTab] ?? pagerHeights[visibleTab],
  );
  useScrollToTop(profileListRef as React.RefObject<FlatList>);

  React.useEffect(() => {
    setMeasuredPagerHeights({});
  }, [
    filteredLists.length,
    filteredPhotos.length,
    filteredPlaces.length,
    hasNextPage,
    visibilityFilter,
  ]);

  const scrollProfileToTop = useCallback(() => {
    profileListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const setPagerProgressForTab = useCallback(
    (tab: ProfileTab) => {
      const nextIndex = Math.max(
        0,
        pagerTabs.findIndex((pagerTab) => pagerTab.key === tab),
      );
      pagerProgress.setValue(nextIndex);
    },
    [pagerProgress, pagerTabs],
  );
  const handlePageProgressChange = useCallback(
    (pageOffset: number) => {
      pagerProgress.setValue(pageOffset);
    },
    [pagerProgress],
  );
  const handlePagerContentHeightChange = useCallback(
    (tab: ProfileTab, height: number) => {
      if (height <= 0) {
        return;
      }

      setMeasuredPagerHeights((currentHeights) => {
        const currentHeight = currentHeights[tab];

        if (currentHeight && Math.abs(currentHeight - height) < 1) {
          return currentHeights;
        }

        return {
          ...currentHeights,
          [tab]: height,
        };
      });
    },
    [],
  );

  const handleTabChange = useCallback(
    (key: string) => {
      const nextTab = key as ProfileTab;
      setPagerProgressForTab(nextTab);

      if (nextTab === activeTab) {
        scrollProfileToTop();
        setShowVisibilityFilterMenu(false);
        return;
      }

      setVisibleTab(nextTab);
      setActiveTab(nextTab);
      setShowVisibilityFilterMenu(false);
    },
    [activeTab, scrollProfileToTop, setPagerProgressForTab],
  );
  const handleTabPreviewChange = useCallback((key: ProfileTab) => {
    setVisibleTab(key);
  }, []);
  const handleProfileEndReached = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }

    void fetchNextPage?.();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

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
            icon={<MapPin color={colors.danger} size={32} />}
            title={tr.profile.error.ownUnavailable}
            description={errorMessage}
            actionLabel={tr.common.retry}
            onAction={retry}
            tone="danger"
          />
        </Screen>
      );
    }

    return null;
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

  if (feedMode) {
    const feedItems =
      feedMode.kind === 'places' ? filteredPlaces : filteredPhotos;
    const feedTitle =
      feedMode.kind === 'places'
        ? tr.profile.feedTitle.places
        : tr.profile.feedTitle.gallery;

    return (
      <ProfileFeedScreen
        title={feedTitle}
        items={feedItems}
        startIndex={feedMode.startIndex}
        refreshing={refreshing}
        onRefresh={onRefresh}
        owner={freshUser}
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
    );
  }

  const renderEmptyState = (tab: ProfileTab) => {
    if (shouldShowErrorState) {
      return (
        <EmptyState
          icon={<MapPin color={colors.danger} size={32} />}
          title={tr.profile.error.contentUnavailable}
          description={errorMessage || tr.profile.error.loadingUnavailable}
          actionLabel={tr.common.retry}
          onAction={retry}
          tone="danger"
        />
      );
    }

    if (tab === 'lists') {
      return (
        <EmptyState
          icon={<MapPin color={colors.textSoft} size={32} />}
          title={tr.profile.empty.myNoList}
          description={tr.profile.empty.myNoListDescription}
        />
      );
    }

    if (tab === 'places') {
      return (
        <EmptyState
          icon={<MapPin color={colors.textSoft} size={32} />}
          title={tr.profile.empty.myNoPlace}
          description={tr.profile.empty.myNoPlaceDescription}
        />
      );
    }

    return (
      <EmptyState
        icon={<ImageIcon color={colors.textSoft} size={32} />}
        title={tr.profile.empty.myNoPhoto}
        description={tr.profile.empty.myNoPhotoDescription}
      />
    );
  };

  const renderProfileHeader = () => (
    <View>
      <ProfileHero
        name={freshUser.name}
        username={freshUser.username}
        bio={freshUser.bio}
        profilePhoto={freshUser.profilePhoto}
        coverPhoto={freshUser.coverPhoto}
        coverBackgroundColor={colors.ownProfileCover}
        stats={[]}
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
      <Screen safeTop={false} padded={false} scroll={false}>
        <ProfilePagedScrollContainer
          header={renderProfileHeader()}
          listRef={profileListRef}
          onEndReached={handleProfileEndReached}
          onRefresh={onRefresh}
          pagerHeight={pagerHeight}
          pager={
            <ProfileContentPager
              activeTab={activeTab}
              dataByTab={dataByTab}
              emptyStateForTab={renderEmptyState}
              enabled={pagerSwipeEnabled}
              filteredLists={filteredLists}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onContentHeightChange={handlePagerContentHeightChange}
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
              onTabChange={handleTabChange}
              onTabPreviewChange={handleTabPreviewChange}
              pagerHeight={pagerHeight}
              shouldShowErrorState={shouldShowErrorState}
              showPrivacyBadge
              tabs={pagerTabs}
            />
          }
          refreshing={refreshing}
        />
      </Screen>

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
    paddingTop: 14,
  },
  noticeWrap: {
    paddingBottom: 14,
  },
});
