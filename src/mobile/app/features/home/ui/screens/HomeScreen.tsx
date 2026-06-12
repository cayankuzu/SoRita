import React from 'react';
import { MapPin, Users } from 'lucide-react-native';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { openStackScreen, useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import { useHomeFeedScreenState } from '@/mobile/app/features/home/application/useHomeFeedScreenState';
import { PlaceCard } from '@/mobile/app/features/places/public/components';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { buildAdaptiveFlatListProps } from '@/mobile/app/shared/utils/flatList';

export function HomeScreen() {
  const navigation = useAppNavigation();
  const { height, width } = useWindowDimensions();
  const { user } = useAuth();
  const {
    errorMessage,
    fetchNextPage,
    feedItems,
    followingCount,
    hasNextPage,
    hasPartialDataError,
    isInitialLoading,
    isFetchingNextPage,
    refreshing,
    retry,
    onRefresh,
  } = useHomeFeedScreenState({ user });

  const listProps = React.useMemo(
    () =>
      buildAdaptiveFlatListProps({
        containsNativeMaps: true,
        itemCount: feedItems.length,
        viewportHeight: height,
        viewportWidth: width,
      }),
    [feedItems.length, height, width],
  );

  if (!user) {
    return null;
  }

  if (isInitialLoading) {
    return (
      <Screen safeTop={false} padded={false} scroll={false}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
      </Screen>
    );
  }

  if (errorMessage && feedItems.length === 0) {
    return (
      <Screen safeTop={false}>
        <EmptyState
          icon={<MapPin color={colors.danger} size={38} />}
          title="Akis simdi acilamiyor"
          description={errorMessage}
          actionLabel="Tekrar dene"
          onAction={retry}
          tone="danger"
        />
      </Screen>
    );
  }

  const renderEmptyState = () => {
    if (followingCount === 0 && feedItems.length === 0) {
      return (
        <View style={styles.centeredState}>
          <EmptyState
            icon={<Users color={colors.primary} size={38} />}
            title={tr.home.noFollowingTitle}
            description={tr.home.noFollowingDescription}
          />
          <Pressable style={styles.primaryCta} onPress={() => navigation.navigate('Explore')}>
            <MapPin color={colors.onPrimary} size={16} />
            <Text style={styles.primaryCtaText}>{tr.home.exploreCta}</Text>
          </Pressable>
        </View>
      );
    }

    if (followingCount > 0 && feedItems.length === 0) {
      return (
        <View style={styles.emptyStateWrap}>
          <EmptyState
            icon={<MapPin color={colors.textSoft} size={38} />}
            title={tr.home.noFeedTitle}
            description={tr.home.noFeedDescription}
          />
        </View>
      );
    }

    return null;
  };

  return (
    <Screen safeTop={false} padded={false} scroll={false}>
      <FlatList
        {...listProps}
        data={feedItems}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <View style={styles.cardRow}>
            <PlaceCard
              place={item.place}
              owner={item.owner}
              ownerId={item.ownerId}
              listName={item.listName}
              listEmoji={item.listEmoji}
              listIsPublic={item.listIsPublic}
              listCoverImage={item.listCoverImage}
              onPress={() =>
                openStackScreen(navigation, 'ListDetail', {
                  listId: item.listId,
                  placeId: item.place.id,
                })
              }
              onOwnerPress={() => {
                if (!item.owner) {
                  return;
                }

                if (item.owner.id === user.id) {
                  navigation.navigate('MainTabs', { screen: 'Profile' });
                  return;
                }

                openStackScreen(navigation, 'UserProfile', { userId: item.owner.id });
              }}
            />
          </View>
        )}
        ListEmptyComponent={renderEmptyState}
        ListHeaderComponent={
          hasPartialDataError && feedItems.length > 0 ? (
            <View style={styles.bannerWrap}>
              <InlineNotice
                tone="warning"
                title="Bazi guncellemeler tamamlanamadi"
                description="Kayitli akis gosteriliyor. Asagi cekerek veya simdi tekrar deneyerek guncelleyebilirsin."
                actionLabel="Simdi dene"
                onAction={() => {
                  void retry();
                }}
              />
            </View>
          ) : null
        }
        contentContainerStyle={[
          styles.feedListContent,
          feedItems.length === 0 ? styles.feedListContentEmpty : null,
        ]}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={() => {
          if (!hasNextPage || isFetchingNextPage || !fetchNextPage) {
            return;
          }

          void fetchNextPage();
        }}
        onEndReachedThreshold={0.35}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.listFooter}>
              <ActivityIndicator color={colors.primary} size="small" />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredState: {
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 36,
  },
  primaryCta: {
    alignSelf: 'center',
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  emptyStateWrap: {
    paddingTop: 36,
    paddingHorizontal: 16,
  },
  bannerWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  feedListContent: {
    paddingTop: 4,
  },
  feedListContentEmpty: {
    flexGrow: 1,
  },
  cardRow: {
    marginBottom: 16,
  },
  listFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
});
