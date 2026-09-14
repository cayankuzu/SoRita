import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  Globe: () => null,
  ImagePlus: () => null,
  Lock: () => null,
  Plus: () => null,
  X: () => null,
}));

vi.mock('@/mobile/app/shared/components/feedback/ImageLightbox', () => ({
  ImageLightbox: () => null,
}));

vi.mock('@/mobile/app/shared/components/media/MediaSelectionPreview', () => ({
  MediaSelectionPreview: (props: Record<string, unknown>) =>
    React.createElement('MediaSelectionPreview', props),
}));

import { PlaceEditorNewListForm } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorNewListForm';
import { tr } from '@/mobile/app/shared/i18n/tr';

describe('PlaceEditorNewListForm', () => {
  it('keeps cover selection and preview as sibling accessibility targets', () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <PlaceEditorNewListForm
          isCreatingList={false}
          isPickingListCover={false}
          newListCoverImage="file:///cover.jpg"
          newListDescription=""
          newListName="Yeni liste"
          newListPublic={false}
          onCreateList={vi.fn()}
          onNewListCoverImageChange={vi.fn()}
          onNewListDescriptionChange={vi.fn()}
          onNewListNameChange={vi.fn()}
          onNewListPublicChange={vi.fn()}
          onPickListCover={vi.fn()}
          onShowNewListFormChange={vi.fn()}
          showNewListForm
        />,
      );
    });

    const pressables = renderer.root.findAll(
      (node) => String(node.type) === 'Pressable',
    );
    const nestedPressables = pressables.filter((pressable) =>
      pressable.findAll(
        (node) => node !== pressable && String(node.type) === 'Pressable',
      ).length > 0,
    );

    expect(nestedPressables).toHaveLength(0);
    expect(
      pressables.some(
        (node) => node.props.accessibilityLabel === tr.placeEditor.chooseCoverPhoto,
      ),
    ).toBe(true);
    expect(
      pressables.some(
        (node) => node.props.accessibilityLabel === tr.listEditor.coverPreviewExpand,
      ),
    ).toBe(true);
  });
});
