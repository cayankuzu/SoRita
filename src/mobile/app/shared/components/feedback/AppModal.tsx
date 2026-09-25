import React from 'react';
// The one file allowed to open react-native's Modal (see eslint.config.js).
// eslint-disable-next-line no-restricted-imports
import { Modal, type ModalProps } from 'react-native';

import { getAndroidModalWindowProps } from '@/mobile/app/shared/utils/modalLayout';

type AppModalProps = {
  animationType: NonNullable<ModalProps['animationType']>;
  children: React.ReactNode;
  // Draw under the navigation bar as well as the status bar. The media picker
  // keeps the system bar, so its own buttons never sit behind it.
  coverNavigationBar?: boolean;
  onRequestClose: () => void;
  // The camera fills the screen with its own opaque window; every other layer
  // draws over the app.
  opaque?: boolean;
  visible: boolean;
};

// The one native modal window in the app. Sheets, dialogs, editors, viewers
// and the camera all open through it, so the window settings (edge-to-edge
// on older Android, over-full-screen presentation, back button) live here
// once; a lint guard keeps react-native's Modal out of every other file.
export function AppModal({
  animationType,
  children,
  coverNavigationBar = true,
  onRequestClose,
  opaque = false,
  visible,
}: AppModalProps) {
  return (
    <Modal
      {...getAndroidModalWindowProps(
        coverNavigationBar
          ? { navigationBarTranslucent: true, statusBarTranslucent: true }
          : { statusBarTranslucent: true },
      )}
      visible={visible}
      transparent={!opaque}
      animationType={animationType}
      hardwareAccelerated
      onRequestClose={onRequestClose}
      presentationStyle={opaque ? 'fullScreen' : 'overFullScreen'}
    >
      {children}
    </Modal>
  );
}
