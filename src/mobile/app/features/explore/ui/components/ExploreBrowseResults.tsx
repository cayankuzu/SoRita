import React from 'react';
import { Camera, Compass, MapPin, Users } from 'lucide-react-native';
import { View } from 'react-native';

import type { PlaceList, User } from '@/mobile/app/data/contracts/entities';
import { ListGridTile, PlaceGridTile, UserGridTile } from '@/mobile/app/features/discovery/public/components';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';

import { exploreScreenStyles as styles } from './exploreScreenStyles';
import type { ExploreTabType } from './exploreScreenTypes';

type ExploreListItem = {
  list: PlaceList;
  owner: User | null;
};

type ExploreBrowseResultsProps = {
  activeTab: ExploreTabType;
  searchQuery: string;
  filteredListItems: ExploreListItem[];
  filteredPlaces: PlaceFeedCardItem[];
  filteredPhotos: PlaceFeedCardItem[];
  filteredUsers: User[];
  following: string[];
  pendingFollowRequests: string[];
  onOpenList: (listId: string) => void;
  onOpenUserProfile: (userId: string) => void;
  onOpenFeedItem: (kind: 'places' | 'photos', startIndex: number) => void;
  onFollowUser: (userId: string) => Promise<void>;
};

export function ExploreBrowseResults({
  activeTab,
  searchQuery,
  filteredListItems,
  filteredPlaces,
  filteredPhotos,
  filteredUsers,
  following,
  pendingFollowRequests,
  onOpenList,
  onOpenUserProfile,
  onOpenFeedItem,
  onFollowUser,
}: ExploreBrowseResultsProps) {
  if (activeTab === 'lists') {
    if (filteredListItems.length === 0) {
      return (
        <EmptyState
          icon={<Compass color={colors.textSoft} size={32} />}
          title={searchQuery.trim() ? tr.explore.empty.noResult : tr.explore.empty.noList}
          description={
            searchQuery.trim()
              ? tr.explore.empty.tryDifferentSearch
              : tr.explore.empty.noListDescription
          }
        />
      );
    }

    return (
      <View style={styles.grid}>
        {filteredListItems.map(({ list, owner }) => (
          <ListGridTile
            key={list.id}
            list={list}
            owner={owner}
            showOwner={Boolean(owner)}
            onOwnerPress={() => owner && onOpenUserProfile(owner.id)}
            onPress={() => onOpenList(list.id)}
          />
        ))}
      </View>
    );
  }

  if (activeTab === 'places') {
    if (filteredPlaces.length === 0) {
      return (
        <EmptyState
          icon={<MapPin color={colors.textSoft} size={32} />}
          title={searchQuery.trim() ? tr.explore.empty.noResult : tr.explore.empty.noPlace}
          description={searchQuery.trim() ? tr.explore.empty.tryDifferentSearch : tr.explore.empty.noPlaceDescription}
        />
      );
    }

    return (
      <View style={styles.grid}>
        {filteredPlaces.map((item, index) => (
          <PlaceGridTile
            key={item.key}
            place={item.place}
            owner={item.owner}
            showOwner={Boolean(item.owner)}
            mode="place"
            listCoverImage={item.listCoverImage}
            listEmoji={item.listEmoji}
            listIsPublic={item.listIsPublic}
            listName={item.listName}
            onOwnerPress={() => item.owner && onOpenUserProfile(item.owner.id)}
            onPress={() => onOpenFeedItem('places', index)}
          />
        ))}
      </View>
    );
  }

  if (activeTab === 'photos') {
    if (filteredPhotos.length === 0) {
      return (
        <EmptyState
          icon={<Camera color={colors.textSoft} size={32} />}
          title={searchQuery.trim() ? tr.explore.empty.noResult : tr.explore.empty.noPhoto}
          description={searchQuery.trim() ? tr.explore.empty.tryDifferentSearch : tr.explore.empty.noPhotoDescription}
        />
      );
    }

    return (
      <View style={styles.grid}>
        {filteredPhotos.map((item, index) => (
          <PlaceGridTile
            key={item.key}
            place={item.place}
            owner={item.owner}
            showOwner={Boolean(item.owner)}
            mode="photo"
            listCoverImage={item.listCoverImage}
            listEmoji={item.listEmoji}
            listIsPublic={item.listIsPublic}
            listName={item.listName}
            onOwnerPress={() => item.owner && onOpenUserProfile(item.owner.id)}
            onPress={() => onOpenFeedItem('photos', index)}
          />
        ))}
      </View>
    );
  }

  if (filteredUsers.length === 0) {
    return (
      <EmptyState
        icon={<Users color={colors.textSoft} size={32} />}
        title={searchQuery.trim() ? tr.explore.empty.noUserResult : tr.explore.empty.noUser}
        description={searchQuery.trim() ? tr.explore.empty.tryDifferentSearch : tr.explore.empty.noUserDescription}
      />
    );
  }

  return (
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
            onPress={() => onOpenUserProfile(item.id)}
            onFollowPress={() => onFollowUser(item.id)}
          />
        );
      })}
    </View>
  );
}
