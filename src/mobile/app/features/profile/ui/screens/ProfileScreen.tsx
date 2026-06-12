import React, { startTransition, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Image as ImageIcon,
  List,
  MapPin,
} from 'lucide-react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { openStackScreen, useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import { ListGridTile, PlaceGridTile } from '@/mobile/app/features/discovery/public/components';
import { useOwnProfileScreenState } from '@/mobile/app/features/profile/application/useOwnProfileScreenState';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { ListEditorModal } from '@/mobile/app/features/lists/public/components';
import { PlaceEditorModal } from '@/mobile/app/features/map/public/components';
import { ProfileConnectionsSummary } from '@/mobile/app/features/profile/ui/components/ProfileConnectionsSummary';
import { OwnProfileActionBar } from '@/mobile/app/features/profile/ui/components/OwnProfileActionBar';
import { ImageLightbox } from '@/mobile/app/shared/components/feedback/ImageLightbox';
import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { ProfileFeedScreen } from '@/mobile/app/features/profile/ui/components/ProfileFeedScreen';
import { ProfileHero } from '@/mobile/app/features/profile/ui/components/ProfileHero';
import { ProfileConnectionsModal } from '@/mobile/app/features/profile/ui/components/ProfileConnectionsModal';
import {
  ProfileTabs,
  type ProfileTabOption,
} from '@/mobile/app/features/profile/ui/components/ProfileTabs';
import { createUuid } from '@/shared/utils/id';

type ProfileTab = 'lists' | 'places' | 'gallery';

function normalizePlaceIdentityValue(value: string) {
  return value.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
}

function isMatchingPlace(
  left: Pick<Place, 'id' | 'name' | 'lat' | 'lng'>,
  right: Pick<Place, 'id' | 'name' | 'lat' | 'lng'>,
) {
  if (left.id === right.id) {
    return true;
  }

  return (
    Math.abs(left.lat - right.lat) < 0.00001 &&
    Math.abs(left.lng - right.lng) < 0.00001 &&
    normalizePlaceIdentityValue(left.name) === normalizePlaceIdentityValue(right.name)
  );
}

export function ProfileScreen() {
  const navigation = useAppNavigation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>('lists');
  const [deleteListId, setDeleteListId] = useState<string | null>(null);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [feedMode, setFeedMode] = useState<{ startIndex: number; kind: 'gallery' | 'places' } | null>(null);
  const [connectionMode, setConnectionMode] = useState<'followers' | 'following' | null>(null);
  const [editingList, setEditingList] = useState<PlaceList | null>(null);
  const [editingPlaceTarget, setEditingPlaceTarget] = useState<{ list: PlaceList; place: Place } | null>(null);
  const {
    allPhotos,
    allPlaces,
    createList,
    deleteList: deleteStoredList,
    deletePlace,
    errorMessage,
    fetchNextPage,
    followerUsers,
    followingUsers,
    freshUser,
    hasNextPage,
    hasPartialDataError,
    isFetchingNextPage,
    lists,
    onRefresh,
    refreshing,
    retry,
    updateList,
    updateLists,
  } = useOwnProfileScreenState({ user });
  const totalPlaces = allPlaces.length;
  const hasAnyContent = lists.length > 0 || allPlaces.length > 0 || allPhotos.length > 0;
  const shouldShowErrorState = Boolean(errorMessage && !hasAnyContent);

  const tabs = useMemo<ProfileTabOption[]>(
    () => [
      {
        key: 'lists',
        label: tr.profile.tabs.lists,
        count: lists.length,
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
    [allPhotos.length, lists.length, totalPlaces],
  );

  const deleteList = async () => {
    if (!deleteListId) {
      return;
    }

    await deleteStoredList(deleteListId);
    setDeleteListId(null);
    showToast(tr.profile.toast.listDeleted, 'success');
  };

  const saveListEdits = async (nextList: PlaceList) => {
    await updateList(nextList);
    setEditingList(null);
    showToast('Liste guncellendi', 'success');
  };

  const savePlaceEdits = async (
    placeData: Omit<Place, 'id' | 'addedAt'>,
    targetListIds: string[],
  ) => {
    if (!editingPlaceTarget) {
      return;
    }

    const previousPlace = editingPlaceTarget.place;
    const selectedListIds = Array.from(new Set(targetListIds));
    const nextUpdatedAt = new Date().toISOString();
    const changedLists = lists
      .map((list) => {
        const matchedPlaceIndex = list.places.findIndex((place) => isMatchingPlace(place, previousPlace));
        const hasPlace = matchedPlaceIndex >= 0;
        const shouldContainPlace = selectedListIds.includes(list.id);

        if (!hasPlace && !shouldContainPlace) {
          return null;
        }

        const matchedPlace = matchedPlaceIndex >= 0 ? list.places[matchedPlaceIndex] : null;
        const nextPlace: Place = {
          ...placeData,
          id: matchedPlace?.id || createUuid(),
          addedAt: matchedPlace?.addedAt || previousPlace.addedAt,
          updatedAt: nextUpdatedAt,
          addedBy: matchedPlace?.addedBy || placeData.addedBy || previousPlace.addedBy,
        };

        const nextPlaces = shouldContainPlace
          ? hasPlace
            ? list.places.map((place, index) => (index === matchedPlaceIndex ? nextPlace : place))
            : [...list.places, nextPlace]
          : list.places.filter((_, index) => index !== matchedPlaceIndex);

        return {
          ...list,
          places: nextPlaces,
          updatedAt: nextUpdatedAt,
        };
      })
      .filter((item): item is PlaceList => Boolean(item));

    await updateLists(changedLists);

    setEditingPlaceTarget(null);
    showToast('Mekan guncellendi', 'success');
  };

  const deleteEditedPlace = async (placeId: string) => {
    await deletePlace(placeId);

    setEditingPlaceTarget(null);
    showToast('Mekan silindi', 'success');
  };

  if (!freshUser) {
    if (errorMessage) {
      return (
        <Screen>
          <EmptyState
            icon={<MapPin color={colors.danger} size={32} />}
            title="Profilin simdi acilamiyor"
            description={errorMessage}
            actionLabel="Tekrar dene"
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
    const targetPlace = targetList?.places.find((place) => place.id === placeId);

    if (!targetList || !targetPlace) {
      return;
    }

    setEditingPlaceTarget({ list: targetList, place: targetPlace });
  };

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
        owner={freshUser}
        onBack={() => setFeedMode(null)}
        onOpenListDetail={(item) =>
          openStackScreen(navigation, 'ListDetail', {
            listId: item.listId,
            placeId: item.place.id,
          })
        }
      />
    );
  }

  return (
    <>
      <Screen safeTop={false} padded={false} refreshing={refreshing} onRefresh={onRefresh}>
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
              followerCount={followerUsers.length}
              followingCount={followingUsers.length}
              onOpenFollowers={() => setConnectionMode('followers')}
              onOpenFollowing={() => setConnectionMode('following')}
            />
          }
          onProfilePhotoPress={() => freshUser.profilePhoto && setLightboxUri(freshUser.profilePhoto)}
          onCoverPhotoPress={() => freshUser.coverPhoto && setLightboxUri(freshUser.coverPhoto)}
          action={
            <OwnProfileActionBar onOpenSettings={() => openStackScreen(navigation, 'Settings')} />
          }
        />

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
          {hasPartialDataError && hasAnyContent ? (
            <View style={styles.noticeWrap}>
              <InlineNotice
                tone="warning"
                title="Profilin bir kismi eski verilerle gosteriliyor"
                description="Son degisikliklerden bazilari henuz alinamadi. Asagi cekerek tekrar deneyebilirsin."
                actionLabel="Tekrar dene"
                onAction={() => {
                  void retry();
                }}
              />
            </View>
          ) : null}

          {shouldShowErrorState ? (
            <EmptyState
              icon={<MapPin color={colors.danger} size={32} />}
              title="Profil verileri alinamadi"
              description={errorMessage || 'Profil verileri su an yuklenemiyor.'}
              actionLabel="Tekrar dene"
              onAction={retry}
              tone="danger"
            />
          ) : null}

          {!shouldShowErrorState && activeTab === 'lists' ? (
            lists.length === 0 ? (
              <EmptyState
                icon={<MapPin color={colors.textSoft} size={32} />}
                title={tr.profile.empty.myNoList}
                description={tr.profile.empty.myNoListDescription}
              />
            ) : (
              <View style={styles.grid}>
                {lists.map((list) => (
                  <ListGridTile
                    key={list.id}
                    list={list}
                    showPrivacyBadge
                    onEditPress={() => setEditingList(list)}
                    onDeletePress={() => setDeleteListId(list.id)}
                    onPress={() => openStackScreen(navigation, 'ListDetail', { listId: list.id })}
                  />
                ))}
              </View>
            )
          ) : null}

          {!shouldShowErrorState && activeTab === 'places' ? (
            allPlaces.length === 0 ? (
              <EmptyState
                icon={<MapPin color={colors.textSoft} size={32} />}
                title={tr.profile.empty.myNoPlace}
                description={tr.profile.empty.myNoPlaceDescription}
              />
            ) : (
              <View style={styles.grid}>
                {allPlaces.map((item, index) => (
                  <PlaceGridTile
                    key={item.key}
                    place={item.place}
                    mode="place"
                    listCoverImage={item.listCoverImage}
                    listEmoji={item.listEmoji}
                    listIsPublic={item.listIsPublic}
                    listName={item.listName}
                    onEditPress={() => openEditingPlaceTarget(item.listId, item.place.id)}
                    onPress={() =>
                      setFeedMode({
                        startIndex: index,
                        kind: 'places',
                      })
                    }
                  />
                ))}
              </View>
            )
          ) : null}

          {!shouldShowErrorState && activeTab === 'gallery' ? (
            allPhotos.length === 0 ? (
              <EmptyState
                icon={<ImageIcon color={colors.textSoft} size={32} />}
                title={tr.profile.empty.myNoPhoto}
                description={tr.profile.empty.myNoPhotoDescription}
              />
            ) : (
              <View style={styles.grid}>
                {allPhotos.map((item, index) => (
                  <PlaceGridTile
                    key={item.key}
                    place={item.place}
                    mode="photo"
                    listCoverImage={item.listCoverImage}
                    listEmoji={item.listEmoji}
                    listIsPublic={item.listIsPublic}
                    listName={item.listName}
                    onEditPress={() => openEditingPlaceTarget(item.listId, item.place.id)}
                    onPress={() => setFeedMode({ startIndex: index, kind: 'gallery' })}
                  />
                ))}
              </View>
            )
          ) : null}

          {!shouldShowErrorState && hasNextPage ? (
            <Pressable
              style={styles.loadMoreButton}
              onPress={() => {
                if (isFetchingNextPage) {
                  return;
                }

                void fetchNextPage?.();
              }}
            >
              <Text style={styles.loadMoreLabel}>
                {isFetchingNextPage ? 'Yukleniyor...' : 'Daha Fazla Goster'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Screen>

      <ConfirmActionModal
        visible={Boolean(deleteListId)}
        title={tr.profile.deleteList.title}
        description={tr.profile.deleteList.description}
        confirmLabel={tr.common.delete}
        confirmVariant="danger"
        onClose={() => setDeleteListId(null)}
        onConfirm={() => {
          void deleteList();
        }}
      />

      <ImageLightbox uri={lightboxUri} onClose={() => setLightboxUri(null)} />

      <ListEditorModal
        visible={Boolean(editingList)}
        list={editingList}
        onClose={() => setEditingList(null)}
        onSave={saveListEdits}
      />

      <PlaceEditorModal
        visible={Boolean(editingPlaceTarget)}
        lat={editingPlaceTarget?.place.lat || 0}
        lng={editingPlaceTarget?.place.lng || 0}
        placeName={editingPlaceTarget?.place.name}
        placeAddress={editingPlaceTarget?.place.address}
        lists={lists}
        existingPlace={editingPlaceTarget?.place || null}
        existingPlaceListName={editingPlaceTarget?.list.name}
        onClose={() => setEditingPlaceTarget(null)}
        onSave={savePlaceEdits}
        onDelete={deleteEditedPlace}
        onCreateList={async (list) => {
          await createList(list);
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
          if (selectedUser.id !== freshUser.id) {
            openStackScreen(navigation, 'UserProfile', { userId: selectedUser.id });
          }
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
    justifyContent: 'space-between',
  },
  contentSection: {
    paddingTop: 14,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  noticeWrap: {
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
