import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-camera', () => ({
  CameraView: React.forwardRef<unknown, Record<string, unknown>>((props, ref) =>
    React.createElement('CameraView', { ...props, ref }),
  ),
}));

vi.mock('lucide-react-native', () => ({
  Camera: (props: Record<string, unknown>) => React.createElement('Camera', props),
  RefreshCcw: (props: Record<string, unknown>) => React.createElement('RefreshCcw', props),
  Square: (props: Record<string, unknown>) => React.createElement('Square', props),
  Video: (props: Record<string, unknown>) => React.createElement('Video', props),
  X: (props: Record<string, unknown>) => React.createElement('X', props),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

vi.mock('@/mobile/app/shared/components/ui/IconButton', () => ({
  IconButton: (props: Record<string, unknown>) => React.createElement('IconButton', props),
}));

vi.mock('@/mobile/app/shared/components/ui/PrimaryButton', () => ({
  PrimaryButton: (props: Record<string, unknown>) => React.createElement('PrimaryButton', props),
}));

import { VideoCameraCaptureView } from '@/mobile/app/platform/media/VideoCameraCaptureView';
import { tr } from '@/mobile/app/shared/i18n/tr';

describe('VideoCameraCaptureView accessibility', () => {
  it('announces camera preparation as a busy progress status', () => {
    const props: React.ComponentProps<typeof VideoCameraCaptureView> = {
      animationType: 'none',
      cameraMountFailed: false,
      cameraRef: React.createRef(),
      cameraSessionKey: 1,
      captureError: null,
      countdownMs: 30_000,
      elapsedMs: 0,
      facing: 'back',
      isCameraReady: false,
      isPermissionRequestInFlight: false,
      isRecording: false,
      maxDurationMs: 30_000,
      onCameraMountError: vi.fn(),
      onCameraReady: vi.fn(),
      onClose: vi.fn(),
      onPermissionAction: vi.fn(),
      onRetryCamera: vi.fn(),
      onStartRecording: vi.fn().mockResolvedValue(undefined),
      onStopRecording: vi.fn(),
      onToggleFacing: vi.fn(),
      permissionsBlocked: false,
      permissionsGranted: true,
      requestId: 1,
      visible: true,
    };
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<VideoCameraCaptureView {...props} />);
    });

    const loadingStatus = renderer.root.find(
      (node) =>
        node.props.accessibilityRole === 'progressbar' &&
        node.props.accessibilityLabel === tr.mediaPicker.videoRecorderPreparing,
    );
    expect(loadingStatus.props.accessibilityState).toEqual({ busy: true });
  });
});
