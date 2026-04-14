import React, { startTransition } from 'react';
import {
  Camera,
  Compass,
  List,
  MapPin,
  Search,
  Users,
} from 'lucide-react-native';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ListGridTile, PlaceGridTile, UserGridTile } from '@/mobile/app/features/discovery/public/components';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { openStackScreen } from '@/mobile/app/shared/utils/navigation';
import { exploreScreenStyles as styles } from '@/mobile/app/features/explore/ui/components/exploreScreenStyles';
import type { PlaceFeedCardItem } from '@/mobile/app/shared/utils/placeAggregation';
import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';

export type ExploreTabType = 'lists' | 'places' | 'photos' | 'people';

const tabs: Array<{ key: ExploreTabType; label: string; renderIcon: (active: boolean) => React.ReactNode }> = [
  { key: 'lists', label: tr.explore.tabs.lists, renderIcon: (active) => <List color={active ? colors.onPrimary : colors.textMuted} size={15} /> },
  { key: 'places', label: tr.explore.tabs.places, renderIcon: (active) => <MapPin color={active ? colors.onPrimary : colors.textMuted} size={15} /> },
  { key: 'photos', label: tr.explore.tabs.photos, renderIcon: (active) => <Camera color={active ? colors.onPrimary : colors.textMuted} size={15} /> },
  { key: 'people', label: tr.explore.tabs.people, renderIcon: (active) => <Users color={active ? colors.onPrimary : colors.textMuted} size={15} /> },
];

type ExploreListItem = {
  list: PlaceList;
  owner?: User | null;
};

type ExploreBrowseViewProps = {
  activeTab: ExploreTabType;
  filteredListItems: ExploreListItem[];
  filteredPhotos: PlaceFeedCardItem[];
  filteredPlaces: PlaceFeedCardItem[];
  filteredUsers: User[];
  following: string[];
  onFollowUser: (userId: string) => Promise<'requested' | 'following' | 'updated' | string>;
  onOpenFeed: (startIndex: number, kind: 'places' | 'photos') => void;
  pendingFollowRequests: string[];
  searchQuery: string;
  setActiveTab: (tab: ExploreTabType) => void;
  setSearchQuery: (value: string) => void;
  showToast: (message: string, tone: 'success' | 'error') => void;
};

export function ExploreBrowseView({
  activeTab,
  filteredListItems,
  filteredPhotos,
  filteredPlaces,
  filteredUsers,
  following,
  onFollowUser,
  onOpenFeed,
  pendingFollowRequests,
  searchQuery,
  setActiveTab,
  setSearchQuery,
  showToast,
}: ExploreBrowseViewProps) {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>{tr.explore.title}</Text>
        <Text style={styles.subtitle}>{tr.explore.subtitle}</Text>
      </View>

      <View style={styles.filtersSection}>
        {activeTab !== 'photos' ? (
          <View style={styles.searchWrap}>
            <Search color={colors.textSoft} size={16} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={
                activeTab === 'lists'
                  ? tr.explore.search.list
                  : activeTab === 'places'
                    ? tr.explore.search.place
                    : tr.explore.search.person
              }
              placeholderTextColor={colors.textSoft}
              style={styles.searchInput}
            />
          </View>
        ) : null}

        <View style={styles.tabRail}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.key;

              return (
                <Pressable
                  key={tab.key}
                  onPress={() => {
                    startTransition(() => {
                      setActiveTab(tab.key);
                      setSearchQuery('');
                    });
                  }}
                  style={[styles.tabButton, active ? styles.tabButtonActive : null]}
                >
                  {tab.renderIcon(active)}
                  <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {activeTab === 'lists' ? (
        filteredListItems.length === 0 ? (
          <EmptyState
            icon={<Compass color={colors.textSoft} size={32} />}
            title={searchQuery.trim() ? tr.explore.empty.noResult : tr.explore.empty.noList}
            description={
              searchQuery.trim()
                ? tr.explore.empty.tryDifferentSearch
                : tr.explore.empty.noListDescription
            }
          />
        ) : (
          <View style={styles.grid}>
            {filteredListItems.map(({ list, owner }) => (
              <ListGridTile
                key={list.id}
                list={list}
                owner={owner}
                showOwner={Boolean(owner)}
                onOwnerPress={() => owner && openStackScreen((null as never), 'UserProfile', { userId: owner.id })}
                onPress={() => openStackScreen((null as never), 'ListDetail', { listId: list.id })}
              />
            ))}
          </View>
        )
      ) : null}

      {activeTab === 'places' ? (
        filteredPlaces.length === 0 ? (
          <EmptyState
            icon={<MapPin color={colors.textSoft} size={32} />}
            title={searchQuery.trim() ? tr.explore.empty.noResult : tr.explore.empty.noPlace}
            description={tr.explore.empty.noPlaceDescription}
          />
        ) : (
          <View style={styles.grid}>
            {filteredPlaces.map((item, index) => (
              <PlaceGridTile
                key={item.key}
                place={item.place}
                owner={item.owner}
                showOwner={Boolean(item.owner)}
                mode="place"
                listIsPublic={item.listIsPublic}
                onOwnerPress={() => item.owner && openStackScreen((null as never), 'UserProfile', { userId: item.owner.id })}
                onPress={() => onOpenFeed(index, 'places')}
              />
            ))}
          </View>
        )
      ) : null}

      {activeTab === 'photos' ? (
        filteredPhotos.length === 0 ? (
          <EmptyState
            icon={<Camera color={colors.textSoft} size={32} />}
            title={tr.explore.empty.noPhoto}
            description={tr.explore.empty.noPhotoDescription}
          />
        ) : (
          <View style={styles.grid}>
            {filteredPhotos.map((item, index) => (
              <PlaceGridTile
                key={item.key}
                place={item.place}
                owner={item.owner}
                showOwner={Boolean(item.owner)}
                mode="photo"
                listIsPublic={item.listIsPublic}
                onOwnerPress={() => item.owner && openStackScreen((null as never), 'UserProfile', { userId: item.owner.id })}
                onPress={() => onOpenFeed(index, 'photos')}
              />
            ))}
          </View>
        )
      ) : null}

      {activeTab === 'people' ? (
        filteredUsers.length === 0 ? (
          <EmptyState
            icon={<Users color={colors.textSoft} size={32} />}
            title={searchQuery.trim() ? tr.explore.empty.noUserResult : tr.explore.empty.noUser}
            description={tr.explore.empty.noUserDescription}
          />
        ) : (
          <View style={styles.grid}>
            {filteredUsers.map((item) => {
              const isFollowing = following.includes(item.id);
              const isPending = pendingFollowRequests.includes(item.id);

              return (
                <UserGridTile
                  key={item.id}
                  user={item}
                  isFollowing={isFollowing}
                  isPending={isPending}
                  onPress={() => openStackScreen((null as never), 'UserProfile', { userId: item.id })}
                  onFollowPress={async () => {
                    const result = await onFollowUser(item.id);
                    showToast(
                      result === 'requested'
                        ? 'Takip istegi gonderildi'
                        : result === 'following'
                          ? tr.explore.toast.userFollowed
                          : tr.explore.toast.followUpdated,
                      'success',
                    );
                  }}
                />
              );
            })}
          </View>
        )
      ) : null}
    </>
  );
}
