import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  ChevronRight,
  Clock,
  Globe,
  GraduationCap,
  Leaf,
  List as ListIcon,
  Lock,
  Shapes,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react-native';

import type { Place, User } from '@/mobile/app/data/contracts/entities';
import { FeedActionBar } from '@/mobile/app/features/social/public/components';
import type {
  FeedActionComment,
  FeedActionLiker,
} from '@/mobile/app/features/social/public/types';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { categoryMeta } from '@/mobile/app/shared/utils/format';
import { placeCardStyles as styles } from '@/mobile/app/features/places/ui/components/place-card/placeCardStyles';

type MapMarker = {
  lat: number;
  lng: number;
  name: string;
  markerColor: string;
};

type PlaceCardFullProps = {
  allowAddToList: boolean;
  canReportPlace: boolean;
  categories: string[];
  comments: FeedActionComment[];
  currentUserName?: string;
  currentUserPhoto?: string;
  dietaryOptions: string[];
  isLiked: boolean;
  likers: FeedActionLiker[];
  listCoverImage?: string;
  listEmoji?: string;
  listIsPublic?: boolean;
  listName?: string;
  mapFocusKey: number;
  mapMarkers: MapMarker[];
  onAddToListPress: () => void;
  onAddressCopied: () => void;
  onCommentDelete: (commentId: string) => Promise<void> | void;
  onCommentLikeToggle: (commentId: string) => Promise<void> | void;
  onCommentReport: (commentId: string, reason: string) => Promise<void> | void;
  onCommentSubmit: (content: string, parentCommentId?: string | null) => Promise<void> | void;
  onCommentUpdate: (commentId: string, content: string) => Promise<void> | void;
  onDelete?: () => void;
  onFocusPress: () => void;
  onLikePress: () => Promise<void> | void;
  onOwnerPress?: () => void;
  onPhotoPress: (uri: string) => void;
  onPress?: () => void;
  onRefresh?: () => void;
  onReportPlace: (reason: string) => Promise<void> | void;
  onUserPress: (userId: string) => void;
  owner?: User | null;
  photos: string[];
  place: Place;
  placeTimestampLabels: string[];
  priceLabel?: string;
  specialFeatures: string[];
  bestTimes: string[];
};

export function PlaceCardFull({
  allowAddToList,
  bestTimes,
  canReportPlace,
  categories,
  comments,
  currentUserName,
  currentUserPhoto,
  dietaryOptions,
  isLiked,
  likers,
  listCoverImage,
  listEmoji,
  listIsPublic,
  listName,
  mapFocusKey,
  mapMarkers,
  onAddToListPress,
  onAddressCopied,
  onCommentDelete,
  onCommentLikeToggle,
  onCommentReport,
  onCommentSubmit,
  onCommentUpdate,
  onDelete,
  onFocusPress,
  onLikePress,
  onOwnerPress,
  onPhotoPress,
  onPress,
  onRefresh,
  onReportPlace,
  onUserPress,
  owner,
  photos,
  place,
  placeTimestampLabels,
  priceLabel,
  specialFeatures,
}: PlaceCardFullProps) {
  return (
    <View style={styles.feedCard}>
      {owner ? (
        <Pressable style={styles.userHeader} onPress={onOwnerPress}>
          <AvatarView uri={owner.profilePhoto} name={owner.name} size={36} />
          <View style={styles.userBody}>
            <Text style={styles.userName}>{owner.name}</Text>
            <Text style={styles.userUsername}>@{owner.username}</Text>
          </View>
          {onDelete ? (
            <Pressable onPress={onDelete} style={styles.iconButton}>
              <Trash2 size={16} color={colors.danger} />
            </Pressable>
          ) : null}
        </Pressable>
      ) : null}

      {listName ? (
        <Pressable style={styles.linkBar} onPress={onPress}>
          {listCoverImage ? (
            <Image source={{ uri: listCoverImage }} style={styles.linkBarCover} />
          ) : (
            <View style={styles.linkBarCoverFallback}>
              <ListIcon color={colors.primary} size={18} />
            </View>
          )}
          <View style={styles.linkBarBody}>
            <View style={styles.linkBarTitleRow}>
              <ListIcon color={colors.primary} size={14} />
              <ExpandableText
                text={listEmoji ? `${listEmoji} ${listName}` : listName}
                collapsedLines={1}
                textStyle={styles.linkBarTitle}
                showIndicator={false}
              />
            </View>
            <View style={styles.linkBarMetaRow}>
              {listIsPublic ? (
                <Globe color={colors.secondary} size={13} />
              ) : (
                <Lock color={colors.danger} size={13} />
              )}
              <Text
                style={[
                  styles.linkBarMetaText,
                  !listIsPublic ? styles.linkBarMetaTextPrivate : null,
                ]}
              >
                {listIsPublic ? tr.listDetail.public : tr.listDetail.private}
              </Text>
            </View>
          </View>
          <ChevronRight color={colors.primary} size={16} />
        </Pressable>
      ) : null}

      <View style={styles.mapWrap}>
        <MiniMapPreview
          places={mapMarkers}
          interactive
          highlightedIndex={0}
          focusIndex={0}
          focusTrigger={mapFocusKey}
        />
      </View>

      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
          {photos.map((item, index) => (
            <Pressable key={`${item}-${index}`} onPress={() => onPhotoPress(item)}>
              <Image source={{ uri: item }} style={styles.thumb} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.content}>
        <ExpandableText
          text={place.name}
          collapsedLines={2}
          textStyle={styles.title}
          showIndicator={false}
        />
        {place.title ? (
          <ExpandableText
            text={place.title}
            collapsedLines={1}
            textStyle={styles.eyebrow}
            showIndicator={false}
          />
        ) : null}
        {place.notes ? (
          <ExpandableText text={place.notes} collapsedLines={2} textStyle={styles.description} />
        ) : null}
        {placeTimestampLabels.length > 0 ? (
          <View style={styles.timestampBlock}>
            {placeTimestampLabels.map((label) => (
              <Text key={label} style={styles.timestampText}>
                {label}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.tagSection}>
        {(place.rating || place.studentDiscount || priceLabel) ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
            {place.rating ? (
              <View style={[styles.badge, styles.ratingBadge]}>
                <Star size={12} color={colors.warning} fill={colors.warning} />
                <Text style={[styles.badgeText, styles.ratingBadgeText]}>{place.rating}/5</Text>
              </View>
            ) : null}
            {place.studentDiscount ? (
              <View style={[styles.badge, styles.studentBadge]}>
                <GraduationCap size={12} color={colors.primary} />
                <Text style={[styles.badgeText, styles.studentBadgeText]}>{tr.cards.studentDiscount}</Text>
              </View>
            ) : null}
            {priceLabel ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{priceLabel}</Text>
              </View>
            ) : null}
          </ScrollView>
        ) : null}

        {categories.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
            <View style={styles.inlineIcon}>
              <Shapes size={12} color={colors.primary} />
            </View>
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
          </ScrollView>
        ) : null}

        {dietaryOptions.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
            <View style={styles.inlineIcon}>
              <Leaf size={12} color={colors.secondary} />
            </View>
            {dietaryOptions.map((item) => (
              <View key={item} style={[styles.badge, styles.greenBadge]}>
                <Text style={[styles.badgeText, styles.greenBadgeText]}>{item}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {bestTimes.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
            <View style={styles.inlineIcon}>
              <Clock size={12} color={colors.textSoft} />
            </View>
            {bestTimes.map((item) => (
              <View key={item} style={styles.badge}>
                <Text style={styles.badgeText}>{item}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {place.atmosphere?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
            <View style={styles.inlineIcon}>
              <Sparkles size={12} color={colors.purple} />
            </View>
            {place.atmosphere.map((item) => (
              <View key={item} style={[styles.badge, styles.purpleBadge]}>
                <Text style={[styles.badgeText, styles.purpleBadgeText]}>{item}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {specialFeatures.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
            <View style={styles.inlineIcon}>
              <Star size={12} color={colors.secondary} />
            </View>
            {specialFeatures.map((item) => (
              <View key={item} style={[styles.badge, styles.greenBadge]}>
                <Text style={[styles.badgeText, styles.greenBadgeText]}>{item}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <FeedActionBar
        currentUserName={currentUserName}
        currentUserPhoto={currentUserPhoto}
        liked={isLiked}
        likeCount={place.likes || 0}
        likers={likers}
        comments={comments}
        location={{ name: place.name, address: place.address, lat: place.lat, lng: place.lng }}
        showAddToList={allowAddToList}
        onLikePress={onLikePress}
        onFocusPress={onFocusPress}
        onAddToListPress={onAddToListPress}
        onAddressCopied={onAddressCopied}
        onCommentSubmit={onCommentSubmit}
        onCommentUpdate={onCommentUpdate}
        onCommentDelete={onCommentDelete}
        onCommentReport={onCommentReport}
        onCommentLikeToggle={onCommentLikeToggle}
        onRefresh={onRefresh}
        showReportAction={canReportPlace}
        reportTitle="Mekani bildir"
        reportDescription="Bu mekan kartini neden bildirmek istedigini sec."
        onReportSubmit={onReportPlace}
        onUserPress={onUserPress}
      />
    </View>
  );
}
