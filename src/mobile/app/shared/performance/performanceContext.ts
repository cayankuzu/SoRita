import { Platform } from 'react-native';

const GIB = 1024 ** 3;

export type PerformanceContext = {
  deviceClass: 'high' | 'low' | 'mid' | 'unknown';
  osVersion: string;
  platform: string;
};

function readDeviceTotalMemory() {
  try {
    const Device = require('expo-device') as typeof import('expo-device');
    return Device.totalMemory;
  } catch {
    return null;
  }
}

export function getDevicePerformanceClass(totalMemory?: number | null) {
  if (!totalMemory || totalMemory <= 0) return 'unknown' as const;
  if (totalMemory < 4 * GIB) return 'low' as const;
  if (totalMemory < 8 * GIB) return 'mid' as const;
  return 'high' as const;
}

export function getPerformanceContext(): PerformanceContext {
  return {
    deviceClass: getDevicePerformanceClass(readDeviceTotalMemory()),
    osVersion: String(Platform.Version),
    platform: Platform.OS,
  };
}

export const performanceContextInternals = { GIB };
