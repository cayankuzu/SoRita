export type ConnectionStatus = 'online' | 'offline' | 'slow';

export const SLOW_THRESHOLD_MS = 3000;

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

export function getConnectivityStatusFromHttpProbe(elapsedMs: number): ConnectionStatus {
  return elapsedMs > SLOW_THRESHOLD_MS ? 'slow' : 'online';
}

export function getConnectivityStatusFromProbeFailure(error: unknown): ConnectionStatus {
  return isAbortError(error) ? 'slow' : 'online';
}
