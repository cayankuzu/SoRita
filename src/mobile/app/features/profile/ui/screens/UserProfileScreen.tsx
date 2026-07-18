import React, { useCallback, useMemo, useState } from 'react';
import { useScrollToTop } from '@react-navigation/native';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { FlatList } from 'react-native';
import {
  Image as ImageIcon,
  Ban,
  List,
  MapPin,
  UserPlus,
} from 'lucide-react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import {
  openStackScreen,
  useAppNavigation,
  useRootStackRoute,
} from '@/mobile/app/app-shell/navigation/navigation';
import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import { useReportListMutation } from '@/mobile/app/data/hooks/useListMutations';
import { useReportPlaceMutation } from '@/mobile/app/data/hooks/usePlaceMutations';
import {
  ListGridTile,
  PlaceGridTile,
} from '@/mobile/app/features/discovery/public/components';
import { useUserProfileScreenState } from '@/mobile/app/features/profile/application/useUserProfileScreenState';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { ProfileConnectionsSummary } from '@/mobile/app/features/profile/ui/components/ProfileConnectionsSummary';
import { ProfilePagedScrollContainer } from '@/mobile/app/features/profile/ui/components/ProfilePagedScrollContainer';
import { PublicProfileActionBar } from '@/mobile/app/features/profile/ui/components/PublicProfileActionBar';
import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { ImageLightbox } from '@/mobile/app/shared/components/feedback/ImageLightbox';
import { ReportActionSheet } from '@/mobile/app/shared/components/feedback/ReportActionSheet';
import { SwipeableCategoryPager } from '@/mobile/app/shared/components/navigation/SwipeableCategoryPager';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { ProfileSkeleton } from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { StaticDiscoveryGrid } from '@/mobile/app/shared/components/ui/StaticDiscoveryGrid';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { UserProfileActionsSheet } from '@/mobile/app/features/profile/ui/components/UserProfileActionsSheet';
import { ProfileFeedScreen } from '@/mobile/app/features/profile/ui/components/ProfileFeedScreen';
import { ProfileHero } from '@/mobile/app/features/profile/ui/components/ProfileHero';
import { ProfileConnectionsModal } from '@/mobile/app/features/profile/ui/components/ProfileConnectionsModal';
import {
  ProfileTabs,
  type ProfileTabOption,
} from '@/mobile/app/features/profile/ui/components/ProfileTabs';
import { estimateProfilePagerHeights } from '@/mobile/app/features/profile/ui/profilePagerLayout';
import { getMarkerColorForMemberships } from '@/mobile/app/shared/utils/markerColors';

type ProfileTab = 'lists' | 'places' | 'gallery';
type ProfileGridItem = PlaceList | PlaceFeedCardItem;
const UNBLOCK_CONFIRMATION = {
  description:
    'Bu kullaniciyi yeniden gorebilir ve etkilesime gecebilirsin. Devam etmek istiyor musun?',
  title: 'Engel kaldirilsin mi?',
} as const;

export function UserProfileScreen() {
  const navigation = useAppNavigation();
  const route = useRootStackRoute<'UserProfile'>();
  const { user } = useAuth();
  const { columnCount, columnGap, screenPadding, width } = useAppLayout();
  const profileListRef = React.useRef<FlatList<'profile-content'> | null>(null);
  const pagerProgress = React.useRef(new Animated.Value(0)).current;
  const [activeTab, setActiveTab] = useState<ProfileTab>('lists');
  const [visibleTab, setVisibleTab] = useState<ProfileTab>('lists');
  const [measuredPagerHeights, setMeasuredPagerHeights] = useState<
    Partial<Record<ProfileTab, number>>
  >({});
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [feedMode, setFeedMode] = useState<{
    startIndex: number;
    kind: 'gallery' | 'places';
  } | null>(null);
  const [connectionMode, setConnectionMode] = useState<
    'followers' | 'following' | null
  >(null);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    id?: string;
    kind: 'list' | 'place' | 'user';
    title: string;
  } | null>(null);
  const [reportDetails, setReportDetails] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [blockConfirmVisible, setBlockConfirmVisible] = useState(false);
  const [unblockConfirmVisible, setUnblockConfirmVisible] = useState(false);
  const { mutateAsync: reportListAsync } = useReportListMutation();
  const { mutateAsync: reportPlaceAsync } = useReportPlaceMutation();

  const userId = route.params.userId;
  const allowBlockedView = Boolean(route.params?.allowBlockedView);
  const {
    allPhotos,
    allPlaces,
    blockUser,
    canViewProfileContent,
    currentUser,
    errorMessage,
    fetchNextPage,
    followerCount,
    followerUsers,
    followUser,
    followingCount,
    followingUsers,
    hasPendingFollowRequest,
    hasNextPage,
    hasPartialDataError,
    isFetchingNextPage,
    isBlockedByCurrent,
    isFollowing,
    isInitialLoading,
    isOwnProfile,
    onRefresh,
    profileUser,
    publicLists,
    refreshing,
    reportUser,
    retry,
    unblockUser,
  } = useUserProfileScreenState({
    allowBlockedView,
    user,
    userId,
  });
  const filteredLists = publicLists;
  const filteredPlaces = allPlaces;
  const filteredPhotos = allPhotos;
  const hasAnyContent =
    publicLists.length > 0 || allPlaces.length > 0 || allPhotos.length > 0;
  const shouldShowErrorState =
    canViewProfileContent && Boolean(errorMessage && !hasAnyContent);
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
    userId,
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
        return;
      }

      setVisibleTab(nextTab);
      setActiveTab(nextTab);
    },
    [activeTab, scrollProfileToTop, setPagerProgressForTab],
  );
  const handleTabPreviewChange = useCallback((key: ProfileTab) => {
    setVisibleTab(key);
  }, []);

  if (isInitialLoading) {
    return (
      <Screen safeTop={false} padded={false} scroll={false}>
        <ProfileSkeleton />
      </Screen>
    );
  }

  const submitReport = async () => {
    if (!currentUser || !profileUser || !reportReason || !reportTarget) {
      return;
    }

    try {
      const normalizedReportDetails = reportDetails.trim() || undefined;

      if (reportTarget.kind === 'user') {
        await reportUser(reportReason, normalizedReportDetails);
      } else if (reportTarget.kind === 'list' && reportTarget.id) {
        await reportListAsync({
          reporterUserId: currentUser.id,
          listId: reportTarget.id,
          reason: reportReason,
          details: normalizedReportDetails,
        });
      } else if (reportTarget.kind === 'place' && reportTarget.id) {
        await reportPlaceAsync({
          reporterUserId: currentUser.id,
          placeId: reportTarget.id,
          reason: reportReason,
          details: normalizedReportDetails,
        });
      }

      setReportTarget(null);
      setActionMenuVisible(false);
      setReportDetails('');
      setReportReason('');
      showToast(tr.cards.reportSent, 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : tr.profile.toast.reportFailed,
        'error',
      );
    }
  };

  const handleBlockUser = async () => {
    await blockUser();
    setBlockConfirmVisible(false);
    setActionMenuVisible(false);
    showToast(tr.profile.toast.userBlocked, 'success');
  };

  const handleUnblockUser = async () => {
    await unblockUser();
    setActionMenuVisible(false);
    showToast(tr.profile.toast.unblockSuccess, 'success');
  };

  if (!profileUser) {
    return (
      <Screen>
        <EmptyState
          icon={
            <MapPin
              color={errorMessage ? colors.danger : colors.textSoft}
              size={32}
            />
          }
          title={
            errorMessage
              ? tr.profile.error.loadingUnavailable
              : tr.profile.empty.userNotFound
          }
          description={
            errorMessage
              ? errorMessage
              : tr.profile.empty.userNotFoundDescription
          }
          actionLabel={errorMessage ? tr.common.retry : undefined}
          onAction={errorMessage ? retry : undefined}
          tone={errorMessage ? 'danger' : 'default'}
        />
      </Screen>
    );
  }

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
        owner={profileUser}
        showOwner
        onBack={() => setFeedMode(null)}
        onOpenListDetail={(item) =>
          openStackScreen(navigation, 'ListDetail', {
            listId: item.listId,
            placeId: item.place.id,
          })
        }
        onOwnerPress={() =>
          openStackScreen(navigation, 'UserProfile', { userId: profileUser.id })
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
          title={tr.profile.empty.publicNoList}
          description={tr.profile.empty.publicNoListDescription}
        />
      );
    }

    if (tab === 'places') {
      return (
        <EmptyState
          icon={<MapPin color={colors.textSoft} size={32} />}
          title={tr.profile.empty.publicNoPlace}
          description={tr.profile.empty.publicNoPlaceDescription}
        />
      );
    }

    return (
      <EmptyState
        icon={<ImageIcon color={colors.textSoft} size={32} />}
        title={tr.profile.empty.publicNoPhoto}
        description={tr.profile.empty.publicNoPhotoDescription}
      />
    );
  };

  const renderProfileHeader = () => (
    <View>
      <ProfileHero
        name={profileUser.name}
        username={profileUser.username}
        bio={profileUser.bio}
        profilePhoto={profileUser.profilePhoto}
        coverPhoto={profileUser.coverPhoto}
        coverBackgroundColor={colors.publicProfileCover}
        stats={[]}
        detailsContent={
          <ProfileConnectionsSummary
            interestIds={profileUser.interests}
            followerCount={followerCount}
            followingCount={followingCount}
            onOpenFollowers={() => setConnectionMode('followers')}
            onOpenFollowing={() => setConnectionMode('following')}
          />
        }
        onBackPress={() => navigation.goBack()}
        onProfilePhotoPress={() =>
          profileUser.profilePhoto && setLightboxUri(profileUser.profilePhoto)
        }
        onCoverPhotoPress={() =>
          profileUser.coverPhoto && setLightboxUri(profileUser.coverPhoto)
        }
        action={
          currentUser && !isOwnProfile ? (
            <PublicProfileActionBar
              hasPendingFollowRequest={hasPendingFollowRequest}
              isBlockedByCurrent={isBlockedByCurrent}
              isFollowing={isFollowing}
              onFollowPress={() => {
                void (async () => {
                  try {
                    const result = await followUser();
                    showToast(
                      result === 'requested'
                        ? tr.explore.toast.followRequestSent
                        : result === 'following'
                          ? tr.profile.toast.userFollowed
                          : tr.profile.toast.followUpdated,
                      'success',
                    );
                  } catch (error) {
                    const message =
                      error instanceof Error
                        ? error.message
                        : tr.profile.toast.followFailed;
                    showToast(message, 'error');
                  }
                })();
              }}
              onMorePress={() => {
                setActionMenuVisible(true);
              }}
              onUnblockPress={() => {
                setUnblockConfirmVisible(true);
              }}
            />
          ) : null
        }
      />

      <ProfileTabs
        activeTab={visibleTab}
        progressIndex={pagerProgress}
        onChange={handleTabChange}
        tabs={tabs}
      />

      <View style={styles.headerContent}>
        {hasPartialDataError && hasAnyContent ? (
          <View style={styles.noticeWrap}>
            <InlineNotice
              tone="warning"
              title={tr.profile.error.userPartialTitle}
              description={tr.profile.error.userPartialDescription}
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
      {canViewProfileContent ? (
        <Screen safeTop={false} padded={false} scroll={false}>
          <ProfilePagedScrollContainer
            header={renderProfileHeader()}
            listRef={profileListRef}
            onRefresh={onRefresh}
            pager={
              <View style={[styles.pagerShell, { height: pagerHeight }]}>
                <SwipeableCategoryPager
                  activeTab={activeTab}
                  keepAlive={false}
                  layoutMode="fill"
                  lazy
                  tabs={pagerTabs}
                  onPageProgressChange={handlePageProgressChange}
                  onTabChange={(tab) => handleTabChange(tab)}
                  onTabPreviewChange={handleTabPreviewChange}
                  renderPage={(tab) => (
                    <StaticDiscoveryGrid<ProfileGridItem>
                      data={shouldShowErrorState ? [] : dataByTab[tab]}
                      contentContainerStyle={styles.gridContent}
                      onContentHeightChange={(height) =>
                        handlePagerContentHeightChange(tab, height)
                      }
                      ListEmptyComponent={renderEmptyState(tab)}
                      ListFooterComponent={
                        !shouldShowErrorState && hasNextPage ? (
                          <Pressable
                            style={styles.loadMoreButton}
                            onPress={() => {
                              if (isFetchingNextPage || tab !== activeTab) {
                                return;
                              }

                              void fetchNextPage?.();
                            }}
                          >
                            <Text style={styles.loadMoreLabel}>
                              {isFetchingNextPage && tab === activeTab
                                ? tr.common.loadingMore
                                : tr.profile.loadMore}
                            </Text>
                          </Pressable>
                        ) : null
                      }
                      keyExtractor={(item, index) =>
                        tab === 'lists'
                          ? (item as PlaceList).id
                          : (item as unknown as PlaceFeedCardItem).key ||
                            `${tab}:${index}`
                      }
                      renderItem={({ item, index }) => {
                        if (tab === 'lists') {
                          const list = item as PlaceList;

                          return (
                            <ListGridTile
                              list={list}
                              fillWidth
                              allListsForMarkerColor={filteredLists}
                              onPress={() =>
                                openStackScreen(navigation, 'ListDetail', {
                                  listId: list.id,
                                })
                              }
                            />
                          );
                        }

                        const placeItem = item as unknown as PlaceFeedCardItem;

                        return (
                          <PlaceGridTile
                            place={placeItem.place}
                            fillWidth
                            mode={tab === 'gallery' ? 'photo' : 'place'}
                            listCoverImage={placeItem.listCoverImage}
                            listEmoji={placeItem.listEmoji}
                            listIsPublic={placeItem.listIsPublic}
                            listName={placeItem.listName}
                            markerColor={getMarkerColorForMemberships(
                              placeItem.memberships,
                              placeItem.listIsPublic,
                            )}
                            onPress={() =>
                              setFeedMode({
                                startIndex: index,
                                kind: tab === 'gallery' ? 'gallery' : 'places',
                              })
                            }
                          />
                        );
                      }}
                    />
                  )}
                />
              </View>
            }
            refreshing={refreshing}
          />
        </Screen>
      ) : (
        <Screen padded={false} refreshing={refreshing} onRefresh={onRefresh}>
          <ProfileHero
            name={profileUser.name}
            username={profileUser.username}
            bio={profileUser.bio}
            profilePhoto={profileUser.profilePhoto}
            coverPhoto={profileUser.coverPhoto}
            coverBackgroundColor={colors.publicProfileCover}
            stats={[]}
            onBackPress={() => navigation.goBack()}
            onProfilePhotoPress={() =>
              profileUser.profilePhoto &&
              setLightboxUri(profileUser.profilePhoto)
            }
            onCoverPhotoPress={() =>
              profileUser.coverPhoto && setLightboxUri(profileUser.coverPhoto)
            }
            action={
              currentUser && !isOwnProfile ? (
                <PublicProfileActionBar
                  hasPendingFollowRequest={hasPendingFollowRequest}
                  isBlockedByCurrent={isBlockedByCurrent}
                  isFollowing={isFollowing}
                  onFollowPress={() => {
                    void (async () => {
                      try {
                        const result = await followUser();
                        showToast(
                          result === 'requested'
                            ? tr.explore.toast.followRequestSent
                            : result === 'following'
                              ? tr.profile.toast.userFollowed
                              : tr.profile.toast.followUpdated,
                          'success',
                        );
                      } catch (error) {
                        const message =
                          error instanceof Error
                            ? error.message
                            : tr.profile.toast.followFailed;
                        showToast(message, 'error');
                      }
                    })();
                  }}
                  onMorePress={() => {
                    setActionMenuVisible(true);
                  }}
                  onUnblockPress={() => {
                    setUnblockConfirmVisible(true);
                  }}
                />
              ) : null
            }
          />

          <View style={styles.privateStateContent}>
            <EmptyState
              icon={
                isBlockedByCurrent ? (
                  <Ban color={colors.textSoft} size={32} />
                ) : (
                  <UserPlus color={colors.textSoft} size={32} />
                )
              }
              title={
                isBlockedByCurrent
                  ? tr.profile.privateBlockedTitle
                  : tr.profile.empty.privateAccount
              }
              description={
                isBlockedByCurrent
                  ? tr.profile.privateBlockedDescription
                  : tr.profile.empty.privateAccountDescription
              }
            />
          </View>
        </Screen>
      )}

      {lightboxUri ? (
        <ImageLightbox
          allowDownload={isOwnProfile}
          uri={lightboxUri}
          onClose={() => setLightboxUri(null)}
        />
      ) : null}

      {actionMenuVisible ? (
        <UserProfileActionsSheet
          visible
          isBlockedByCurrent={isBlockedByCurrent}
          onClose={() => setActionMenuVisible(false)}
          onOpenBlockConfirm={() => {
            setActionMenuVisible(false);
            setBlockConfirmVisible(true);
          }}
          onOpenReport={() => {
            setActionMenuVisible(false);
            setReportTarget({
              kind: 'user',
              title: tr.profile.reportProfileTitle,
            });
          }}
          onUnblock={() => {
            setActionMenuVisible(false);
            setUnblockConfirmVisible(true);
          }}
        />
      ) : null}

      {reportTarget ? (
        <ReportActionSheet
          visible
          title={reportTarget.title}
          description={
            reportTarget.kind === 'user'
              ? tr.profile.reportProfileDescription
              : reportTarget.kind === 'list'
                ? tr.listDetail.reportDescription
                : tr.cards.reportContentDescription
          }
          reportDetails={reportDetails}
          reportReason={reportReason}
          onReportDetailsChange={setReportDetails}
          onReportReasonChange={setReportReason}
          onClose={() => {
            setReportTarget(null);
            setReportDetails('');
            setReportReason('');
          }}
          onSubmit={() => {
            void submitReport();
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
            if (selectedUser.id !== profileUser.id) {
              openStackScreen(navigation, 'UserProfile', {
                userId: selectedUser.id,
              });
            }
          }}
        />
      ) : null}

      {blockConfirmVisible ? (
        <ConfirmActionModal
          visible
          title={tr.profile.userActions.blockConfirmTitle}
          description={tr.profile.userActions.blockConfirmDescription}
          confirmLabel={tr.profile.userActions.blockConfirmLabel}
          confirmVariant="danger"
          onClose={() => setBlockConfirmVisible(false)}
          onConfirm={handleBlockUser}
        />
      ) : null}
      {unblockConfirmVisible ? (
        <ConfirmActionModal
          visible
          title={UNBLOCK_CONFIRMATION.title}
          description={UNBLOCK_CONFIRMATION.description}
          confirmLabel={tr.profile.actions.unblock}
          onClose={() => setUnblockConfirmVisible(false)}
          onConfirm={handleUnblockUser}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  headerContent: {
    paddingTop: 14,
  },
  gridContent: {
    paddingTop: 0,
  },
  pagerShell: {
    width: '100%',
  },
  privateStateContent: {
    paddingTop: 14,
  },
  noticeWrap: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  loadMoreLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
