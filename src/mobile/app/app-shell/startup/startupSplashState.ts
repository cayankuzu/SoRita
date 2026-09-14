export function shouldShowStartupSplash(params: {
  booted: boolean;
  shellReady: boolean;
}) {
  return !params.booted || !params.shellReady;
}
