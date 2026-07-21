import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import {
  Globe,
  Heart,
  Image as ImageIcon,
  Lock,
  MapPin,
} from 'lucide-react-native';

import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { formatCreatedUpdatedInline } from '@/mobile/app/shared/utils/dateTime';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

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
      <Text style={[styles.heroMetaChipText, textToneStyle]}>{label}</Text>
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
          <Pressable
            disabled={!list.coverImage}
            onPress={onOpenCover}
            style={styles.heroMediaButton}
          >
            {list.coverImage ? (
              <>
                <Image source={{ uri: list.coverImage }} style={styles.heroMedia} resizeMode="cover" />
                <View style={styles.heroMediaScrim} />
              </>
            ) : (
              <View style={styles.heroPlaceholder}>
                <View style={styles.heroPlaceholderBadge}>
                  <Text style={styles.heroPlaceholderLabel}>{tr.common.list}</Text>
                </View>
                <View style={styles.heroPlaceholderEmojiWrap}>
                  <Text style={styles.heroPlaceholderEmoji}>{list.emoji || '📍'}</Text>
                </View>
              </View>
            )}
          </Pressable>

          {list.coverImage ? (
            <View style={styles.coverHintChip}>
              <ImageIcon color={colors.onPrimary} size={12} />
              <Text style={styles.coverHintText}>{tr.listDetail.openCover}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.heroBody}>
          <ExpandableText
            text={`${list.emoji ? `${list.emoji} ` : ''}${list.name}`}
            collapsedLines={2}
            textStyle={styles.title}
            showIndicator={false}
          />

          <View style={styles.heroMetaRow}>
            <MetaChip
              icon={
                list.isPublic ? (
                  <Globe color={colors.secondary} size={12} />
                ) : (
                  <Lock color={colors.visibilityPrivate} size={12} />
                )
              }
              label={list.isPublic ? tr.listDetail.public : tr.listDetail.private}
              tone={list.isPublic ? 'accent' : 'neutral'}
            />
            <MetaChip
              icon={<MapPin color={colors.textMuted} size={12} />}
              label={tr.cards.placesCount(list.places.length)}
            />
            {(list.likes || 0) > 0 ? (
              <MetaChip
                icon={<Heart color={colors.danger} fill={colors.danger} size={12} />}
                label={`${list.likes}`}
              />
            ) : null}
          </View>

          {timestampText ? <Text style={styles.heroTimestamp}>{timestampText}</Text> : null}
        </View>
      </View>
    </View>
  );
}
