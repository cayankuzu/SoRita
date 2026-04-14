import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Globe, Lock } from 'lucide-react-native';

import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import { MiniMapPreview } from '@/mobile/app/shared/components/maps/MiniMapPreview';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { getCoverPhoto, getMapMarkers } from '@/mobile/app/shared/utils/format';
import { placeEditorListSelectionStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorListSelectionStyles';

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
      <Text style={styles.sectionHelper}>{tr.placeEditor.targetListsHelper}</Text>
      {listSelectionNotice ? <Text style={styles.listSelectionNotice}>{listSelectionNotice}</Text> : null}
      <View style={styles.listWrap}>
        {lists.map((list) => {
          const selected = selectedLists.includes(list.id);
          const blocked = duplicateListIds.has(list.id) && !currentMembershipListIds.has(list.id);
          const coverPhoto = getCoverPhoto(list);

          return (
            <Pressable
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
                  <MiniMapPreview places={getMapMarkers(list.places, list.isPublic)} height={76} />
                ) : (
                  <View style={styles.listPreviewPlaceholder}>
                    <Text style={styles.listPreviewEmoji}>{list.emoji || tr.placeEditor.defaultEmoji}</Text>
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
                  {blocked ? (
                    <View style={styles.listBlockedBadge}>
                      <Text style={styles.listBlockedBadgeText}>{tr.placeEditor.duplicateListBadge}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.listMetaRow}>
                  <Text style={[styles.listMeta, blocked ? styles.listMetaDisabled : null]}>
                    {tr.cards.placesCount(list.places.length)}
                  </Text>
                  <View style={styles.listPrivacyBadge}>
                    {list.isPublic ? (
                      <Globe color={colors.primary} size={12} />
                    ) : (
                      <Lock color={colors.danger} size={12} />
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
