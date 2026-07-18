import React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  ChevronRight,
  Clock,
  ExternalLink,
  Globe,
  GraduationCap,
  Leaf,
  List as ListIcon,
  Lock,
  Repeat2,
  Shapes,
  Sparkles,
  Star,
  UtensilsCrossed,
} from 'lucide-react-native';

import type { Place, PlaceMedia, User } from '@/mobile/app/data/contracts/entities';
import { FeedActionBar } from '@/mobile/app/features/social/public/components';
import type {
  FeedActionComment,
  FeedActionLiker,
} from '@/mobile/app/features/social/public/types';
import { MiniMapInteractionHint } from '@/mobile/app/shared/components/maps/MiniMapInteractionHint';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import { MediaThumbnailView } from '@/mobile/app/shared/components/media/MediaThumbnailView';
import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { openSafeExternalUrl } from '@/mobile/app/shared/utils/safeLinks';
import { categoryMeta, formatLocationPlaceCardsCount } from '@/mobile/app/shared/utils/format';
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
  isFetchingNextCommentsPage?: boolean;
  likers: FeedActionLiker[];
  listCoverImage?: string;
  listEmoji?: string;
  listIsPublic?: boolean;
  listName?: string;
  isMapInteractive: boolean;
  locationPlaceCardsCount?: number;
  mapFocusKey: number;
  mapMarkers: MapMarker[];
  showMapInteractionHint: boolean;
  onAddToListPress: () => void;
  onAddressCopied: () => void;
  onCommentDelete: (commentId: string) => Promise<void> | void;
  onCommentsLoadMore?: () => Promise<void> | void;
  onCommentLikeToggle: (commentId: string) => Promise<void> | void;
  onCommentReport: (commentId: string, reason: string, details?: string) => Promise<void> | void;
  onCommentSubmit: (content: string, parentCommentId?: string | null) => Promise<void> | void;
  onCommentUpdate: (commentId: string, content: string) => Promise<void> | void;
  onFocusPress: () => void;
  onFocusLongPress: () => void;
  onLikePress: () => Promise<void> | void;
  onSharePress?: () => void;
  onOpenActionMenu?: () => void;
  onOwnerPress?: () => void;
  onMediaPress: (index: number) => void;
  onPlaceNamePress?: () => void;
  onPress?: () => void;
  onRefresh?: () => void;
  onReportPlace: (reason: string, details?: string) => Promise<void> | void;
  onSourcePress?: () => void;
  onUserPress: (userId: string) => void;
  onCommentsVisibilityChange?: (visible: boolean) => void;
  onLikersVisibilityChange?: (visible: boolean) => void;
  owner?: User | null;
  media: PlaceMedia[];
  place: Place;
  placeTimestampLabels: string[];
  priceLabel?: string;
  specialFeatures: string[];
  sourceAttribution?: Place['sourceAttribution'];
  sourceUser?: User | null;
  showActionMenu?: boolean;
  bestTimes: string[];
  hasNextCommentsPage?: boolean;
};

export function PlaceCardFull({
  allowAddToList,
  bestTimes,
  canReportPlace: _canReportPlace,
  categories,
  comments,
  currentUserName,
  currentUserPhoto,
  dietaryOptions,
  isLiked,
  isFetchingNextCommentsPage = false,
  likers,
  listCoverImage,
  listEmoji,
  listIsPublic,
  listName,
  isMapInteractive,
  locationPlaceCardsCount,
  mapFocusKey,
  mapMarkers,
  showMapInteractionHint,
  onAddToListPress,
  onAddressCopied,
  onCommentDelete,
  onCommentsLoadMore,
  onCommentLikeToggle,
  onCommentReport,
  onCommentSubmit,
  onCommentUpdate,
  onFocusPress,
  onFocusLongPress,
  onLikePress,
  onSharePress,
  onOpenActionMenu,
  onOwnerPress,
  onMediaPress,
  onPlaceNamePress,
  onPress,
  onRefresh,
  onReportPlace,
  onSourcePress,
  onUserPress,
  onCommentsVisibilityChange,
  onLikersVisibilityChange,
  owner,
  media,
  place,
  placeTimestampLabels,
  priceLabel,
  specialFeatures,
  sourceAttribution,
  sourceUser,
  showActionMenu = false,
  hasNextCommentsPage = false,
}: PlaceCardFullProps) {
  const [isPlaceNameExpanded, setIsPlaceNameExpanded] = React.useState(false);
  const [isPlaceNameTruncated, setIsPlaceNameTruncated] = React.useState(false);
  const [menuUrlExpanded, setMenuUrlExpanded] = React.useState(false);
  const menuLongPressHandledRef = React.useRef(false);

  React.useEffect(() => {
    setIsPlaceNameExpanded(false);
    setIsPlaceNameTruncated(false);
  }, [place.id, place.name, onPlaceNamePress]);

  React.useEffect(() => {
    setMenuUrlExpanded(false);
  }, [place.id, place.menuUrl]);

  const handlePlaceNamePress = () => {
    if (!onPlaceNamePress) {
      return;
    }

    if (isPlaceNameTruncated && !isPlaceNameExpanded) {
      setIsPlaceNameExpanded(true);
      return;
    }

    setIsPlaceNameExpanded(false);
    onPlaceNamePress();
  };

  const handleMenuUrlPress = () => {
    if (!place.menuUrl) {
      return;
    }

    setMenuUrlExpanded((current) => !current);
    showToast(tr.cards.menuLinkHoldHint, 'info');
  };

  const handleMenuUrlLongPress = async () => {
    if (!place.menuUrl) {
      return;
    }

    menuLongPressHandledRef.current = true;
    const opened = await openSafeExternalUrl(place.menuUrl);

    if (!opened) {
      showToast(tr.cards.menuLinkUnsafe, 'error');
    }
  };

  return (
    <View style={styles.feedCard}>
      {owner ? (
        <Pressable style={styles.userHeader} onPress={onOwnerPress}>
          <AvatarView uri={owner.profilePhoto} name={owner.name} size={42} />
          <View style={styles.userBody}>
            <Text style={styles.userName}>{owner.name}</Text>
            <Text style={styles.userUsername}>@{owner.username}</Text>
          </View>
        </Pressable>
      ) : null}

      {sourceAttribution ? (
        <Pressable
          style={styles.sourceBar}
          disabled={!onSourcePress}
          onPress={onSourcePress}
        >
          <View style={styles.sourceAvatarWrap}>
            <AvatarView
              uri={sourceUser?.profilePhoto || sourceAttribution.userAvatar}
              name={sourceUser?.name || sourceAttribution.userName}
              size={34}
            />
            <View style={styles.sourceBarIcon}>
              <Repeat2 color={colors.onPrimary} size={12} />
            </View>
          </View>
          <View style={styles.sourceBarBody}>
            <View style={styles.sourceBarTopRow}>
              <Text numberOfLines={1} style={styles.sourceBarTitle}>
                {sourceUser?.name || sourceAttribution.userName}
              </Text>
              {sourceUser?.username ? (
                <Text numberOfLines={1} style={styles.sourceBarUsername}>
                  @{sourceUser.username}
                </Text>
              ) : null}
            </View>
            <Text numberOfLines={1} style={styles.sourceBarMeta}>
              Mekân kartından alıntılandı
            </Text>
          </View>
          <ChevronRight color={colors.primary} size={16} />
        </Pressable>
      ) : null}

      {listName ? (
        <Pressable style={styles.linkBar} onPress={onPress}>
          {listCoverImage ? (
            <AppImage
              uri={listCoverImage}
              style={styles.linkBarCover}
              accessibilityLabel={tr.cards.listCoverImageLabel(listName)}
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
          interactive={isMapInteractive}
          instanceId={mapFocusKey}
          highlightedIndex={0}
          focusIndex={0}
          focusTrigger={mapFocusKey}
        />
        <MiniMapInteractionHint visible={showMapInteractionHint} />
      </View>

      {media.length > 0 ? (
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
              onPress={() => onMediaPress(index)}
              style={styles.thumbPressable}
            >
              <MediaThumbnailView
                item={item}
                style={styles.thumb}
                accessibilityLabel={`${place.name} fotograf ${index + 1}`}
                fallbackToVideoPreview={false}
                showDuration
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.content}>
        <View style={styles.contentTitleRow}>
          <Pressable
            accessibilityRole={onPlaceNamePress ? 'button' : undefined}
            disabled={!onPlaceNamePress}
            hitSlop={6}
            onPress={(event) => {
              event.stopPropagation();
              handlePlaceNamePress();
            }}
            style={({ pressed }) => [
              styles.contentTitleButton,
              onPlaceNamePress ? styles.contentTitleButtonInteractive : null,
              pressed && onPlaceNamePress ? styles.contentTitleButtonPressed : null,
            ]}
          >
            <View style={styles.contentTitleStack}>
              <Text
                onTextLayout={(event) => {
                  const nextIsTruncated = event.nativeEvent.lines.length > 1;
                  setIsPlaceNameTruncated((current) =>
                    current === nextIsTruncated ? current : nextIsTruncated,
                  );
                }}
                pointerEvents="none"
                style={[
                  styles.title,
                  onPlaceNamePress ? styles.titleLink : null,
                  styles.contentTitleMeasureText,
                ]}
              >
                {place.name}
              </Text>
              <View style={styles.contentTitleInline}>
                <Text
                  numberOfLines={isPlaceNameExpanded ? undefined : 1}
                  style={[styles.title, onPlaceNamePress ? styles.titleLink : null]}
                >
                  {place.name}
                </Text>
                {onPlaceNamePress ? (
                  <ChevronRight
                    color={colors.primary}
                    size={15}
                    strokeWidth={2.3}
                    style={styles.contentTitleChevron}
                  />
                ) : null}
              </View>
              {locationPlaceCardsCount != null ? (
                <Text style={styles.titleMeta}>
                  {formatLocationPlaceCardsCount(locationPlaceCardsCount)}
                </Text>
              ) : null}
            </View>
          </Pressable>
        </View>
        {place.title ? (
          <ExpandableText
            text={place.title}
            collapsedLines={1}
            preserveLineBreaks
            maxCollapsedLinesWhenPreservingBreaks={3}
            textStyle={styles.eyebrow}
            showIndicator={false}
          />
        ) : null}
        {place.notes ? (
          <ExpandableText
            text={place.notes}
            collapsedLines={2}
            preserveLineBreaks
            maxCollapsedLinesWhenPreservingBreaks={4}
            textStyle={styles.description}
          />
        ) : null}
        {place.menuUrl ? (
          <Pressable
            accessibilityHint={
              menuUrlExpanded
                ? tr.cards.menuLinkHoldHint
                : tr.cards.menuLinkExpandHint
            }
            accessibilityRole="button"
            accessibilityState={{ expanded: menuUrlExpanded }}
            delayLongPress={500}
            onLongPress={() => {
              void handleMenuUrlLongPress();
            }}
            onPressIn={() => {
              menuLongPressHandledRef.current = false;
            }}
            onPress={(event) => {
              event.stopPropagation();
              if (menuLongPressHandledRef.current) {
                menuLongPressHandledRef.current = false;
                return;
              }

              handleMenuUrlPress();
            }}
            style={({ pressed }) => [
              styles.menuLinkCard,
              pressed ? styles.menuLinkCardPressed : null,
            ]}
          >
            <View style={styles.menuLinkHeader}>
              <UtensilsCrossed color={colors.primary} size={14} />
              <Text style={styles.menuLinkLabel}>{tr.cards.menuLinkLabel}</Text>
              {menuUrlExpanded ? (
                <ExternalLink color={colors.primary} size={14} style={styles.menuLinkHeaderIcon} />
              ) : (
                <ChevronRight color={colors.primary} size={14} style={styles.menuLinkHeaderIcon} />
              )}
            </View>
            <View style={styles.menuLinkBody}>
              <Text
                numberOfLines={menuUrlExpanded ? undefined : 1}
                selectable={false}
                style={styles.menuLinkText}
              >
                {place.menuUrl}
              </Text>
              {menuUrlExpanded ? (
                <Text style={styles.menuLinkHelper}>{tr.cards.menuLinkHoldHint}</Text>
              ) : null}
            </View>
          </Pressable>
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
        commentCount={place.commentCount}
        likers={likers}
        comments={comments}
        location={{ name: place.name, address: place.address, lat: place.lat, lng: place.lng }}
        showShareAction
        showAddToList={allowAddToList}
        onLikePress={onLikePress}
        onSharePress={onSharePress}
        onFocusPress={onFocusPress}
        onFocusLongPress={onFocusLongPress}
        focusActionActive={isMapInteractive}
        onAddToListPress={onAddToListPress}
        onAddressCopied={onAddressCopied}
        onCommentSubmit={onCommentSubmit}
        onCommentUpdate={onCommentUpdate}
        onCommentDelete={onCommentDelete}
        onCommentsLoadMore={onCommentsLoadMore}
        onCommentReport={onCommentReport}
        onCommentLikeToggle={onCommentLikeToggle}
        onRefresh={onRefresh}
        hasNextCommentsPage={hasNextCommentsPage}
        isFetchingNextCommentsPage={isFetchingNextCommentsPage}
        onCommentsVisibilityChange={onCommentsVisibilityChange}
        onLikersVisibilityChange={onLikersVisibilityChange}
        showOverflowAction={showActionMenu}
        onOverflowPress={onOpenActionMenu}
        showReportAction={false}
        reportTitle={tr.cards.reportContentTitle}
        reportDescription={tr.cards.reportContentDescription}
        onReportSubmit={onReportPlace}
        onUserPress={onUserPress}
      />
    </View>
  );
}
