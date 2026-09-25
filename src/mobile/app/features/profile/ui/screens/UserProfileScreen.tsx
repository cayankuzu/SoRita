import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Ban,
  MapPin,
  UserPlus,
} from 'lucide-react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import {
  openStackScreen,
  useAppNavigation,
  useRootStackRoute,
} from '@/mobile/app/app-shell/navigation/navigation';
import { useReportListMutation } from '@/mobile/app/data/hooks/useListMutations';
import { useReportPlaceMutation } from '@/mobile/app/data/hooks/usePlaceMutations';
import { useUserProfileScreenState } from '@/mobile/app/features/profile/application/useUserProfileScreenState';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { ProfileConnectionsSummary } from '@/mobile/app/features/profile/ui/components/ProfileConnectionsSummary';
import {
  ProfileContentPager,
  type ProfileContentTab,
  type ProfileGridItem,
} from '@/mobile/app/features/profile/ui/components/ProfileContentPager';
import { ProfilePagedScrollContainer } from '@/mobile/app/features/profile/ui/components/ProfilePagedScrollContainer';
import { PublicProfileActionBar } from '@/mobile/app/features/profile/ui/components/PublicProfileActionBar';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { OverlayHost } from '@/mobile/app/shared/components/navigation/OverlayHost';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { MosaicGridSkeleton, ProfileSkeleton } from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import {
  useProfileTabPager,
  useProfileTabState,
} from '@/mobile/app/features/profile/ui/components/useProfileTabPager';
import {
  DeferredPlaceFeedScreen,
  DeferredProfileConnectionsModal,
  DeferredUserProfileActionsSheet,
} from '@/mobile/app/features/profile/ui/components/userProfileOverlays';
import {
  DeferredConfirmActionModal,
  DeferredImageLightbox,
  DeferredReportActionSheet,
} from '@/mobile/app/shared/components/feedback/DeferredFeedback';
import { ProfileTabEmptyState } from '@/mobile/app/features/profile/ui/components/ProfileTabEmptyState';
import {
  profileConnectionsCopy,
  type ProfileConnectionMode,
} from '@/mobile/app/features/profile/ui/components/profileConnectionsCopy';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize, spacing } from '@/mobile/app/shared/theme/tokens';
import { useScreenPerformanceMetric } from '@/mobile/app/shared/performance/useScreenPerformanceMetric';
import { ProfileHero } from '@/mobile/app/features/profile/ui/components/ProfileHero';
import {
  ProfileTabs,
} from '@/mobile/app/features/profile/ui/components/ProfileTabs';

type ProfileTab = ProfileContentTab;
const UNBLOCK_CONFIRMATION = {
  description: tr.profile.userActions.unblockConfirmDescription,
  title: tr.profile.userActions.unblockConfirmTitle,
} as const;

// What the report sheet says for each thing that can be reported here.
const REPORT_SHEET = {
  list: { description: tr.listDetail.reportDescription, targetType: 'list' },
  place: { description: tr.cards.reportContentDescription, targetType: 'place' },
  user: { description: tr.profile.reportProfileDescription, targetType: 'profile' },
} as const;

// The profile did not load: either it failed (with a retry) or there is no
// such person.
function UserProfileUnavailable({
  errorMessage,
  onRetry,
}: {
  errorMessage?: string | null;
  onRetry: () => void;
}) {
  if (errorMessage) {
    return (
      <EmptyState
        icon={<MapPin color={colors.danger} size={iconSize.xl} />}
        title={tr.profile.error.loadingUnavailable}
        description={errorMessage}
        actionLabel={tr.common.retry}
        onAction={onRetry}
        tone="danger"
      />
    );
  }

  return (
    <EmptyState
      icon={<MapPin color={colors.textSoft} size={iconSize.xl} />}
      title={tr.profile.empty.userNotFound}
      description={tr.profile.empty.userNotFoundDescription}
      tone="default"
    />
  );
}

function PublicUserAction({
  canShow,
  followUser,
  hasPendingFollowRequest,
  isBlockedByCurrent,
  isFollowing,
  isPrivateAccount,
  onMorePress,
  onUnblockPress,
  username,
}: {
  canShow: boolean;
  followUser: () => Promise<'following' | 'requested' | 'unfollowed'>;
  hasPendingFollowRequest: boolean;
  isBlockedByCurrent: boolean;
  isFollowing: boolean;
  isPrivateAccount: boolean;
  onMorePress: () => void;
  onUnblockPress: () => void;
  username: string;
}) {
  if (!canShow) {
    return null;
  }

  const handleFollowPress = async () => {
    try {
      const result = await followUser();
      const message = result === 'requested'
        ? tr.explore.toast.followRequestSent
        : result === 'following'
          ? tr.profile.toast.userFollowed
          : tr.profile.toast.followUpdated;
      showToast(message, 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : tr.profile.toast.followFailed,
        'error',
      );
    }
  };

  return (
    <PublicProfileActionBar
      hasPendingFollowRequest={hasPendingFollowRequest}
      isBlockedByCurrent={isBlockedByCurrent}
      isFollowing={isFollowing}
      isPrivateAccount={isPrivateAccount}
      onFollowPress={handleFollowPress}
      onMorePress={onMorePress}
      onUnblockPress={onUnblockPress}
      username={username}
    />
  );
}

export function UserProfileScreen() {
  const navigation = useAppNavigation();
  const route = useRootStackRoute<'UserProfile'>();
  const { user } = useAuth();
  const tabState = useProfileTabState();
  const { activeTab, pagerProgress, profileListRef, visibleTab } = tabState;
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [feedMode, setFeedMode] = useState<{
    startIndex: number;
    kind: 'gallery' | 'places';
  } | null>(null);
  const [connectionMode, setConnectionMode] = useState<ProfileConnectionMode | null>(null);
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
    isContentComplete,
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
    tabTotals,
    unblockUser,
  } = useUserProfileScreenState({
    activeTab,
    allowBlockedView,
    user,
    userId,
  });
  const filteredLists = publicLists;
  const filteredPlaces = allPlaces;
  const filteredPhotos = allPhotos;
  const hasAnyContent =
    publicLists.length > 0 || allPlaces.length > 0 || allPhotos.length > 0;
  useScreenPerformanceMetric({
    hasContent: hasAnyContent,
    hasError: Boolean(errorMessage),
    isLoading: isInitialLoading,
    screen: 'user-profile',
  });
  const canShowPublicAction = Boolean(currentUser && !isOwnProfile);
  const shouldShowErrorState =
    canViewProfileContent && Boolean(errorMessage && !hasAnyContent);
  const pagerSwipeEnabled = ![
    refreshing,
    lightboxUri,
    actionMenuVisible,
    reportTarget,
    connectionMode,
    blockConfirmVisible,
    unblockConfirmVisible,
  ].some(Boolean);
  const dataByTab = {
    gallery: filteredPhotos,
    lists: filteredLists,
    places: filteredPlaces,
  } satisfies Record<ProfileTab, ProfileGridItem[]>;

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
        total: tabTotals.gallery,
      },
      lists: {
        complete: isContentComplete.lists,
        loaded: filteredLists.length,
        total: tabTotals.lists,
      },
      places: {
        complete: isContentComplete.places,
        loaded: filteredPlaces.length,
        total: tabTotals.places,
      },
    },
    pagination: { fetchNextPage, hasNextPage, isFetchingNextPage },
    tabState,
  });

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
        <UserProfileUnavailable errorMessage={errorMessage} onRetry={retry} />
      </Screen>
    );
  }

  // Opened over the grid rather than in its place, so the grid keeps its scroll.
  const feedOverlay = feedMode ? (
    <DeferredPlaceFeedScreen
      title={
        feedMode.kind === 'places'
          ? tr.profile.feedTitle.places
          : tr.profile.feedTitle.gallery
      }
      items={feedMode.kind === 'places' ? filteredPlaces : filteredPhotos}
      startIndex={feedMode.startIndex}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ownerFor={() => profileUser}
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
  ) : null;

  const renderEmptyState = (tab: ProfileTab) => {
    // Counted content that has not arrived yet is loading, not missing.
    if (!shouldShowErrorState && (tabTotals[tab] ?? 0) > 0) {
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

    return <ProfileTabEmptyState tab={tab} whose="other" />;
  };

  const renderProfileHero = () => (
      <ProfileHero
        name={profileUser.name}
        username={profileUser.username}
        bio={profileUser.bio}
        profilePhoto={profileUser.profilePhoto}
        coverPhoto={profileUser.coverPhoto}
        coverBackgroundColor={colors.coverFallback}
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
        action={(
          <PublicUserAction
            canShow={canShowPublicAction}
            followUser={followUser}
            hasPendingFollowRequest={hasPendingFollowRequest}
            isBlockedByCurrent={isBlockedByCurrent}
            isFollowing={isFollowing}
            isPrivateAccount={profileUser.isPublicAccount === false}
            onMorePress={() => setActionMenuVisible(true)}
            onUnblockPress={() => setUnblockConfirmVisible(true)}
            username={profileUser.username}
          />
        )}
      />
  );

  // Stays on screen when the hero scrolls away, so the tabs are always there.
  const renderProfileStickyHeader = () => (
    <View style={styles.stickyHeader}>
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
                  tabs={pagerTabs}
                />
              }
            />
          </Screen>
        </OverlayHost>
      ) : (
        <Screen padded={false} refreshing={refreshing} onRefresh={onRefresh}>
          <ProfileHero
            name={profileUser.name}
            username={profileUser.username}
            bio={profileUser.bio}
            profilePhoto={profileUser.profilePhoto}
            coverPhoto={profileUser.coverPhoto}
            coverBackgroundColor={colors.coverFallback}
            onBackPress={() => navigation.goBack()}
            onProfilePhotoPress={() =>
              profileUser.profilePhoto &&
              setLightboxUri(profileUser.profilePhoto)
            }
            onCoverPhotoPress={() =>
              profileUser.coverPhoto && setLightboxUri(profileUser.coverPhoto)
            }
            action={(
              <PublicUserAction
                canShow={canShowPublicAction}
                followUser={followUser}
                hasPendingFollowRequest={hasPendingFollowRequest}
                isBlockedByCurrent={isBlockedByCurrent}
                isFollowing={isFollowing}
                isPrivateAccount={profileUser.isPublicAccount === false}
                onMorePress={() => setActionMenuVisible(true)}
                onUnblockPress={() => setUnblockConfirmVisible(true)}
                username={profileUser.username}
              />
            )}
          />

          <View style={styles.privateStateContent}>
            <EmptyState
              icon={
                isBlockedByCurrent ? (
                  <Ban color={colors.textSoft} size={iconSize.xl} />
                ) : (
                  <UserPlus color={colors.textSoft} size={iconSize.xl} />
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
        <DeferredImageLightbox
          allowDownload={isOwnProfile}
          uri={lightboxUri}
          onClose={() => setLightboxUri(null)}
        />
      ) : null}

      {actionMenuVisible ? (
        <DeferredUserProfileActionsSheet
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
        <DeferredReportActionSheet
          visible
          {...REPORT_SHEET[reportTarget.kind]}
          title={reportTarget.title}
          reportDetails={reportDetails}
          reportReason={reportReason}
          onReportDetailsChange={setReportDetails}
          onReportReasonChange={setReportReason}
          onClose={() => {
            setReportTarget(null);
            setReportDetails('');
            setReportReason('');
          }}
          onSubmit={submitReport}
        />
      ) : null}

      {connectionMode ? (
        <DeferredProfileConnectionsModal
          visible
          {...profileConnectionsCopy(connectionMode)}
          users={connectionMode === 'followers' ? followerUsers : followingUsers}
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
        <DeferredConfirmActionModal
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
        <DeferredConfirmActionModal
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
    paddingTop: spacing.md,
  },
  stickyHeader: {
    backgroundColor: colors.surface,
  },
  privateStateContent: {
    paddingTop: spacing.md,
  },
  noticeWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
