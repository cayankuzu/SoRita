import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PLACE_CATEGORY_META } from '@/mobile/app/catalog/placeOptions';
import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { getMapMarkers } from '@/mobile/app/shared/utils/format';

type PlaceEditorPreviewStepProps = {
  previewBestTimes: string[];
  previewCategories: string[];
  previewDietaryOptions: string[];
  previewGeneralFeatures: string[];
  previewPlace: Place;
  previewPriceLabel?: string;
  selectedListCount: number;
  selectedPreviewList: PlaceList | null;
};

export function PlaceEditorPreviewStep({
  previewBestTimes,
  previewCategories,
  previewDietaryOptions,
  previewGeneralFeatures,
  previewPlace,
  previewPriceLabel,
  selectedListCount,
  selectedPreviewList,
}: PlaceEditorPreviewStepProps) {
  return (
    <View style={styles.stepContent}>
      <View style={styles.helperPreviewCard}>
        <Text style={styles.helperPreviewTitle}>Kart on izlemesi</Text>
        <Text style={styles.helperPreviewText}>
          Kullanicilar bu mekani kaydettikten sonra kart yaklasik olarak bu sekilde gorur.
        </Text>
      </View>

      <View style={styles.previewCard}>
        {selectedPreviewList ? (
          <View style={styles.previewListBar}>
            <Text style={styles.previewListBarText}>
              {selectedPreviewList.emoji ? `${selectedPreviewList.emoji} ` : ''}
              {selectedPreviewList.name}
            </Text>
            <Text style={styles.previewListBarMeta}>
              {selectedListCount > 1 ? `+${selectedListCount - 1} liste daha` : 'Secili liste'}
            </Text>
          </View>
        ) : null}

        <MiniMapPreview
          places={getMapMarkers([previewPlace], selectedPreviewList?.isPublic)}
          highlightedIndex={0}
          focusIndex={0}
          interactive={false}
          height={180}
        />

        {previewPlace.photos?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewPhotoRow}>
            {previewPlace.photos.map((item, index) => (
              <Image key={`${item}-${index}`} source={{ uri: item }} style={styles.previewPhotoThumb} />
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.previewBody}>
          {previewPlace.title ? <Text style={styles.previewEyebrow}>{previewPlace.title}</Text> : null}
          <Text style={styles.previewName}>{previewPlace.name}</Text>
          {previewPlace.address ? <Text style={styles.previewAddress}>{previewPlace.address}</Text> : null}
          {previewPlace.notes ? <Text style={styles.previewNotes}>{previewPlace.notes}</Text> : null}
        </View>

        {(previewPlace.rating || previewPlace.studentDiscount || previewPriceLabel) ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewBadgeRow}>
            {previewPlace.rating ? (
              <View style={[styles.previewBadge, styles.previewRatingBadge]}>
                <Text style={styles.previewRatingBadgeText}>{previewPlace.rating.toFixed(1)}/5</Text>
              </View>
            ) : null}
            {previewPlace.studentDiscount ? (
              <View style={[styles.previewBadge, styles.previewStudentBadge]}>
                <Text style={[styles.previewBadgeText, styles.previewStudentBadgeText]}>Ogrenci Dostu</Text>
              </View>
            ) : null}
            {previewPriceLabel ? (
              <View style={styles.previewBadge}>
                <Text style={styles.previewBadgeText}>{previewPriceLabel}</Text>
              </View>
            ) : null}
          </ScrollView>
        ) : null}

        {previewCategories.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewBadgeRow}>
            {previewCategories.map((category) => {
              const meta = PLACE_CATEGORY_META[category] || PLACE_CATEGORY_META.other;

              return (
                <View key={category} style={styles.previewBadge}>
                  <Text style={styles.previewBadgeText}>{meta.emoji ? `${meta.emoji} ${meta.label}` : meta.label}</Text>
                </View>
              );
            })}
          </ScrollView>
        ) : null}

        {previewDietaryOptions.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewBadgeRow}>
            {previewDietaryOptions.map((item) => (
              <View key={item} style={[styles.previewBadge, styles.previewFeatureBadge]}>
                <Text style={[styles.previewBadgeText, styles.previewFeatureBadgeText]}>{item}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {previewBestTimes.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewBadgeRow}>
            {previewBestTimes.map((item) => (
              <View key={item} style={styles.previewBadge}>
                <Text style={styles.previewBadgeText}>{item}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {previewPlace.atmosphere?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewBadgeRow}>
            {previewPlace.atmosphere.map((item) => (
              <View key={item} style={[styles.previewBadge, styles.previewMoodBadge]}>
                <Text style={[styles.previewBadgeText, styles.previewMoodBadgeText]}>{item}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {previewGeneralFeatures.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewBadgeRow}>
            {previewGeneralFeatures.map((item) => (
              <View key={item} style={[styles.previewBadge, styles.previewFeatureBadge]}>
                <Text style={[styles.previewBadgeText, styles.previewFeatureBadgeText]}>{item}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepContent: {
    gap: 16,
  },
  helperPreviewCard: {
    gap: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryBg,
    padding: 14,
  },
  helperPreviewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  helperPreviewText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  previewCard: {
    gap: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    padding: 12,
  },
  previewListBar: {
    minHeight: 42,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewListBarText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  previewListBarMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSoft,
  },
  previewPhotoRow: {
    gap: 10,
  },
  previewPhotoThumb: {
    width: 82,
    height: 82,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  previewBody: {
    gap: 6,
  },
  previewEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSoft,
  },
  previewName: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
  },
  previewAddress: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  previewNotes: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textMuted,
  },
  previewBadgeRow: {
    gap: 10,
  },
  previewBadge: {
    minHeight: 34,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  previewBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  previewRatingBadge: {
    backgroundColor: colors.warningBg,
  },
  previewRatingBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.warningText,
  },
  previewStudentBadge: {
    backgroundColor: colors.primaryBg,
  },
  previewStudentBadgeText: {
    color: colors.primary,
  },
  previewMoodBadge: {
    backgroundColor: '#f3eeff',
  },
  previewMoodBadgeText: {
    color: '#8b5cf6',
  },
  previewFeatureBadge: {
    backgroundColor: colors.successBg,
  },
  previewFeatureBadgeText: {
    color: colors.secondary,
  },
});
