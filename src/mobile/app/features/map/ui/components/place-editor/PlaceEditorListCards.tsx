import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Globe, Info, Lock } from 'lucide-react-native';

import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import { placeEditorListSelectionStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorListSelectionStyles';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize } from '@/mobile/app/shared/theme/tokens';
import { getCoverPhoto } from '@/mobile/app/shared/utils/format';
import {
  getMapMarkers,
  getMarkerColorForPlaceAcrossLists,
} from '@/mobile/app/shared/utils/markerColors';
import { MAX_SELECTED_LISTS_PER_PLACE_SAVE } from '@/mobile/app/shared/validation/contentLimits';

type PlaceEditorListCardsProps = {
  currentMembershipListIds: Set<string>;
  duplicateListIds: Set<string>;
  listSelectionNotice?: string | null;
  lists: PlaceList[];
  selectedLists: string[];
  onToggleList: (listId: string, options?: { blocked?: boolean; listName?: string }) => void;
};

export function PlaceEditorListCards({
  currentMembershipListIds,
  duplicateListIds,
  listSelectionNotice,
  lists,
  selectedLists,
  onToggleList,
}: PlaceEditorListCardsProps) {
  return (
    <View style={styles.section}>
      <AppText style={styles.sectionTitle}>{tr.placeEditor.targetLists}</AppText>
      <AppText style={styles.sectionHelper}>
        {`${tr.placeEditor.notices.selectionLimit(MAX_SELECTED_LISTS_PER_PLACE_SAVE)} ${tr.placeEditor.targetListsHelper}`}
      </AppText>
      {listSelectionNotice ? (
        <View style={styles.listSelectionNotice}>
          <View style={styles.listSelectionNoticeIconWrap}>
            <Info color={colors.warningText} size={iconSize.xs} />
          </View>
          <View style={styles.listSelectionNoticeBody}>
            <AppText style={styles.listSelectionNoticeTitle}>{tr.placeEditor.listHintTitle}</AppText>
            <AppText style={styles.listSelectionNoticeText}>{listSelectionNotice}</AppText>
          </View>
        </View>
      ) : null}
      <View style={styles.listWrap}>
        {lists.map((list) => {
          const selected = selectedLists.includes(list.id);
          const blocked = duplicateListIds.has(list.id) && !currentMembershipListIds.has(list.id);
          const coverPhoto = getCoverPhoto(list);

          return (
            <Pressable
              accessibilityLabel={`${list.name}. ${
                list.isPublic ? tr.placeEditor.publicList : tr.placeEditor.privateList
              }`}
              accessibilityHint={
                blocked
                  ? tr.placeEditor.duplicateListSelectionBlocked(list.name)
                  : tr.placeEditor.targetListsHelper
              }
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled: blocked }}
              key={list.id}
              onPress={() => onToggleList(list.id, { blocked, listName: list.name })}
              style={[
                styles.listCard,
                selected ? styles.listCardSelected : null,
                blocked ? styles.listCardDisabled : null,
              ]}
            >
              <View style={styles.listPreview}>
                {coverPhoto ? (
                  <Image source={{ uri: coverPhoto }} style={StyleSheet.absoluteFillObject} />
                ) : list.places.length > 0 ? (
                  <MiniMapPreview
                    places={getMapMarkers(
                      list.places,
                      list.isPublic,
                      (place) =>
                        getMarkerColorForPlaceAcrossLists(place, lists, list.isPublic),
                    )}
                    height={76}
                  />
                ) : (
                  <View style={styles.listPreviewPlaceholder}>
                    <AppText style={styles.listPreviewEmoji}>
                      {list.emoji || tr.placeEditor.defaultEmoji}
                    </AppText>
                  </View>
                )}
              </View>
              <View
                style={[
                  styles.listRadio,
                  selected ? styles.listRadioSelected : null,
                  blocked ? styles.listRadioDisabled : null,
                ]}
              >
                {selected ? <View style={styles.listRadioInner} /> : null}
              </View>
              <View style={styles.listBody}>
                <View style={styles.listTitleRow}>
                  <ExpandableText
                    text={`${list.emoji ? `${list.emoji} ` : ''}${list.name}`}
                    collapsedLines={1}
                    textStyle={[styles.listName, blocked ? styles.listNameDisabled : null]}
                    showIndicator={false}
                  />
                </View>
                <View style={styles.listMetaRow}>
                  <AppText style={[styles.listMeta, blocked ? styles.listMetaDisabled : null]}>
                    {tr.cards.placesCount(list.places.length)}
                  </AppText>
                  <View style={styles.listPrivacyBadge}>
                    {list.isPublic ? (
                      <Globe color={colors.primary} size={iconSize.xs} />
                    ) : (
                      <Lock color={colors.visibilityPrivate} size={iconSize.xs} />
                    )}
                    <AppText style={styles.listPrivacyText}>
                      {list.isPublic ? tr.placeEditor.publicList : tr.placeEditor.privateList}
                    </AppText>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
