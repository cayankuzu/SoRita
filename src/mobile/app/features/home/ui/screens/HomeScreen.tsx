import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { MapPin, Users } from 'lucide-react-native';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { useHomeFeedScreenState } from '@/mobile/app/features/home/application/useHomeFeedScreenState';
import { PlaceCard } from '@/mobile/app/features/places/public/components';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { openStackScreen } from '@/mobile/app/shared/utils/navigation';

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { feedItems, followingCount, refreshing, onRefresh } = useHomeFeedScreenState({ user });

  if (!user) {
    return null;
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
        contentContainerStyle={[
          styles.feedListContent,
          feedItems.length === 0 ? styles.feedListContentEmpty : null,
        ]}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        initialNumToRender={4}
        maxToRenderPerBatch={6}
        windowSize={6}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  feedListContent: {
    paddingTop: 4,
  },
  feedListContentEmpty: {
    flexGrow: 1,
  },
  cardRow: {
    marginBottom: 16,
  },
});
