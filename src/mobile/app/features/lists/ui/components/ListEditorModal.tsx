import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Globe, ImagePlus, Lock, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import { pickSingleImage } from '@/mobile/app/platform/media/images';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type ListEditorModalProps = {
  visible: boolean;
  list: PlaceList | null;
  onClose: () => void;
  onSave: (list: PlaceList) => Promise<void> | void;
};

export function ListEditorModal({
  visible,
  list,
  onClose,
  onSave,
}: ListEditorModalProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<string | undefined>();
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !list) {
      return;
    }

    setName(list.name);
    setDescription(list.description || '');
    setCoverImage(list.coverImage);
    setIsPublic(list.isPublic);
  }, [list, visible]);

  const handlePickCover = async () => {
    const uri = await pickSingleImage();

    if (uri) {
      setCoverImage(uri);
    }
  };

  const handleSave = async () => {
    if (!list || !name.trim() || loading) {
      return;
    }

    setLoading(true);

    try {
      await onSave({
        ...list,
        name: name.trim(),
        description: description.trim() || undefined,
        coverImage,
        isPublic,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.panel}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Listeyi Duzenle</Text>
              <Text style={styles.subtitle}>Mevcut bilgiler dolu geliyor, istediklerini degistirebilirsin.</Text>
            </View>

            <Pressable onPress={onClose} style={styles.closeButton}>
              <X color={colors.textMuted} size={18} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Kapak Fotografi</Text>
              {coverImage ? (
                <View style={styles.coverPreview}>
                  <Image source={{ uri: coverImage }} style={styles.coverImage} resizeMode="cover" />
                  <Pressable onPress={() => setCoverImage('')} style={styles.coverClearButton}>
                    <X color={colors.onPrimary} size={16} />
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.coverPicker} onPress={handlePickCover}>
                  <ImagePlus color={colors.secondary} size={18} />
                  <Text style={styles.coverPickerText}>Kapak fotografi sec</Text>
                </Pressable>
              )}

              {coverImage ? (
                <PrimaryButton
                  title="Kapagi Degistir"
                  variant="secondary"
                  onPress={handlePickCover}
                />
              ) : null}
            </View>

            <View style={styles.section}>
              <TextField
                label="Liste adi"
                value={name}
                onChangeText={setName}
                placeholder="Liste adi"
              />

              <TextField
                label="Aciklama"
                value={description}
                onChangeText={setDescription}
                placeholder="Liste aciklamasi"
                multilineRows={3}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gorunurluk</Text>
              <View style={styles.privacyRow}>
                <Pressable
                  style={[styles.privacyButton, isPublic ? styles.privacyButtonActive : null]}
                  onPress={() => setIsPublic(true)}
                >
                  <Globe color={isPublic ? colors.onPrimary : colors.textMuted} size={14} />
                  <Text style={[styles.privacyText, isPublic ? styles.privacyTextActive : null]}>
                    Herkese acik
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.privacyButton, !isPublic ? styles.privateButtonActive : null]}
                  onPress={() => setIsPublic(false)}
                >
                  <Lock color={!isPublic ? colors.onPrimary : colors.textMuted} size={14} />
                  <Text style={[styles.privacyText, !isPublic ? styles.privacyTextActive : null]}>
                    Gizli
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
            <PrimaryButton
              title="Iptal"
              variant="secondary"
              onPress={onClose}
              style={styles.footerButton}
            />
            <PrimaryButton
              title="Kaydet"
              onPress={() => {
                void handleSave();
              }}
              disabled={!name.trim()}
              loading={loading}
              style={styles.footerButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  panel: {
    maxHeight: '86%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBorder,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSoft,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: 18,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  coverPreview: {
    height: 160,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverClearButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
  },
  coverPicker: {
    minHeight: 72,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.secondary,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  coverPickerText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.secondary,
  },
  privacyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  privacyButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surfaceMuted,
  },
  privacyButtonActive: {
    backgroundColor: colors.secondary,
  },
  privateButtonActive: {
    backgroundColor: colors.textMuted,
  },
  privacyText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
  },
  privacyTextActive: {
    color: colors.onPrimary,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  footerButton: {
    flex: 1,
  },
});
