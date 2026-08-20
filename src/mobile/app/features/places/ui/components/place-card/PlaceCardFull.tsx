import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight, MapPin } from 'lucide-react-native';

import type { Place, PlaceMedia, User } from '@/mobile/app/data/contracts/entities';
import { FeedActionBar } from '@/mobile/app/features/social/public/components';
import { PlaceMenuButton } from '@/mobile/app/features/places/ui/components/place-card/PlaceMenuButton';
import {
  PlaceCardTags,
  PlaceListBar,
  PlacePrimaryMedia,
  PlaceOwnerHeader,
  PlaceSourceBar,
} from '@/mobile/app/features/places/ui/components/place-card/PlaceCardSections';
import type {
  FeedActionComment,
  FeedActionLiker,
} from '@/mobile/app/features/social/public/types';
import { MiniMapInteractionHint } from '@/mobile/app/shared/components/maps/MiniMapInteractionHint';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import {
  formatLocationPlaceCardsCount,
  formatPlaceCardLocation,
} from '@/mobile/app/shared/utils/format';
import { placeCardStyles as styles } from '@/mobile/app/features/places/ui/components/place-card/placeCardStyles';

type MapMarker = {
  lat: number;
  lng: number;
  name: string;
  markerColor: string;
};

type PlaceCardContent = {
  bestTimes: string[];
  categories: string[];
  context?: 'default' | 'list-detail';
  dietaryOptions: string[];
  listCoverImage?: string;
  listEmoji?: string;
  listIsPublic?: boolean;
  listName?: string;
  locationPlaceCardsCount?: number;
  media: PlaceMedia[];
  owner?: User | null;
  place: Place;
  placeTimestampLabels: string[];
  priceLabel?: string;
  sourceAttribution?: Place['sourceAttribution'];
  sourceUser?: User | null;
  specialFeatures: string[];
};

type PlaceCardMap = {
  focusKey: number;
  interactive: boolean;
  markers: MapMarker[];
  previewEnabled: boolean;
  showInteractionHint: boolean;
  visible: boolean;
};

type PlaceCardSocial = {
  allowAddToList: boolean;
  comments: FeedActionComment[];
  currentUserName?: string;
  currentUserPhoto?: string;
  hasNextCommentsPage?: boolean;
  isFetchingNextCommentsPage?: boolean;
  isLiked: boolean;
  likers: FeedActionLiker[];
};

type PlaceCardActions = {
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
  onPressIn?: () => void;
  onRefresh?: () => void;
  onReportPlace: (reason: string, details?: string) => Promise<void> | void;
  onSourcePress?: () => void;
  onUserPress: (userId: string) => void;
  onCommentsVisibilityChange?: (visible: boolean) => void;
  onLikersVisibilityChange?: (visible: boolean) => void;
  showActionMenu?: boolean;
};

type PlaceCardFullProps = {
  actions: PlaceCardActions;
  content: PlaceCardContent;
  map: PlaceCardMap;
  social: PlaceCardSocial;
};

export function PlaceCardFull({
  actions,
  content,
  map,
  social,
}: PlaceCardFullProps) {
  const {
    bestTimes,
    categories,
    context = 'default',
    dietaryOptions,
    listCoverImage,
    listEmoji,
    listIsPublic,
    listName,
    locationPlaceCardsCount,
    media,
    owner,
    place,
    placeTimestampLabels,
    priceLabel,
    sourceAttribution,
    sourceUser,
    specialFeatures,
  } = content;
  const {
    focusKey: mapFocusKey,
    interactive: isMapInteractive,
    markers: mapMarkers,
    previewEnabled: mapPreviewEnabled,
    showInteractionHint: showMapInteractionHint,
    visible: isMapVisible,
  } = map;
  const {
    allowAddToList,
    comments,
    currentUserName,
    currentUserPhoto,
    hasNextCommentsPage = false,
    isFetchingNextCommentsPage = false,
    isLiked,
    likers,
  } = social;
  const {
    onAddToListPress,
    onAddressCopied,
    onCommentDelete,
    onCommentsLoadMore,
    onCommentLikeToggle,
    onCommentReport,
    onCommentSubmit,
    onCommentUpdate,
    onCommentsVisibilityChange,
    onFocusLongPress,
    onFocusPress,
    onLikePress,
    onLikersVisibilityChange,
    onMediaPress,
    onOpenActionMenu,
    onOwnerPress,
    onPlaceNamePress,
    onPress,
    onPressIn,
    onRefresh,
    onReportPlace,
    onSharePress,
    onSourcePress,
    onUserPress,
    showActionMenu = false,
  } = actions;
  const handlePlaceNamePress = () => {
    if (!onPlaceNamePress) {
      return;
    }
    onPlaceNamePress();
  };
  const locationLabel = formatPlaceCardLocation(place.address);

  return (
    <View style={styles.feedCard}>
      {context === 'list-detail' ? null : (
        <PlaceOwnerHeader owner={owner} onPress={onOwnerPress} />
      )}
      <PlaceSourceBar
        attribution={sourceAttribution}
        onPress={onSourcePress}
        sourceUser={sourceUser}
      />
      {context === 'list-detail' ? null : (
        <PlaceListBar
          coverImage={listCoverImage}
          emoji={listEmoji}
          isPublic={listIsPublic}
          name={listName}
          onPress={onPress}
          onPressIn={onPressIn}
        />
      )}

      <PlacePrimaryMedia media={media} onPress={onMediaPress} placeName={place.name} />

      {locationLabel ? (
        <View
          accessibilityLabel={tr.cards.locationAccessibilityLabel(locationLabel)}
          style={styles.locationBar}
        >
          <View style={styles.locationIconWrap}>
            <MapPin color={colors.primary} size={13} strokeWidth={2.2} />
          </View>
          <Text numberOfLines={1} style={styles.locationText}>
            {locationLabel}
          </Text>
        </View>
      ) : null}

      {isMapVisible ? (
        <View style={styles.mapWrap}>
          <MiniMapPreview
            places={mapMarkers}
            loadStaticPreview={mapPreviewEnabled}
            interactive={isMapInteractive}
            instanceId={mapFocusKey}
            highlightedIndex={0}
            focusIndex={0}
            focusTrigger={mapFocusKey}
          />
          <MiniMapInteractionHint visible={showMapInteractionHint} />
        </View>
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
              <View style={styles.contentTitleInline}>
                <Text
                  numberOfLines={2}
                  style={[styles.title, onPlaceNamePress ? styles.titleLink : null]}
                >
                  {place.name}
                </Text>
                {onPlaceNamePress ? (
                  <ChevronRight
                    color={colors.text}
                    size={13}
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
          <PlaceMenuButton menuUrl={place.menuUrl} />
        ) : null}
        {placeTimestampLabels.length > 0 ? (
          <View style={styles.timestampBlock}>
            <Text numberOfLines={2} style={styles.timestampText}>
              {placeTimestampLabels.join('  •  ')}
            </Text>
          </View>
        ) : null}
      </View>

      <PlaceCardTags
        bestTimes={bestTimes}
        categories={categories}
        dietaryOptions={dietaryOptions}
        place={place}
        priceLabel={priceLabel}
        specialFeatures={specialFeatures}
      />

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
