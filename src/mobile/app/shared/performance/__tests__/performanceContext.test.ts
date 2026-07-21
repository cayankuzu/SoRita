import { describe, expect, it } from 'vitest';

import {
  getDevicePerformanceClass,
  performanceContextInternals,
} from '@/mobile/app/shared/performance/performanceContext';

describe('performance device classification', () => {
  it('uses stable low-cardinality memory tiers', () => {
    const { GIB } = performanceContextInternals;

    expect(getDevicePerformanceClass(null)).toBe('unknown');
    expect(getDevicePerformanceClass(3 * GIB)).toBe('low');
    expect(getDevicePerformanceClass(6 * GIB)).toBe('mid');
    expect(getDevicePerformanceClass(12 * GIB)).toBe('high');
  });
});
