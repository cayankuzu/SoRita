export type ConnectionStatus =
  | 'unknown'
  | 'online'
  | 'offline'
  | 'constrained';

export const SLOW_THRESHOLD_MS = 3000;
let currentConnectionStatus: ConnectionStatus = 'unknown';

export function setCurrentConnectionStatus(status: ConnectionStatus) {
  currentConnectionStatus = status;
}

export function getCurrentConnectionStatus() {
  return currentConnectionStatus;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

export function getConnectivityStatusFromHttpProbe(elapsedMs: number): ConnectionStatus {
  return elapsedMs > SLOW_THRESHOLD_MS ? 'constrained' : 'online';
}

export function getConnectivityStatusFromProbeFailure(error: unknown): ConnectionStatus {
  return isAbortError(error) ? 'constrained' : 'offline';
}
