import React, { startTransition, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  Image as ImageIcon,
  Ban,
  List,
  MapPin,
  UserPlus,
} from 'lucide-react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { ListGridTile, PlaceGridTile } from '@/mobile/app/features/discovery/public/components';
import { useUserProfileScreenState } from '@/mobile/app/features/profile/application/useUserProfileScreenState';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { ProfileConnectionsSummary } from '@/mobile/app/features/profile/ui/components/ProfileConnectionsSummary';
import { PublicProfileActionBar } from '@/mobile/app/features/profile/ui/components/PublicProfileActionBar';
import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { ImageLightbox } from '@/mobile/app/shared/components/feedback/ImageLightbox';
import { ReportActionSheet } from '@/mobile/app/shared/components/feedback/ReportActionSheet';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { openStackScreen } from '@/mobile/app/shared/utils/navigation';
import { UserProfileActionsSheet } from '@/mobile/app/features/profile/ui/components/UserProfileActionsSheet';
import { ProfileFeedScreen } from '@/mobile/app/features/profile/ui/components/ProfileFeedScreen';
import { ProfileHero } from '@/mobile/app/features/profile/ui/components/ProfileHero';
import { ProfileConnectionsModal } from '@/mobile/app/features/profile/ui/components/ProfileConnectionsModal';
import {
  ProfileTabs,
  type ProfileTabOption,
} from '@/mobile/app/features/profile/ui/components/ProfileTabs';

type ProfileTab = 'lists' | 'places' | 'gallery';

export function UserProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>('lists');
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [feedMode, setFeedMode] = useState<{ startIndex: number; kind: 'gallery' | 'places' } | null>(null);
  const [connectionMode, setConnectionMode] = useState<'followers' | 'following' | null>(null);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [blockConfirmVisible, setBlockConfirmVisible] = useState(false);

  const userId = route.params?.userId as string;
  const allowBlockedView = Boolean(route.params?.allowBlockedView);
  const {
    allPhotos,
    allPlaces,
    blockUser,
    canViewProfileContent,
    currentUser,
    followerUsers,
    followUser,
    followingUsers,
    hasPendingFollowRequest,
    isBlockedByCurrent,
    isBlockedByTarget,
    isFollowing,
    isOwnProfile,
    onRefresh,
    profileUser,
    publicLists,
    refreshing,
    reportUser,
    unblockUser,
  } = useUserProfileScreenState({
    allowBlockedView,
    user,
    userId,
  });
  const totalPlaces = allPlaces.length;

  const tabs = useMemo<ProfileTabOption[]>(
    () => [
      {
        key: 'lists',
        label: tr.profile.tabs.lists,
        count: publicLists.length,
        renderIcon: (active) => <List color={active ? colors.primary : colors.textSoft} size={15} />,
      },
      {
        key: 'places',
        label: tr.profile.tabs.places,
        count: totalPlaces,
        renderIcon: (active) => <MapPin color={active ? colors.primary : colors.textSoft} size={15} />,
      },
      {
        key: 'gallery',
        label: tr.profile.tabs.gallery,
        count: allPhotos.length,
        renderIcon: (active) => <ImageIcon color={active ? colors.primary : colors.textSoft} size={15} />,
      },
    ],
    [allPhotos.length, publicLists.length, totalPlaces],
  );

  const submitUserReport = async () => {
    if (!currentUser || !profileUser || !reportReason) {
      return;
    }

    try {
      await reportUser(reportReason);
      setReportModalVisible(false);
      setActionMenuVisible(false);
      setReportReason('');
      showToast('Kullanici sikayet edildi', 'success');
    } catch {
      showToast('Kullanici sikayet edilemedi', 'error');
    }
  };

  const handleBlockUser = async () => {
    try {
      await blockUser();
      setBlockConfirmVisible(false);
      setActionMenuVisible(false);
      showToast('Kullanici engellendi', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kullanici engellenemedi';
      showToast(message, 'error');
    }
  };

  const handleUnblockUser = async () => {
    try {
      await unblockUser();
      setActionMenuVisible(false);
      showToast('Engel kaldirildi', 'success');
    } catch {
      showToast('Engel kaldirilamadi', 'error');
    }
  };

  if (!profileUser) {
    return (
      <Screen>
        <EmptyState
          icon={<MapPin color={colors.textSoft} size={32} />}
          title={tr.profile.empty.userNotFound}
          description={tr.profile.empty.userNotFoundDescription}
        />
      </Screen>
    );
  }

  if (feedMode) {
    const feedItems = feedMode.kind === 'places' ? allPlaces : allPhotos;
    const feedTitle =
      feedMode.kind === 'places' ? tr.profile.feedTitle.places : tr.profile.feedTitle.gallery;

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
        onOwnerPress={() => openStackScreen(navigation, 'UserProfile', { userId: profileUser.id })}
      />
    );
  }

  return (
    <>
      <Screen padded={false} refreshing={refreshing} onRefresh={onRefresh}>
        <ProfileHero
          name={profileUser.name}
          username={profileUser.username}
          bio={profileUser.bio}
          profilePhoto={profileUser.profilePhoto}
          coverPhoto={profileUser.coverPhoto}
          coverBackgroundColor={colors.publicProfileCover}
          stats={[]}
          detailsContent={
            canViewProfileContent ? (
              <ProfileConnectionsSummary
                interestIds={profileUser.interests}
                followerCount={followerUsers.length}
                followingCount={followingUsers.length}
                onOpenFollowers={() => setConnectionMode('followers')}
                onOpenFollowing={() => setConnectionMode('following')}
              />
            ) : null
          }
          onBackPress={() => navigation.goBack()}
          onProfilePhotoPress={() => profileUser.profilePhoto && setLightboxUri(profileUser.profilePhoto)}
          onCoverPhotoPress={() => profileUser.coverPhoto && setLightboxUri(profileUser.coverPhoto)}
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
                          ? 'Takip istegi gonderildi'
                          : result === 'following'
                            ? tr.profile.toast.userFollowed
                            : tr.profile.toast.followUpdated,
                        'success',
                      );
                    } catch (error) {
                      const message = error instanceof Error ? error.message : 'Takip islemi yapilamadi';
                      showToast(message, 'error');
                    }
                  })();
                }}
                onMorePress={() => {
                  setActionMenuVisible(true);
                }}
                onUnblockPress={() => {
                  void handleUnblockUser();
                }}
              />
            ) : null
          }
        />

        {canViewProfileContent ? (
          <>
            <ProfileTabs
              activeTab={activeTab}
              onChange={(key) => {
                startTransition(() => {
                  setActiveTab(key as ProfileTab);
                });
              }}
              tabs={tabs}
            />

            <View style={styles.contentSection}>
              {activeTab === 'lists' ? (
                publicLists.length === 0 ? (
                  <EmptyState
                    icon={<MapPin color={colors.textSoft} size={32} />}
                    title={tr.profile.empty.publicNoList}
                    description={tr.profile.empty.publicNoListDescription}
                  />
                ) : (
                  <View style={styles.grid}>
                    {publicLists.map((list) => (
                      <ListGridTile
                        key={list.id}
                        list={list}
                        onPress={() => openStackScreen(navigation, 'ListDetail', { listId: list.id })}
                      />
                    ))}
                  </View>
                )
              ) : null}

              {activeTab === 'places' ? (
                allPlaces.length === 0 ? (
                  <EmptyState
                    icon={<MapPin color={colors.textSoft} size={32} />}
                    title={tr.profile.empty.publicNoPlace}
                    description={tr.profile.empty.publicNoPlaceDescription}
                  />
                ) : (
                  <View style={styles.grid}>
                    {allPlaces.map((item, index) => (
                      <PlaceGridTile
                        key={item.key}
                        place={item.place}
                        mode="place"
                        listIsPublic={item.listIsPublic}
                        onPress={() => setFeedMode({ startIndex: index, kind: 'places' })}
                      />
                    ))}
                  </View>
                )
              ) : null}

              {activeTab === 'gallery' ? (
                allPhotos.length === 0 ? (
                  <EmptyState
                    icon={<ImageIcon color={colors.textSoft} size={32} />}
                    title={tr.profile.empty.publicNoPhoto}
                    description={tr.profile.empty.publicNoPhotoDescription}
                  />
                ) : (
                  <View style={styles.grid}>
                    {allPhotos.map((item, index) => (
                      <PlaceGridTile
                        key={item.key}
                        place={item.place}
                        mode="photo"
                        listIsPublic={item.listIsPublic}
                        onPress={() => setFeedMode({ startIndex: index, kind: 'gallery' })}
                      />
                    ))}
                  </View>
                )
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.contentSection}>
            <EmptyState
              icon={
                isBlockedByCurrent ? (
                  <Ban color={colors.textSoft} size={32} />
                ) : (
                  <UserPlus color={colors.textSoft} size={32} />
                )
              }
              title={isBlockedByCurrent ? 'Bu kullaniciyi engelledin' : tr.profile.empty.privateAccount}
              description={
                isBlockedByCurrent
                  ? 'Engeli kaldirmadigin surece bu kullaniciya ait hicbir icerik gosterilmez.'
                  : tr.profile.empty.privateAccountDescription
              }
            />
          </View>
        )}
      </Screen>

      <ImageLightbox uri={lightboxUri} onClose={() => setLightboxUri(null)} />

      <UserProfileActionsSheet
        visible={actionMenuVisible}
        isBlockedByCurrent={isBlockedByCurrent}
        onClose={() => setActionMenuVisible(false)}
        onOpenBlockConfirm={() => {
          setActionMenuVisible(false);
          setBlockConfirmVisible(true);
        }}
        onOpenReport={() => {
          setActionMenuVisible(false);
          setReportModalVisible(true);
        }}
        onUnblock={() => {
          void handleUnblockUser();
        }}
      />

      <ReportActionSheet
        visible={reportModalVisible}
        title="Profili bildir"
        description="Bu profili neden bildirmek istedigini sec."
        reportReason={reportReason}
        onReportReasonChange={setReportReason}
        onClose={() => {
          setReportModalVisible(false);
          setReportReason('');
        }}
        onSubmit={() => {
          void submitUserReport();
        }}
      />

      <ProfileConnectionsModal
        visible={Boolean(connectionMode)}
        title={connectionMode === 'followers' ? tr.profile.connections.followers : tr.profile.connections.following}
        users={connectionMode === 'followers' ? followerUsers : followingUsers}
        emptyTitle={connectionMode === 'followers' ? tr.profile.connections.emptyFollowers : tr.profile.connections.emptyFollowing}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onClose={() => setConnectionMode(null)}
        onUserPress={(selectedUser) => {
          setConnectionMode(null);
          if (selectedUser.id !== profileUser.id) {
            openStackScreen(navigation, 'UserProfile', { userId: selectedUser.id });
          }
        }}
      />

      <ConfirmActionModal
        visible={blockConfirmVisible}
        title="Kullaniciyi engelle?"
        description="Bu kullaniciya ait profil, liste, mekan, fotograf, yorum ve begenileri artik gormezsin. Takip iliskileri de kaldirilir."
        confirmLabel="Engelle"
        confirmVariant="danger"
        onClose={() => setBlockConfirmVisible(false)}
        onConfirm={() => {
          void handleBlockUser();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  contentSection: {
    paddingTop: 14,
    paddingBottom: 20,
  },
});
