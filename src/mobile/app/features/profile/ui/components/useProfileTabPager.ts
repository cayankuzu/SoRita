import { useScrollToTop } from '@react-navigation/native';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Animated } from 'react-native';
import type { FlatList } from 'react-native';

import type {
  ProfileContentTab,
  ProfileGridItem,
} from '@/mobile/app/features/profile/ui/components/ProfileContentPager';
import {
  buildProfileTabOptions,
  resolveProfileTabCount,
} from '@/mobile/app/features/profile/ui/components/profileTabOptions';

type ProfileTabCount = { complete: boolean; loaded: number; total?: number };

// The tab whose content is loaded (activeTab) and the one the tab bar shows,
// which follows a swipe before it settles (visibleTab). Declared before the
// screen's data, which loads for activeTab.
export function useProfileTabState() {
  const [activeTab, setActiveTab] = useState<ProfileContentTab>('lists');
  const [visibleTab, setVisibleTab] = useState<ProfileContentTab>('lists');
  const pagerProgress = useRef(new Animated.Value(0)).current;
  const profileListRef = useRef<FlatList<ProfileGridItem> | null>(null);
  useScrollToTop(profileListRef as RefObject<FlatList>);

  return { activeTab, pagerProgress, profileListRef, setActiveTab, setVisibleTab, visibleTab };
}

// The tab bar and the pager under it, the same on your profile and another
// person's: tapping the open tab scrolls to the top, the bar tracks a swipe,
// and the list asks for the next page at its end.
export function useProfileTabPager({
  counts,
  onTabPress,
  pagination,
  tabState,
}: {
  counts: Record<ProfileContentTab, ProfileTabCount>;
  onTabPress?: () => void;
  pagination: {
    fetchNextPage?: () => unknown;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
  };
  tabState: ReturnType<typeof useProfileTabState>;
}) {
  const { activeTab, pagerProgress, profileListRef, setActiveTab, setVisibleTab } = tabState;
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = pagination;
  const galleryCount = resolveProfileTabCount(counts.gallery);
  const listsCount = resolveProfileTabCount(counts.lists);
  const placesCount = resolveProfileTabCount(counts.places);
  const tabs = useMemo(
    () => buildProfileTabOptions({ gallery: galleryCount, lists: listsCount, places: placesCount }),
    [galleryCount, listsCount, placesCount],
  );
  const pagerTabs = useMemo(
    () => tabs.map((tab) => ({ key: tab.key as ProfileContentTab, label: tab.label })),
    [tabs],
  );

  const handleTabChange = useCallback(
    (key: string) => {
      const nextTab = key as ProfileContentTab;
      pagerProgress.setValue(Math.max(0, pagerTabs.findIndex((tab) => tab.key === nextTab)));
      onTabPress?.();

      if (nextTab === activeTab) {
        profileListRef.current?.scrollToOffset({ offset: 0, animated: true });
        return;
      }

      setVisibleTab(nextTab);
      setActiveTab(nextTab);
    },
    [activeTab, onTabPress, pagerProgress, pagerTabs, profileListRef, setActiveTab, setVisibleTab],
  );
  const handlePageProgressChange = useCallback(
    (pageOffset: number) => {
      pagerProgress.setValue(pageOffset);
    },
    [pagerProgress],
  );
  const handleProfileEndReached = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }

    void fetchNextPage?.();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return {
    handlePageProgressChange,
    handleProfileEndReached,
    handleTabChange,
    handleTabPreviewChange: setVisibleTab,
    pagerTabs,
    tabs,
  };
}
