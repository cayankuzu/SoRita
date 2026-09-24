/**
 * Pushes that arrive while the app is open are shown by the app itself, at
 * the top of whatever screen is up, the way Instagram does. The system banner
 * is not dependable for this: Xiaomi, OPPO and vivo keep it off for new apps,
 * so those pushes only reached the notification shade.
 */
export type InAppPushBanner = {
  body: string;
  id: string;
  onPress: () => void;
  title: string;
};

type InAppPushBannerListener = (banner: InAppPushBanner) => void;

const hosts = new Set<InAppPushBannerListener>();
let receiverCount = 0;

export function subscribeToInAppPushBanners(listener: InAppPushBannerListener) {
  hosts.add(listener);
  return () => {
    hosts.delete(listener);
  };
}

/**
 * Held by the signed-in listener that turns each received push into a banner.
 * Until one holds it, pushes keep their system presentation.
 */
export function claimForegroundPushes() {
  receiverCount += 1;
  let released = false;

  return () => {
    if (!released) {
      released = true;
      receiverCount -= 1;
    }
  };
}

// Whether a push arriving now will be shown by the app's own banner.
export function showsForegroundPushesInApp() {
  return hosts.size > 0 && receiverCount > 0;
}

export function showInAppPushBanner(banner: InAppPushBanner) {
  hosts.forEach((listener) => listener(banner));
}

export const inAppPushBannerInternals = {
  reset() {
    hosts.clear();
    receiverCount = 0;
  },
};
