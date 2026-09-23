import React from 'react';
import { View } from 'react-native';
import {
  Globe,
  Heart,
  Image as ImageIcon,
  Lock,
  MapPin,
} from 'lucide-react-native';

import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { formatCreatedUpdatedInline } from '@/mobile/app/shared/utils/dateTime';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize } from '@/mobile/app/shared/theme/tokens';

import { listDetailScreenStyles as styles } from './listDetailScreenStyles';

type ListDetailHeaderProps = {
  list: PlaceList;
  onOpenCover: () => void;
};

type MetaChipProps = {
  icon: React.ReactNode;
  label: string;
  tone?: 'accent' | 'danger' | 'neutral';
};

function MetaChip({ icon, label, tone = 'neutral' }: MetaChipProps) {
  const toneStyle =
    tone === 'accent'
      ? [styles.heroMetaChip, styles.heroMetaChipAccent]
      : tone === 'danger'
        ? [styles.heroMetaChip, styles.heroMetaChipDanger]
        : [styles.heroMetaChip, styles.heroMetaChipNeutral];
  const textToneStyle =
    tone === 'accent'
      ? styles.heroMetaChipTextAccent
      : tone === 'danger'
        ? styles.heroMetaChipTextDanger
        : null;

  return (
    <View style={toneStyle}>
      {icon}
      <AppText style={[styles.heroMetaChipText, textToneStyle]}>{label}</AppText>
    </View>
  );
}

export function ListDetailHeader({
  list,
  onOpenCover,
}: ListDetailHeaderProps) {
  const timestampText = formatCreatedUpdatedInline(list.createdAt, list.updatedAt);

  return (
    <View style={styles.header}>
      <View style={styles.heroCard}>
        <View style={styles.heroMediaWrap}>
          <InstantPressable
            accessibilityLabel={
              list.coverImage ? `${list.name}, ${tr.listDetail.openCover}` : undefined
            }
            accessibilityRole={list.coverImage ? 'imagebutton' : undefined}
            disabled={!list.coverImage}
            onPress={onOpenCover}
            style={styles.heroMediaButton}
          >
            {list.coverImage ? (
              <>
                <AppImage uri={list.coverImage} style={styles.heroMedia} resizeMode="cover" />
                <View style={styles.heroMediaScrim} />
              </>
            ) : (
              <View style={styles.heroPlaceholder}>
                <View style={styles.heroPlaceholderBadge}>
                  <AppText style={styles.heroPlaceholderLabel}>{tr.common.list}</AppText>
                </View>
                <View style={styles.heroPlaceholderEmojiWrap}>
                  <AppText style={styles.heroPlaceholderEmoji}>{list.emoji || '📍'}</AppText>
                </View>
              </View>
            )}
          </InstantPressable>

          {list.coverImage ? (
            <View style={styles.coverHintChip}>
              <ImageIcon color={colors.onPrimary} size={iconSize.xs} />
              <AppText style={styles.coverHintText}>{tr.listDetail.openCover}</AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.heroBody}>
          <AppText accessibilityRole="header" numberOfLines={2} style={styles.title}>
            {`${list.emoji ? `${list.emoji} ` : ''}${list.name}`}
          </AppText>

          <View style={styles.heroMetaRow}>
            <MetaChip
              icon={
                list.isPublic ? (
                  <Globe color={colors.secondary} size={iconSize.xs} />
                ) : (
                  <Lock color={colors.visibilityPrivate} size={iconSize.xs} />
                )
              }
              label={list.isPublic ? tr.listDetail.public : tr.listDetail.private}
              tone={list.isPublic ? 'accent' : 'neutral'}
            />
            <MetaChip
              icon={<MapPin color={colors.textMuted} size={iconSize.xs} />}
              label={tr.cards.placesCount(list.places.length)}
            />
            {(list.likes || 0) > 0 ? (
              <MetaChip
                icon={<Heart color={colors.danger} fill={colors.danger} size={iconSize.xs} />}
                label={`${list.likes}`}
              />
            ) : null}
          </View>

          {timestampText ? <AppText style={styles.heroTimestamp}>{timestampText}</AppText> : null}
        </View>
      </View>
    </View>
  );
}
