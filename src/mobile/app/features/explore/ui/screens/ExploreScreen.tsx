import React, { startTransition, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Compass } from 'lucide-react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { openStackScreen, useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import { useExploreScreenState } from '@/mobile/app/features/explore/application/useExploreScreenState';
import { ExploreBrowseResults } from '@/mobile/app/features/explore/ui/components/ExploreBrowseResults';
import { ExploreFeedView } from '@/mobile/app/features/explore/ui/components/ExploreFeedView';
import { ExploreHeaderControls } from '@/mobile/app/features/explore/ui/components/ExploreHeaderControls';
import { exploreScreenStyles as styles } from '@/mobile/app/features/explore/ui/components/exploreScreenStyles';
import type { ExploreFeedMode, ExploreTabType } from '@/mobile/app/features/explore/ui/components/exploreScreenTypes';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

export function ExploreScreen() {
  const navigation = useAppNavigation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ExploreTabType>('lists');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedMode, setFeedMode] = useState<ExploreFeedMode | null>(null);
  const {
    errorMessage,
    fetchNextPage,
    filteredListItems,
    filteredPhotos,
    filteredPlaces,
    filteredUsers,
    followUser,
    following,
    hasPartialDataError,
    hasNextPage,
    isFetchingNextPage,
    pendingFollowRequests,
    refreshing,
    retry,
    onRefresh,
  } = useExploreScreenState({
    user,
    searchQuery,
  });
  const hasAnyBrowseData =
    filteredListItems.length > 0 ||
    filteredPlaces.length > 0 ||
    filteredPhotos.length > 0 ||
    filteredUsers.length > 0;

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

  return (
    <Screen safeTop={false} padded={false} refreshing={refreshing} onRefresh={onRefresh}>
      <ExploreHeaderControls
        activeTab={activeTab}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onTabChange={handleTabChange}
      />

      <View style={loadMoreStyles.content}>
        {hasPartialDataError && hasAnyBrowseData ? (
          <View style={loadMoreStyles.noticeWrap}>
            <InlineNotice
              tone="warning"
              title="Bazi kesfet sonuclari guncellenemedi"
              description="Kayitli sonuclar gosteriliyor. Baglanti duzelince tekrar deneyebilirsin."
              actionLabel="Tekrar dene"
              onAction={() => {
                void retry();
              }}
            />
          </View>
        ) : null}
        {errorMessage && !hasAnyBrowseData ? (
          <View style={loadMoreStyles.errorWrap}>
            <EmptyState
              icon={<Compass color={colors.danger} size={32} />}
              title="Kesfet su an acilamiyor"
              description={errorMessage}
              actionLabel="Tekrar dene"
              onAction={retry}
              tone="danger"
            />
          </View>
        ) : (
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
        )}
        {hasNextPage ? (
          <Pressable
            style={loadMoreStyles.loadMoreButton}
            onPress={() => {
              if (isFetchingNextPage) {
                return;
              }

              void fetchNextPage?.();
            }}
          >
            <Text style={loadMoreStyles.loadMoreLabel}>
              {isFetchingNextPage ? 'Yukleniyor...' : 'Daha Fazla Goster'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const loadMoreStyles = StyleSheet.create({
  noticeWrap: {
    paddingBottom: 12,
  },
  errorWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  content: {
    paddingBottom: 20,
  },
  loadMoreButton: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  loadMoreLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
});
