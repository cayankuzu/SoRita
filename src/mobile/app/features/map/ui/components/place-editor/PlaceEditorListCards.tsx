import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Globe, Info, Lock } from 'lucide-react-native';

import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import { placeEditorListSelectionStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorListSelectionStyles';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
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
      <Text style={styles.sectionTitle}>{tr.placeEditor.targetLists}</Text>
      <Text style={styles.sectionHelper}>
        {`${tr.placeEditor.notices.selectionLimit(MAX_SELECTED_LISTS_PER_PLACE_SAVE)} ${tr.placeEditor.targetListsHelper}`}
      </Text>
      {listSelectionNotice ? (
        <View style={styles.listSelectionNotice}>
          <View style={styles.listSelectionNoticeIconWrap}>
            <Info color={colors.warningText} size={12} />
          </View>
          <View style={styles.listSelectionNoticeBody}>
            <Text style={styles.listSelectionNoticeTitle}>{tr.placeEditor.listHintTitle}</Text>
            <Text style={styles.listSelectionNoticeText}>{listSelectionNotice}</Text>
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
                    <Text style={styles.listPreviewEmoji}>
                      {list.emoji || tr.placeEditor.defaultEmoji}
                    </Text>
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
                  <Text style={[styles.listMeta, blocked ? styles.listMetaDisabled : null]}>
                    {tr.cards.placesCount(list.places.length)}
                  </Text>
                  <View style={styles.listPrivacyBadge}>
                    {list.isPublic ? (
                      <Globe color={colors.primary} size={12} />
                    ) : (
                      <Lock color={colors.visibilityPrivate} size={12} />
                    )}
                    <Text style={styles.listPrivacyText}>
                      {list.isPublic ? tr.placeEditor.publicList : tr.placeEditor.privateList}
                    </Text>
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
