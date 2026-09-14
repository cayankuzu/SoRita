import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView } from 'expo-camera';
import { Camera, RefreshCcw, Square, Video, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PLACE_MEDIA_TARGET_VIDEO_BITRATE,
  PLACE_MEDIA_TARGET_VIDEO_QUALITY,
} from '@/mobile/app/platform/media/mediaConstants';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  fontWeight,
  radius,
  typography,
} from '@/mobile/app/shared/theme/tokens';
import { getAndroidModalWindowProps } from '@/mobile/app/shared/utils/modalLayout';
import { formatPlaceMediaDuration } from '@/mobile/app/shared/utils/placeMedia';

type VideoCameraCaptureViewProps = {
  animationType: React.ComponentProps<typeof Modal>['animationType'];
  cameraMountFailed: boolean;
  cameraRef: React.RefObject<CameraView | null>;
  cameraSessionKey: number;
  captureError: string | null;
  countdownMs: number;
  elapsedMs: number;
  facing: 'back' | 'front';
  isCameraReady: boolean;
  isPermissionRequestInFlight: boolean;
  isRecording: boolean;
  maxDurationMs: number;
  onCameraMountError: () => void;
  onCameraReady: () => void;
  onClose: () => void;
  onPermissionAction: () => void;
  onRetryCamera: () => void;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => void;
  onToggleFacing: () => void;
  permissionsBlocked: boolean;
  permissionsGranted: boolean;
  requestId: number;
  visible: boolean;
};

export const VideoCameraCaptureView = React.memo(function VideoCameraCaptureView({
  animationType,
  cameraMountFailed,
  cameraRef,
  cameraSessionKey,
  captureError,
  countdownMs,
  elapsedMs,
  facing,
  isCameraReady,
  isPermissionRequestInFlight,
  isRecording,
  maxDurationMs,
  onCameraMountError,
  onCameraReady,
  onClose,
  onPermissionAction,
  onRetryCamera,
  onStartRecording,
  onStopRecording,
  onToggleFacing,
  permissionsBlocked,
  permissionsGranted,
  requestId,
  visible,
}: VideoCameraCaptureViewProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      {...getAndroidModalWindowProps({
        statusBarTranslucent: true,
      })}
      visible={visible}
      animationType={animationType}
      hardwareAccelerated
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <View
        accessibilityViewIsModal
        importantForAccessibility="yes"
        onAccessibilityEscape={onClose}
        style={styles.screen}
      >
        {permissionsGranted ? (
          <CameraView
            key={`${requestId}:${cameraSessionKey}`}
            ref={cameraRef}
            active={visible}
            facing={facing}
            mode="video"
            mute={false}
            style={StyleSheet.absoluteFillObject}
            videoBitrate={PLACE_MEDIA_TARGET_VIDEO_BITRATE}
            videoQuality={PLACE_MEDIA_TARGET_VIDEO_QUALITY}
            onCameraReady={onCameraReady}
            onMountError={onCameraMountError}
          />
        ) : (
          <View style={styles.permissionState}>
            <View style={styles.permissionIconWrap}>
              <Camera color={colors.primary} size={20} />
            </View>
            <Text style={styles.permissionTitle}>{tr.mediaPicker.videoRecorderPermissionTitle}</Text>
            <Text style={styles.permissionDescription}>
              {permissionsBlocked
                ? tr.mediaPicker.videoRecorderPermissionBlockedDescription
                : tr.mediaPicker.videoRecorderPermissionDescription}
            </Text>
            <PrimaryButton
              title={
                permissionsBlocked
                  ? tr.mediaPicker.videoRecorderOpenSettings
                  : isPermissionRequestInFlight
                    ? tr.mediaPicker.videoRecorderPreparing
                    : tr.mediaPicker.videoRecorderGrantPermissions
              }
              onPress={onPermissionAction}
              loading={isPermissionRequestInFlight}
            />
          </View>
        )}

        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 18) }]}>
          <IconButton
            accessibilityLabel={tr.common.close}
            onPress={onClose}
            style={styles.topIconButton}
            variant="inverse"
          >
            <X color={colors.onPrimary} size={16} />
          </IconButton>

          <View style={styles.timerStack}>
            <View style={styles.timerBadge}>
              {isRecording ? <View style={styles.liveDot} /> : null}
              <Text
                accessibilityLabel={tr.mediaPicker.videoRecorderElapsed(
                  formatPlaceMediaDuration(elapsedMs),
                )}
                accessibilityLiveRegion={isRecording ? 'polite' : 'none'}
                style={styles.timerText}
              >
                {formatPlaceMediaDuration(elapsedMs)}
              </Text>
            </View>
            <Text style={styles.timerHelper}>
              {tr.mediaPicker.videoRecorderAutoStop(
                formatPlaceMediaDuration(maxDurationMs),
                formatPlaceMediaDuration(countdownMs),
              )}
            </Text>
          </View>

          <IconButton
            accessibilityLabel={tr.mediaPicker.videoRecorderSwitchCamera}
            onPress={onToggleFacing}
            disabled={isRecording}
            style={styles.topIconButton}
            variant="inverse"
          >
            <RefreshCcw color={colors.onPrimary} size={16} />
          </IconButton>
        </View>

        {permissionsGranted && cameraMountFailed ? (
          <View style={[styles.loadingOverlay, styles.cameraErrorOverlay]}>
            <Text accessibilityLiveRegion="assertive" style={styles.loadingText}>
              {tr.mediaPicker.videoRecorderUnavailable}
            </Text>
            <PrimaryButton
              title={tr.mediaPicker.videoRecorderRetryCamera}
              onPress={onRetryCamera}
            />
          </View>
        ) : permissionsGranted && !isCameraReady ? (
          <View
            accessible
            accessibilityLabel={tr.mediaPicker.videoRecorderPreparing}
            accessibilityRole="progressbar"
            accessibilityState={{ busy: true }}
            accessibilityLiveRegion="polite"
            style={styles.loadingOverlay}
          >
            <ActivityIndicator color={colors.onPrimary} size="large" />
            <Text style={styles.loadingText}>{tr.mediaPicker.videoRecorderPreparing}</Text>
          </View>
        ) : null}

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Text
            accessibilityLiveRegion={captureError ? 'assertive' : 'none'}
            style={[styles.bottomHint, captureError ? styles.bottomHintError : null]}
          >
            {captureError || tr.mediaPicker.videoRecorderHint}
          </Text>

          <Pressable
            accessibilityLabel={
              isRecording
                ? tr.mediaPicker.videoRecorderStop
                : tr.mediaPicker.videoRecorderStart
            }
            accessibilityRole="button"
            accessibilityState={{
              busy: isRecording,
              disabled: !permissionsGranted || !isCameraReady || cameraMountFailed,
            }}
            disabled={!permissionsGranted || !isCameraReady || cameraMountFailed}
            onPress={() => {
              if (isRecording) {
                onStopRecording();
                return;
              }

              void onStartRecording();
            }}
            style={({ pressed }) => [
              styles.recordButtonOuter,
              pressed ? styles.recordButtonOuterPressed : null,
            ]}
          >
            <View style={[styles.recordButtonInner, isRecording ? styles.recordButtonInnerActive : null]}>
              {isRecording ? (
                <Square color={colors.onPrimary} fill={colors.onPrimary} size={16} />
              ) : (
                <Video color={colors.onPrimary} size={20} />
              )}
            </View>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

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
    gap: 10,
    paddingHorizontal: 14,
  },
  topIconButton: {
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
  },
  timerStack: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.darkOverlay,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  timerText: {
    ...typography.bodyText,
    fontWeight: fontWeight.strong,
    color: colors.onPrimary,
  },
  timerHelper: {
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.onPrimary,
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.onPrimary,
    textAlign: 'center',
  },
  cameraErrorOverlay: {
    gap: 14,
    paddingHorizontal: 24,
    backgroundColor: colors.darkOverlay,
  },
  permissionState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 22,
    backgroundColor: colors.background,
  },
  permissionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
  },
  permissionTitle: {
    ...typography.section,
    color: colors.text,
    textAlign: 'center',
  },
  permissionDescription: {
    ...typography.compactBodyText,
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
    gap: 12,
    paddingHorizontal: 14,
  },
  bottomHint: {
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.onPrimary,
    textAlign: 'center',
  },
  bottomHintError: {
    color: colors.warning,
  },
  recordButtonOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
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
    width: 50,
    height: 50,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  recordButtonInnerActive: {
    borderRadius: radius.md,
  },
});
