import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Camera, RefreshCcw, Square, Video, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PLACE_MEDIA_MAX_VIDEO_DURATION_SECONDS,
  PLACE_MEDIA_TARGET_VIDEO_BITRATE,
  PLACE_MEDIA_TARGET_VIDEO_QUALITY,
} from '@/mobile/app/platform/media/mediaConstants';
import { PLACE_MEDIA_MAX_FILE_SIZE_BYTES } from '@/mobile/app/platform/media/placeMediaSize';
import {
  resolveVideoCameraCapture,
  useVideoCameraCaptureState,
} from '@/mobile/app/platform/media/videoCameraCaptureController';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { getAndroidModalWindowProps } from '@/mobile/app/shared/utils/modalLayout';
import { formatPlaceMediaDuration } from '@/mobile/app/shared/utils/placeMedia';

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
  const insets = useSafeAreaInsets();
  const { options, requestId, visible } = useVideoCameraCaptureState();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [facing, setFacing] = React.useState<'back' | 'front'>('back');
  const [isCameraReady, setIsCameraReady] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [isPermissionRequestInFlight, setIsPermissionRequestInFlight] = React.useState(false);
  const [elapsedMs, setElapsedMs] = React.useState(0);
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
    if (!visible || isPermissionRequestInFlight || permissionsGranted) {
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
    if (!cameraRef.current || !isCameraReady || !permissionsGranted || isRecording) {
      return;
    }

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

      if (!recording?.uri || captureCancelledRef.current) {
        finishCapture(null);
        return;
      }

      finishCapture({
        durationMs: measuredDurationMs,
        uri: recording.uri,
      });
    } catch {
      finishCapture(null);
    }
  }, [
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

  return (
    <Modal
      {...getAndroidModalWindowProps({
        statusBarTranslucent: true,
      })}
      visible={visible}
      animationType="slide"
      hardwareAccelerated
      onRequestClose={handleClose}
      presentationStyle="fullScreen"
    >
      <View style={styles.screen}>
        {permissionsGranted ? (
          <CameraView
            ref={cameraRef}
            active={visible}
            facing={facing}
            mode="video"
            mute={false}
            style={StyleSheet.absoluteFillObject}
            videoBitrate={PLACE_MEDIA_TARGET_VIDEO_BITRATE}
            videoQuality={PLACE_MEDIA_TARGET_VIDEO_QUALITY}
            onCameraReady={() => setIsCameraReady(true)}
          />
        ) : (
          <View style={styles.permissionState}>
            <View style={styles.permissionIconWrap}>
              <Camera color={colors.primary} size={24} />
            </View>
            <Text style={styles.permissionTitle}>{tr.mediaPicker.videoRecorderPermissionTitle}</Text>
            <Text style={styles.permissionDescription}>
              {tr.mediaPicker.videoRecorderPermissionDescription}
            </Text>
            <PrimaryButton
              title={
                isPermissionRequestInFlight
                  ? tr.mediaPicker.videoRecorderPreparing
                  : tr.mediaPicker.videoRecorderGrantPermissions
              }
              onPress={() => {
                void ensurePermissions();
              }}
              loading={isPermissionRequestInFlight}
            />
          </View>
        )}

        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 18) }]}>
          <InstantPressable onPress={handleClose} style={styles.topIconButton}>
            <X color={colors.onPrimary} size={18} />
          </InstantPressable>

          <View style={styles.timerStack}>
            <View style={styles.timerBadge}>
              {isRecording ? <View style={styles.liveDot} /> : null}
              <Text style={styles.timerText}>{formatPlaceMediaDuration(elapsedMs)}</Text>
            </View>
            <Text style={styles.timerHelper}>
              {tr.mediaPicker.videoRecorderAutoStop(
                formatPlaceMediaDuration(maxDurationMs),
                formatPlaceMediaDuration(countdownMs),
              )}
            </Text>
          </View>

          <InstantPressable
            onPress={handleToggleFacing}
            disabled={isRecording}
            style={styles.topIconButton}
          >
            <RefreshCcw color={colors.onPrimary} size={18} />
          </InstantPressable>
        </View>

        {permissionsGranted && !isCameraReady ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={colors.onPrimary} size="large" />
            <Text style={styles.loadingText}>{tr.mediaPicker.videoRecorderPreparing}</Text>
          </View>
        ) : null}

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Text style={styles.bottomHint}>{tr.mediaPicker.videoRecorderHint}</Text>

          <Pressable
            accessibilityLabel={
              isRecording
                ? tr.mediaPicker.videoRecorderStop
                : tr.mediaPicker.videoRecorderStart
            }
            onPress={() => {
              if (isRecording) {
                requestStopRecording();
                return;
              }

              void handleStartRecording();
            }}
            style={({ pressed }) => [
              styles.recordButtonOuter,
              pressed ? styles.recordButtonOuterPressed : null,
            ]}
          >
            <View style={[styles.recordButtonInner, isRecording ? styles.recordButtonInnerActive : null]}>
              {isRecording ? (
                <Square color={colors.onPrimary} fill={colors.onPrimary} size={18} />
              ) : (
                <Video color={colors.onPrimary} size={22} />
              )}
            </View>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cameraBackground,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
  },
  topIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
  },
  timerStack: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.darkOverlay,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },
  timerText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.onPrimary,
  },
  timerHelper: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimary,
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  permissionState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 28,
    backgroundColor: colors.background,
  },
  permissionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  permissionDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 18,
  },
  bottomHint: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
    textAlign: 'center',
  },
  recordButtonOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
    borderWidth: 3,
    borderColor: colors.cameraBorder,
    marginBottom: 4,
  },
  recordButtonOuterPressed: {
    transform: [{ scale: 0.96 }],
  },
  recordButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  recordButtonInnerActive: {
    borderRadius: radius.md,
  },
});
