type NavigationLike = {
  push?: (name: string, params?: object) => void;
  navigate?: (name: string, params?: object) => void;
  getParent?: () => NavigationLike | undefined;
};

export function openStackScreen(
  navigation: NavigationLike | null | undefined,
  screenName: string,
  params?: object,
) {
  if (!navigation) {
    return;
  }

  let current: NavigationLike | undefined | null = navigation;
  const visited = new Set<NavigationLike>();

  while (current && !visited.has(current)) {
    if (typeof current.push === 'function') {
      current.push(screenName, params);
      return;
    }

    visited.add(current);
    current = typeof current.getParent === 'function' ? current.getParent() : undefined;
  }

  if (typeof navigation.navigate === 'function') {
    navigation.navigate(screenName, params);
  }
}
