import React, { startTransition, useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { useExploreScreenState } from '@/mobile/app/features/explore/application/useExploreScreenState';
import { ExploreBrowseResults } from '@/mobile/app/features/explore/ui/components/ExploreBrowseResults';
import { ExploreFeedView } from '@/mobile/app/features/explore/ui/components/ExploreFeedView';
import { ExploreHeaderControls } from '@/mobile/app/features/explore/ui/components/ExploreHeaderControls';
import { exploreScreenStyles as styles } from '@/mobile/app/features/explore/ui/components/exploreScreenStyles';
import type { ExploreFeedMode, ExploreTabType } from '@/mobile/app/features/explore/ui/components/exploreScreenTypes';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { openStackScreen } from '@/mobile/app/shared/utils/navigation';

export function ExploreScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ExploreTabType>('lists');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedMode, setFeedMode] = useState<ExploreFeedMode | null>(null);
  const {
    filteredListItems,
    filteredPhotos,
    filteredPlaces,
    filteredUsers,
    followUser,
    following,
    pendingFollowRequests,
    refreshing,
    onRefresh,
  } = useExploreScreenState({
    user,
    searchQuery,
  });

  if (!user) {
    return null;
  }

  if (feedMode) {
    const feedItems = feedMode.kind === 'places' ? filteredPlaces : filteredPhotos;

    return (
      <ExploreFeedView
        items={feedItems}
        startIndex={feedMode.startIndex}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onBack={() => setFeedMode(null)}
      />
    );
  }

  const handleTabChange = useCallback((nextTab: ExploreTabType) => {
    startTransition(() => {
      setActiveTab(nextTab);
      setSearchQuery('');
    });
  }, []);

  const handleFollowUser = useCallback(
    async (targetUserId: string) => {
      const result = await followUser(targetUserId);
      showToast(
        result === 'requested'
          ? 'Takip istegi gonderildi'
          : result === 'following'
            ? tr.explore.toast.userFollowed
            : tr.explore.toast.followUpdated,
        'success',
      );
    },
    [followUser],
  );

  return (
    <Screen safeTop={false} padded={false} refreshing={refreshing} onRefresh={onRefresh}>
      <ExploreHeaderControls
        activeTab={activeTab}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onTabChange={handleTabChange}
      />

      <View>
        <ExploreBrowseResults
          activeTab={activeTab}
          searchQuery={searchQuery}
          filteredListItems={filteredListItems}
          filteredPlaces={filteredPlaces}
          filteredPhotos={filteredPhotos}
          filteredUsers={filteredUsers}
          following={following}
          pendingFollowRequests={pendingFollowRequests}
          onOpenList={(listId) => openStackScreen(navigation, 'ListDetail', { listId })}
          onOpenUserProfile={(userId) => openStackScreen(navigation, 'UserProfile', { userId })}
          onOpenFeedItem={(kind, startIndex) => setFeedMode({ kind, startIndex })}
          onFollowUser={handleFollowUser}
        />
      </View>
    </Screen>
  );
}
