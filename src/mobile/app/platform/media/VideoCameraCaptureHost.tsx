import React from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';

import {
  PLACE_MEDIA_MAX_VIDEO_DURATION_SECONDS,
} from '@/mobile/app/platform/media/mediaConstants';
import { PLACE_MEDIA_MAX_FILE_SIZE_BYTES } from '@/mobile/app/platform/media/placeMediaSize';
import { VideoCameraCaptureView } from '@/mobile/app/platform/media/VideoCameraCaptureView';
import {
  resolveVideoCameraCapture,
  useVideoCameraCaptureState,
} from '@/mobile/app/platform/media/videoCameraCaptureController';
import { useModalAnimationType } from '@/mobile/app/shared/hooks/useModalAnimationType';
import { tr } from '@/mobile/app/shared/i18n/tr';

function clearTimer(timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  if (!timerRef.current) {
    return;
  }

  clearTimeout(timerRef.current);
  timerRef.current = null;
}

function clearIntervalTimer(timerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>) {
  if (!timerRef.current) {
    return;
  }

  clearInterval(timerRef.current);
  timerRef.current = null;
}

export function VideoCameraCaptureHost() {
  const animationType = useModalAnimationType('slide');
  const { options, requestId, visible } = useVideoCameraCaptureState();
  const [
    cameraPermission,
    requestCameraPermission,
    refreshCameraPermission,
  ] = useCameraPermissions();
  const [
    microphonePermission,
    requestMicrophonePermission,
    refreshMicrophonePermission,
  ] = useMicrophonePermissions();
  const [facing, setFacing] = React.useState<'back' | 'front'>('back');
  const [isCameraReady, setIsCameraReady] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [isPermissionRequestInFlight, setIsPermissionRequestInFlight] = React.useState(false);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [cameraMountFailed, setCameraMountFailed] = React.useState(false);
  const [cameraSessionKey, setCameraSessionKey] = React.useState(0);
  const [captureError, setCaptureError] = React.useState<string | null>(null);
  const cameraRef = React.useRef<CameraView | null>(null);
  const autoStopTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureCancelledRef = React.useRef(false);
  const recordingStartedAtRef = React.useRef<number | null>(null);
  const settledRef = React.useRef(false);
  const tickIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRequestedRef = React.useRef(false);
  const maxDurationSeconds = Math.max(
    1,
    options.maxDurationSeconds ?? PLACE_MEDIA_MAX_VIDEO_DURATION_SECONDS,
  );
  const maxDurationMs = maxDurationSeconds * 1000;
  const permissionsGranted = Boolean(cameraPermission?.granted && microphonePermission?.granted);
  const permissionsBlocked = Boolean(
    (!cameraPermission?.granted && cameraPermission?.canAskAgain === false) ||
      (!microphonePermission?.granted && microphonePermission?.canAskAgain === false),
  );
  const countdownMs = Math.max(maxDurationMs - elapsedMs, 0);

  const clearCaptureTimers = React.useCallback(() => {
    clearTimer(autoStopTimeoutRef);
    clearIntervalTimer(tickIntervalRef);
  }, []);

  const resetLocalState = React.useCallback(() => {
    clearCaptureTimers();
    captureCancelledRef.current = false;
    recordingStartedAtRef.current = null;
    settledRef.current = false;
    stopRequestedRef.current = false;
    setElapsedMs(0);
    setFacing('back');
    setCameraMountFailed(false);
    setCameraSessionKey(0);
    setCaptureError(null);
    setIsCameraReady(false);
    setIsRecording(false);
  }, [clearCaptureTimers]);

  React.useEffect(() => {
    if (!visible) {
      resetLocalState();
      return;
    }

    resetLocalState();
  }, [requestId, resetLocalState, visible]);

  React.useEffect(() => {
    return () => {
      clearCaptureTimers();
    };
  }, [clearCaptureTimers]);

  const finishCapture = React.useCallback(
    (result: { durationMs: number; uri: string } | null) => {
      if (settledRef.current) {
        return;
      }

      settledRef.current = true;
      clearCaptureTimers();
      setIsRecording(false);
      resolveVideoCameraCapture(result);
    },
    [clearCaptureTimers],
  );

  const ensurePermissions = React.useCallback(async () => {
    if (!visible || isPermissionRequestInFlight || permissionsGranted || permissionsBlocked) {
      return;
    }

    setIsPermissionRequestInFlight(true);

    try {
      const nextCameraPermission =
        cameraPermission?.granted ? cameraPermission : await requestCameraPermission();

      if (!nextCameraPermission.granted) {
        return;
      }

      const nextMicrophonePermission =
        microphonePermission?.granted
          ? microphonePermission
          : await requestMicrophonePermission();

      if (!nextMicrophonePermission.granted) {
        return;
      }
    } finally {
      setIsPermissionRequestInFlight(false);
    }
  }, [
    cameraPermission,
    isPermissionRequestInFlight,
    microphonePermission,
    permissionsBlocked,
    permissionsGranted,
    requestCameraPermission,
    requestMicrophonePermission,
    visible,
  ]);

  React.useEffect(() => {
    if (!visible) {
      return;
    }

    void ensurePermissions();
  }, [ensurePermissions, requestId, visible]);

  React.useEffect(() => {
    if (!visible || !permissionsBlocked) {
      return;
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void Promise.all([
          refreshCameraPermission(),
          refreshMicrophonePermission(),
        ]);
      }
    });

    return () => subscription.remove();
  }, [
    permissionsBlocked,
    refreshCameraPermission,
    refreshMicrophonePermission,
    visible,
  ]);

  const requestStopRecording = React.useCallback(() => {
    if (!cameraRef.current || stopRequestedRef.current) {
      return;
    }

    stopRequestedRef.current = true;
    cameraRef.current.stopRecording();
  }, []);

  const handleClose = React.useCallback(() => {
    if (isRecording) {
      captureCancelledRef.current = true;
      requestStopRecording();
      return;
    }

    finishCapture(null);
  }, [finishCapture, isRecording, requestStopRecording]);

  const handleStartRecording = React.useCallback(async () => {
    if (
      !cameraRef.current ||
      !isCameraReady ||
      cameraMountFailed ||
      !permissionsGranted ||
      isRecording
    ) {
      return;
    }

    setCaptureError(null);
    captureCancelledRef.current = false;
    stopRequestedRef.current = false;
    recordingStartedAtRef.current = Date.now();
    setElapsedMs(0);
    setIsRecording(true);

    tickIntervalRef.current = setInterval(() => {
      if (!recordingStartedAtRef.current) {
        return;
      }

      const nextElapsedMs = Math.min(Date.now() - recordingStartedAtRef.current, maxDurationMs);
      setElapsedMs(nextElapsedMs);
    }, 250);

    autoStopTimeoutRef.current = setTimeout(() => {
      requestStopRecording();
    }, maxDurationMs);

    try {
      const recording = await cameraRef.current.recordAsync({
        maxDuration: maxDurationSeconds,
        maxFileSize: PLACE_MEDIA_MAX_FILE_SIZE_BYTES,
        ...(Platform.OS === 'ios' ? { codec: 'avc1' as const } : null),
      });

      const measuredDurationMs = recordingStartedAtRef.current
        ? Math.min(Date.now() - recordingStartedAtRef.current, maxDurationMs)
        : maxDurationMs;

      if (captureCancelledRef.current) {
        finishCapture(null);
        return;
      }

      if (!recording?.uri) {
        throw new Error('missing-recording-uri');
      }

      finishCapture({
        durationMs: measuredDurationMs,
        uri: recording.uri,
      });
    } catch {
      if (captureCancelledRef.current) {
        finishCapture(null);
        return;
      }

      clearCaptureTimers();
      recordingStartedAtRef.current = null;
      stopRequestedRef.current = false;
      setIsRecording(false);
      setCaptureError(tr.mediaPicker.videoRecorderUnexpectedError);
    }
  }, [
    cameraMountFailed,
    clearCaptureTimers,
    finishCapture,
    isCameraReady,
    isRecording,
    maxDurationMs,
    maxDurationSeconds,
    permissionsGranted,
    requestStopRecording,
  ]);

  const handleToggleFacing = React.useCallback(() => {
    if (isRecording) {
      return;
    }

    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  }, [isRecording]);

  const handlePermissionAction = React.useCallback(() => {
    if (permissionsBlocked) {
      void Linking.openSettings();
      return;
    }

    void ensurePermissions();
  }, [ensurePermissions, permissionsBlocked]);

  const handleRetryCamera = React.useCallback(() => {
    setCameraMountFailed(false);
    setCaptureError(null);
    setIsCameraReady(false);
    setCameraSessionKey((current) => current + 1);
  }, []);

  const handleCameraReady = React.useCallback(() => {
    setCameraMountFailed(false);
    setIsCameraReady(true);
  }, []);

  const handleCameraMountError = React.useCallback(() => {
    setIsCameraReady(false);
    setCameraMountFailed(true);
  }, []);

  return (
    <VideoCameraCaptureView
      animationType={animationType}
      cameraMountFailed={cameraMountFailed}
      cameraRef={cameraRef}
      cameraSessionKey={cameraSessionKey}
      captureError={captureError}
      countdownMs={countdownMs}
      elapsedMs={elapsedMs}
      facing={facing}
      isCameraReady={isCameraReady}
      isPermissionRequestInFlight={isPermissionRequestInFlight}
      isRecording={isRecording}
      maxDurationMs={maxDurationMs}
      onCameraMountError={handleCameraMountError}
      onCameraReady={handleCameraReady}
      onClose={handleClose}
      onPermissionAction={handlePermissionAction}
      onRetryCamera={handleRetryCamera}
      onStartRecording={handleStartRecording}
      onStopRecording={requestStopRecording}
      onToggleFacing={handleToggleFacing}
      permissionsBlocked={permissionsBlocked}
      permissionsGranted={permissionsGranted}
      requestId={requestId}
      visible={visible}
    />
  );
}
