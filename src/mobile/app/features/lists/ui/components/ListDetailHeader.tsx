import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Flag, Globe, Heart, Lock } from 'lucide-react-native';

import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

import { listDetailScreenStyles as styles } from './listDetailScreenStyles';

type ListDetailHeaderProps = {
  list: PlaceList;
  canReportList: boolean;
  onBack: () => void;
  onOpenCover: () => void;
  onReport: () => void;
};

export function ListDetailHeader({
  list,
  canReportList,
  onBack,
  onOpenCover,
  onReport,
}: ListDetailHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack}>
        <Text style={styles.backLink}>{tr.common.back}</Text>
      </Pressable>

      <View style={styles.headerBody}>
        <View style={styles.headerTitleWrap}>
          <ExpandableText
            text={`${list.emoji ? `${list.emoji} ` : ''}${list.name}`}
            collapsedLines={2}
            textStyle={styles.title}
            showIndicator={false}
          />
          <View style={styles.metaRow}>
            {list.isPublic ? (
              <Globe color={colors.secondary} size={14} />
            ) : (
              <Lock color={colors.textSoft} size={14} />
            )}
            <Text style={styles.metaText}>
              {list.isPublic ? tr.listDetail.public : tr.listDetail.private}
            </Text>
            <Text style={styles.metaText}>- {tr.cards.placesCount(list.places.length)}</Text>
            {(list.likes || 0) > 0 ? (
              <View style={styles.likesRow}>
                <Heart color={colors.danger} size={14} fill={colors.danger} />
                <Text style={styles.metaText}>{list.likes}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.headerAside}>
          <Pressable
            onPress={onOpenCover}
            disabled={!list.coverImage}
            style={styles.coverThumbButton}
          >
            {list.coverImage ? (
              <Image source={{ uri: list.coverImage }} style={styles.coverThumbImage} />
            ) : (
              <View style={styles.coverThumbPlaceholder}>
                <Text style={styles.coverThumbEmoji}>{list.emoji || '[]'}</Text>
              </View>
            )}
          </Pressable>
          {canReportList ? (
            <Pressable style={styles.headerReportButton} onPress={onReport}>
              <Flag color={colors.onPrimary} size={15} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
