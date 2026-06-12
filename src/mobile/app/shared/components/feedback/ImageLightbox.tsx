import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { colors } from '@/mobile/app/shared/theme/tokens';

type ImageLightboxProps = {
  uri: string | null;
  onClose: () => void;
};

export function ImageLightbox({ uri, onClose }: ImageLightboxProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={Boolean(uri)}
      animationType="fade"
      transparent
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <View style={[styles.overlay, { paddingTop: 16 + insets.top, paddingBottom: 16 + insets.bottom }]}>
        <Pressable style={[styles.close, { top: 16 + insets.top }]} onPress={onClose}>
          <X color={colors.onPrimary} size={20} />
        </Pressable>
        {uri ? (
          <AppImage
            uri={uri}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel="Buyutulmus fotograf"
            backgroundColor="transparent"
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.lightboxOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  close: {
    position: 'absolute',
    top: 54,
    right: 24,
    zIndex: 2,
  },
  image: {
    width: '100%',
    height: '80%',
  },
});
