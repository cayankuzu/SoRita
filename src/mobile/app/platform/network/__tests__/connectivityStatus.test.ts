import {
  getConnectivityStatusFromHttpProbe,
  getConnectivityStatusFromProbeFailure,
  getCurrentConnectionStatus,
  setCurrentConnectionStatus,
} from '@/mobile/app/platform/network/connectivityStatus';

describe('connectivityStatus', () => {
  it('keeps reachable HTTP responses online even if the backend response is not inspected here', () => {
    expect(getConnectivityStatusFromHttpProbe(150)).toBe('online');
  });

  it('classifies slow probes without turning them into offline false positives', () => {
    expect(getConnectivityStatusFromHttpProbe(3501)).toBe('constrained');
  });

  it('does not schedule speculative work after a failed reachability probe', () => {
    expect(getConnectivityStatusFromProbeFailure(new TypeError('Network request failed'))).toBe('offline');
  });

  it('classifies probe aborts as slow instead of offline', () => {
    const error = new Error('The operation was aborted.');
    error.name = 'AbortError';

    expect(getConnectivityStatusFromProbeFailure(error)).toBe('constrained');
  });

  it('shares the latest network class with background schedulers', () => {
    setCurrentConnectionStatus('constrained');
    expect(getCurrentConnectionStatus()).toBe('constrained');
    setCurrentConnectionStatus('online');
  });
});
