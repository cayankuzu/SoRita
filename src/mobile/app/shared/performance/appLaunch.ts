type ReactNativeStartupTiming = {
  endTime?: number;
  executeJavaScriptBundleEntryPointStart?: number;
  startTime?: number;
};

type ReactNativePerformance = Performance & {
  rnStartupTiming?: ReactNativeStartupTiming;
};

/** Earliest JavaScript timestamp, imported before the React application graph. */
export const APP_JAVASCRIPT_STARTED_AT = Date.now();
const APP_JAVASCRIPT_STARTED_AT_HIGH_RESOLUTION = globalThis.performance?.now?.();

function getReactNativeStartupTiming() {
  return (globalThis.performance as ReactNativePerformance | undefined)
    ?.rnStartupTiming;
}

export function getAppLaunchElapsedMs() {
  const nativeStart = getReactNativeStartupTiming()?.startTime;
  const now = globalThis.performance?.now?.();

  if (
    typeof nativeStart === 'number' &&
    typeof now === 'number' &&
    nativeStart >= 0 &&
    nativeStart <= now
  ) {
    return Math.max(0, now - nativeStart);
  }

  return Math.max(0, Date.now() - APP_JAVASCRIPT_STARTED_AT);
}

export function getAppLaunchBreakdown() {
  const timing = getReactNativeStartupTiming();
  const now = globalThis.performance?.now?.();
  const jsStartedAt = APP_JAVASCRIPT_STARTED_AT_HIGH_RESOLUTION;

  return {
    jsReadyDurationMs:
      typeof now === 'number' && typeof jsStartedAt === 'number'
        ? Math.max(0, now - jsStartedAt)
        : getAppLaunchElapsedMs(),
    nativeToJavaScriptDurationMs:
      typeof timing?.startTime === 'number' &&
      typeof timing.executeJavaScriptBundleEntryPointStart === 'number'
        ? Math.max(
            0,
            timing.executeJavaScriptBundleEntryPointStart - timing.startTime,
          )
        : undefined,
    nativeStartupDurationMs:
      typeof timing?.startTime === 'number' && typeof timing.endTime === 'number'
        ? Math.max(0, timing.endTime - timing.startTime)
        : undefined,
  };
}
