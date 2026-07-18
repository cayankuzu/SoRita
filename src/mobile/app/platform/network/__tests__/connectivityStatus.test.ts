import {
  getConnectivityStatusFromHttpProbe,
  getConnectivityStatusFromProbeFailure,
} from '@/mobile/app/platform/network/connectivityStatus';

describe('connectivityStatus', () => {
  it('keeps reachable HTTP responses online even if the backend response is not inspected here', () => {
    expect(getConnectivityStatusFromHttpProbe(150)).toBe('online');
  });

  it('classifies slow probes without turning them into offline false positives', () => {
    expect(getConnectivityStatusFromHttpProbe(3501)).toBe('slow');
  });

  it('does not mark generic probe failures as offline without a native NetInfo offline signal', () => {
    expect(getConnectivityStatusFromProbeFailure(new TypeError('Network request failed'))).toBe('online');
  });

  it('classifies probe aborts as slow instead of offline', () => {
    const error = new Error('The operation was aborted.');
    error.name = 'AbortError';

    expect(getConnectivityStatusFromProbeFailure(error)).toBe('slow');
  });
});
