import React from 'react';
import { View } from 'react-native';

import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import { PlaceEditorListCards } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorListCards';
import { PlaceEditorNewListForm } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorNewListForm';
import { placeEditorListSelectionStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorListSelectionStyles';

type PlaceEditorListSelectionSectionProps = {
  currentMembershipListIds: Set<string>;
  duplicateListIds: Set<string>;
  isCreatingList: boolean;
  isPickingListCover: boolean;
  listSelectionNotice?: string | null;
  lists: PlaceList[];
  newListCoverImage: string;
  newListDescription: string;
  newListName: string;
  newListPublic: boolean;
  selectedLists: string[];
  showNewListForm: boolean;
  onCreateList: () => void | Promise<void>;
  onNewListCoverImageChange: (value: string) => void;
  onNewListDescriptionChange: (value: string) => void;
  onNewListNameChange: (value: string) => void;
  onNewListPublicChange: (value: boolean) => void;
  onPickListCover: () => void | Promise<void>;
  onShowNewListFormChange: (value: boolean) => void;
  onToggleList: (listId: string, options?: { blocked?: boolean; listName?: string }) => void;
};

export function PlaceEditorListSelectionSection({
  currentMembershipListIds,
  duplicateListIds,
  isCreatingList,
  isPickingListCover,
  listSelectionNotice,
  lists,
  newListCoverImage,
  newListDescription,
  newListName,
  newListPublic,
  selectedLists,
  showNewListForm,
  onCreateList,
  onNewListCoverImageChange,
  onNewListDescriptionChange,
  onNewListNameChange,
  onNewListPublicChange,
  onPickListCover,
  onShowNewListFormChange,
  onToggleList,
}: PlaceEditorListSelectionSectionProps) {
  return (
    <View style={styles.stepContent}>
      <PlaceEditorListCards
        currentMembershipListIds={currentMembershipListIds}
        duplicateListIds={duplicateListIds}
        listSelectionNotice={listSelectionNotice}
        lists={lists}
        selectedLists={selectedLists}
        onToggleList={onToggleList}
      />
      <PlaceEditorNewListForm
        isCreatingList={isCreatingList}
        isPickingListCover={isPickingListCover}
        newListCoverImage={newListCoverImage}
        newListDescription={newListDescription}
        newListName={newListName}
        newListPublic={newListPublic}
        showNewListForm={showNewListForm}
        onCreateList={onCreateList}
        onNewListCoverImageChange={onNewListCoverImageChange}
        onNewListDescriptionChange={onNewListDescriptionChange}
        onNewListNameChange={onNewListNameChange}
        onNewListPublicChange={onNewListPublicChange}
        onPickListCover={onPickListCover}
        onShowNewListFormChange={onShowNewListFormChange}
      />
    </View>
  );
}
