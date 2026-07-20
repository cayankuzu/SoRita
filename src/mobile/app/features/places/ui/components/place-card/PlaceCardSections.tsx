import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  ChevronRight,
  Clock,
  Globe,
  GraduationCap,
  Leaf,
  List as ListIcon,
  Lock,
  Repeat2,
  Shapes,
  Sparkles,
  Star,
} from 'lucide-react-native';

import type { Place, PlaceMedia, User } from '@/mobile/app/data/contracts/entities';
import { placeCardStyles as styles } from '@/mobile/app/features/places/ui/components/place-card/placeCardStyles';
import { MediaThumbnailView } from '@/mobile/app/shared/components/media/MediaThumbnailView';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { categoryMeta } from '@/mobile/app/shared/utils/format';

export function PlaceOwnerHeader({
  onPress,
  owner,
}: {
  onPress?: () => void;
  owner?: User | null;
}) {
  if (!owner) {
    return null;
  }

  return (
    <Pressable style={styles.userHeader} onPress={onPress}>
      <AvatarView uri={owner.profilePhoto} name={owner.name} size={42} />
      <View style={styles.userBody}>
        <Text style={styles.userName}>{owner.name}</Text>
        <Text style={styles.userUsername}>@{owner.username}</Text>
      </View>
    </Pressable>
  );
}

export function PlaceSourceBar({
  attribution,
  onPress,
  sourceUser,
}: {
  attribution?: Place['sourceAttribution'];
  onPress?: () => void;
  sourceUser?: User | null;
}) {
  if (!attribution) {
    return null;
  }

  const name = sourceUser?.name || attribution.userName;

  return (
    <Pressable style={styles.sourceBar} disabled={!onPress} onPress={onPress}>
      <View style={styles.sourceAvatarWrap}>
        <AvatarView
          uri={sourceUser?.profilePhoto || attribution.userAvatar}
          name={name}
          size={34}
        />
        <View style={styles.sourceBarIcon}>
          <Repeat2 color={colors.onPrimary} size={12} />
        </View>
      </View>
      <View style={styles.sourceBarBody}>
        <View style={styles.sourceBarTopRow}>
          <Text numberOfLines={1} style={styles.sourceBarTitle}>{name}</Text>
          {sourceUser?.username ? (
            <Text numberOfLines={1} style={styles.sourceBarUsername}>
              @{sourceUser.username}
            </Text>
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.sourceBarMeta}>
          {tr.cards.quotedFromPlaceCard}
        </Text>
      </View>
      <ChevronRight color={colors.primary} size={16} />
    </Pressable>
  );
}

export function PlaceListBar({
  coverImage,
  emoji,
  isPublic,
  name,
  onPress,
  onPressIn,
}: {
  coverImage?: string;
  emoji?: string;
  isPublic?: boolean;
  name?: string;
  onPress?: () => void;
  onPressIn?: () => void;
}) {
  if (!name) {
    return null;
  }

  return (
    <Pressable style={styles.linkBar} onPress={onPress} onPressIn={onPressIn}>
      {coverImage ? (
        <AppImage
          uri={coverImage}
          style={styles.linkBarCover}
          accessibilityLabel={tr.cards.listCoverImageLabel(name)}
        />
      ) : (
        <View style={styles.linkBarCoverFallback}>
          <ListIcon color={colors.primary} size={18} />
        </View>
      )}
      <View style={styles.linkBarBody}>
        <View style={styles.linkBarTitleRow}>
          <ListIcon color={colors.primary} size={14} />
          <ExpandableText
            text={emoji ? `${emoji} ${name}` : name}
            collapsedLines={1}
            textStyle={styles.linkBarTitle}
            showIndicator={false}
          />
        </View>
        <View style={styles.linkBarMetaRow}>
          {isPublic ? (
            <Globe color={colors.secondary} size={13} />
          ) : (
            <Lock color={colors.danger} size={13} />
          )}
          <Text
            style={[
              styles.linkBarMetaText,
              !isPublic ? styles.linkBarMetaTextPrivate : null,
            ]}
          >
            {isPublic ? tr.listDetail.public : tr.listDetail.private}
          </Text>
        </View>
      </View>
      <ChevronRight color={colors.primary} size={16} />
    </Pressable>
  );
}

export function PlaceMediaStrip({
  media,
  onPress,
  placeName,
}: {
  media: PlaceMedia[];
  onPress: (index: number) => void;
  placeName: string;
}) {
  if (media.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      alwaysBounceVertical={false}
      keyboardShouldPersistTaps="handled"
      overScrollMode="never"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.thumbRow}
    >
      {media.map((item, index) => (
        <Pressable
          key={`${item.url}-${item.type}-${index}`}
          onPress={() => onPress(index)}
          style={styles.thumbPressable}
        >
          <MediaThumbnailView
            item={item}
            priority={index === 0 ? 'high' : 'normal'}
            style={styles.thumb}
            accessibilityLabel={tr.placeEditor.placePhotoLabel(placeName, index + 1)}
            fallbackToVideoPreview={false}
            showDuration
          />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function BadgeRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.badgeRow}
    >
      {children}
    </ScrollView>
  );
}

export function PlaceCardTags({
  bestTimes,
  categories,
  dietaryOptions,
  place,
  priceLabel,
  specialFeatures,
}: {
  bestTimes: string[];
  categories: string[];
  dietaryOptions: string[];
  place: Place;
  priceLabel?: string;
  specialFeatures: string[];
}) {
  return (
    <View style={styles.tagSection}>
      {place.rating || place.studentDiscount || priceLabel ? (
        <BadgeRow>
          {place.rating ? (
            <View style={[styles.badge, styles.ratingBadge]}>
              <Star size={12} color={colors.warning} fill={colors.warning} />
              <Text style={[styles.badgeText, styles.ratingBadgeText]}>{place.rating}/5</Text>
            </View>
          ) : null}
          {place.studentDiscount ? (
            <View style={[styles.badge, styles.studentBadge]}>
              <GraduationCap size={12} color={colors.primary} />
              <Text style={[styles.badgeText, styles.studentBadgeText]}>
                {tr.cards.studentDiscount}
              </Text>
            </View>
          ) : null}
          {priceLabel ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{priceLabel}</Text></View>
          ) : null}
        </BadgeRow>
      ) : null}

      {categories.length > 0 ? (
        <BadgeRow>
          <View style={styles.inlineIcon}><Shapes size={12} color={colors.primary} /></View>
          {categories.map((category) => {
            const meta = categoryMeta[category] || categoryMeta.other;
            return (
              <View key={category} style={styles.badge}>
                <Text style={styles.badgeText}>
                  {meta.emoji ? `${meta.emoji} ${meta.label}` : meta.label}
                </Text>
              </View>
            );
          })}
        </BadgeRow>
      ) : null}

      {dietaryOptions.length > 0 ? (
        <BadgeRow>
          <View style={styles.inlineIcon}><Leaf size={12} color={colors.secondary} /></View>
          {dietaryOptions.map((item) => (
            <View key={item} style={[styles.badge, styles.greenBadge]}>
              <Text style={[styles.badgeText, styles.greenBadgeText]}>{item}</Text>
            </View>
          ))}
        </BadgeRow>
      ) : null}

      {bestTimes.length > 0 ? (
        <BadgeRow>
          <View style={styles.inlineIcon}><Clock size={12} color={colors.textSoft} /></View>
          {bestTimes.map((item) => (
            <View key={item} style={styles.badge}><Text style={styles.badgeText}>{item}</Text></View>
          ))}
        </BadgeRow>
      ) : null}

      {place.atmosphere?.length ? (
        <BadgeRow>
          <View style={styles.inlineIcon}><Sparkles size={12} color={colors.purple} /></View>
          {place.atmosphere.map((item) => (
            <View key={item} style={[styles.badge, styles.purpleBadge]}>
              <Text style={[styles.badgeText, styles.purpleBadgeText]}>{item}</Text>
            </View>
          ))}
        </BadgeRow>
      ) : null}

      {specialFeatures.length > 0 ? (
        <BadgeRow>
          <View style={styles.inlineIcon}><Star size={12} color={colors.secondary} /></View>
          {specialFeatures.map((item) => (
            <View key={item} style={[styles.badge, styles.greenBadge]}>
              <Text style={[styles.badgeText, styles.greenBadgeText]}>{item}</Text>
            </View>
          ))}
        </BadgeRow>
      ) : null}
    </View>
  );
}
