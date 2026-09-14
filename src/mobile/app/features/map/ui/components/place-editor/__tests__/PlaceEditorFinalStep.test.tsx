import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  Camera: (props: Record<string, unknown>) => React.createElement('Camera', props),
  ImagePlus: (props: Record<string, unknown>) => React.createElement('ImagePlus', props),
}));

vi.mock('@/mobile/app/features/map/ui/components/place-editor/PlaceEditorControls', () => ({
  OptionRail: (props: Record<string, unknown>) => React.createElement('OptionRail', props),
}));

vi.mock('@/mobile/app/features/map/ui/components/place-editor/PlaceEditorListSelectionSection', () => ({
  PlaceEditorListSelectionSection: (props: Record<string, unknown>) =>
    React.createElement('PlaceEditorListSelectionSection', props),
}));

vi.mock('@/mobile/app/shared/components/media/MediaThumbnailView', () => ({
  MediaThumbnailView: (props: Record<string, unknown>) =>
    React.createElement('MediaThumbnailView', props),
}));

vi.mock('@/mobile/app/shared/components/ui/TextField', () => ({
  TextField: (props: Record<string, unknown>) => React.createElement('TextField', props),
}));

import { PlaceEditorFinalStep } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorFinalStep';

describe('PlaceEditorFinalStep', () => {
  it('delivers the first media action while an editor field still owns the keyboard', () => {
    const noop = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <PlaceEditorFinalStep
          atmosphere={[]}
          currentMembershipListIds={new Set()}
          duplicateListIds={new Set()}
          features={[]}
          generalFeatureOptions={[]}
          isAddingMedia={false}
          isCreatingList={false}
          isPickingListCover={false}
          lists={[]}
          media={[{ type: 'photo', url: 'file:///place.jpg' }]}
          menuUrl=""
          newListCoverImage=""
          newListDescription=""
          newListName=""
          newListPublic={false}
          notes=""
          selectedLists={[]}
          selectedMediaIndex={null}
          showNewListForm={false}
          title=""
          onAddMedia={noop}
          onCreateList={noop}
          onMediaPreview={noop}
          onMediaSelection={noop}
          onMoveMedia={noop}
          onNewListCoverImageChange={noop}
          onNewListDescriptionChange={noop}
          onNewListNameChange={noop}
          onNewListPublicChange={noop}
          onMenuUrlChange={noop}
          onNotesChange={noop}
          onPickListCover={noop}
          onShowNewListFormChange={noop}
          onTitleChange={noop}
          onToggleAtmosphere={noop}
          onToggleFeature={noop}
          onToggleList={noop}
        />,
      );
    });

    const mediaRail = renderer.root.find(
      (node) => String(node.type) === 'ScrollView' && node.props.horizontal === true,
    );

    expect(mediaRail.props.keyboardShouldPersistTaps).toBe('handled');
  });
});
