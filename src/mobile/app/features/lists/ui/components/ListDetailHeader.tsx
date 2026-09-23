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
import { ListCoverFallback } from '@/mobile/app/shared/components/media/ListCoverFallback';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { Badge } from '@/mobile/app/shared/components/ui/Badge';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { formatCreatedUpdatedInline } from '@/mobile/app/shared/utils/dateTime';
import { tr } from '@/mobile/app/shared/i18n/tr';

import { listDetailScreenStyles as styles } from './listDetailScreenStyles';

type ListDetailHeaderProps = {
  list: PlaceList;
  onOpenCover: () => void;
};

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
              // The same designed cover the list shows on Explore and on profiles.
              <View style={styles.heroMedia}>
                <ListCoverFallback emoji={list.emoji || tr.placeEditor.defaultEmoji} seed={list.id} />
              </View>
            )}
          </InstantPressable>

          {list.coverImage ? (
            <Badge
              icon={ImageIcon}
              label={tr.listDetail.openCover}
              style={styles.coverHint}
              tone="overlay"
            />
          ) : null}
        </View>

        <View style={styles.heroBody}>
          <AppText accessibilityRole="header" numberOfLines={2} style={styles.title}>
            {`${list.emoji ? `${list.emoji} ` : ''}${list.name}`}
          </AppText>

          <View style={styles.heroMetaRow}>
            <Badge
              icon={list.isPublic ? Globe : Lock}
              label={list.isPublic ? tr.listDetail.public : tr.listDetail.private}
              tone={list.isPublic ? 'success' : 'neutral'}
            />
            <Badge icon={MapPin} label={tr.cards.placesCount(list.places.length)} numeric />
            {(list.likes || 0) > 0 ? (
              <Badge icon={Heart} iconFilled label={`${list.likes}`} numeric tone="danger" />
            ) : null}
          </View>

          {timestampText ? <AppText style={styles.heroTimestamp}>{timestampText}</AppText> : null}
        </View>
      </View>
    </View>
  );
}
