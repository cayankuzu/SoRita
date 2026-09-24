import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

const editorState = vi.hoisted(() => ({
  buildDraft: vi.fn(),
  goToPreviousStep: vi.fn(),
  isCreatingList: false,
  step: 2,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('@/mobile/app/app-shell/feedback/AppProgressBanner', () => ({
  useAppProgressBanner: () => ({ banner: null }),
}));

vi.mock('@/mobile/app/shared/hooks/useModalAnimationType', () => ({
  useModalAnimationType: () => 'none',
}));

vi.mock('@/mobile/app/shared/utils/interaction', () => ({
  dismissKeyboardAndRunAfterInteractions: (task: () => void | Promise<void>) => task(),
}));

vi.mock('@/mobile/app/features/map/application/usePlaceEditorState', () => ({
  usePlaceEditorState: () => ({
    address: '',
    atmosphere: [],
    bestTimes: [],
    blockingNotice: null,
    buildDraft: editorState.buildDraft,
    canContinue: true,
    clearBlockingNotice: vi.fn(),
    currentMembershipListIds: new Set(),
    dietarySelections: [],
    duplicateListIds: new Set(),
    features: [],
    generalFeatureOptions: [],
    goToNextStep: vi.fn(),
    goToPreviousStep: editorState.goToPreviousStep,
    handleAddMedia: vi.fn(),
    handleCreateList: vi.fn(),
    handleMediaPress: vi.fn(),
    handleMoveMedia: vi.fn(),
    handlePickListCover: vi.fn(),
    handleRemoveMedia: vi.fn(),
    handleSave: vi.fn(),
    isAddingMedia: false,
    isCreatingList: editorState.isCreatingList,
    isPickingListCover: false,
    isSaving: false,
    listSelectionNotice: null,
    media: [],
    menuUrl: '',
    name: '',
    newListCoverImage: '',
    newListDescription: '',
    newListName: '',
    newListPublic: false,
    notes: '',
    priceMax: '',
    priceMin: '',
    priceRangeIsValid: true,
    rating: 0,
    selectedCategories: [],
    selectedLists: [],
    selectedMediaIndex: null,
    setAddress: vi.fn(),
    setMenuUrl: vi.fn(),
    setName: vi.fn(),
    setNewListCoverImage: vi.fn(),
    setNewListDescription: vi.fn(),
    setNewListName: vi.fn(),
    setNewListPublic: vi.fn(),
    setNotes: vi.fn(),
    setPriceMax: vi.fn(),
    setPriceMin: vi.fn(),
    setRating: vi.fn(),
    setShowNewListForm: vi.fn(),
    setStudentFriendly: vi.fn(),
    setTitle: vi.fn(),
    showNewListForm: false,
    step: editorState.step,
    studentFriendly: false,
    title: '',
    toggleAtmosphere: vi.fn(),
    toggleBestTime: vi.fn(),
    toggleCategory: vi.fn(),
    toggleFeature: vi.fn(),
    toggleList: vi.fn(),
  }),
}));

vi.mock('@/mobile/app/features/map/ui/components/place-editor/PlaceEditorBasicsStep', () => ({
  PlaceEditorBasicsStep: (props: Record<string, unknown>) =>
    React.createElement('PlaceEditorBasicsStep', props),
}));

vi.mock('@/mobile/app/features/map/ui/components/place-editor/PlaceEditorDetailsStep', () => ({
  PlaceEditorDetailsStep: (props: Record<string, unknown>) =>
    React.createElement('PlaceEditorDetailsStep', props),
}));

vi.mock('@/mobile/app/features/map/ui/components/place-editor/PlaceEditorFinalStep', () => ({
  PlaceEditorFinalStep: (props: Record<string, unknown>) =>
    React.createElement('PlaceEditorFinalStep', props),
}));

vi.mock('@/mobile/app/features/map/ui/components/place-editor/PlaceEditorModalFooter', () => ({
  PlaceEditorModalFooter: (props: Record<string, unknown>) =>
    React.createElement('PlaceEditorModalFooter', props),
}));

vi.mock('@/mobile/app/features/map/ui/components/place-editor/PlaceEditorModalHeader', () => ({
  PlaceEditorModalHeader: (props: Record<string, unknown>) =>
    React.createElement('PlaceEditorModalHeader', props),
}));

vi.mock('@/mobile/app/features/map/ui/components/place-editor/PlaceEditorTransientNotice', () => ({
  PlaceEditorTransientNotice: (props: Record<string, unknown>) =>
    React.createElement('PlaceEditorTransientNotice', props),
}));

vi.mock('@/mobile/app/features/map/ui/components/place-editor/PlaceEditorWizardHeader', () => ({
  PlaceEditorWizardHeader: (props: Record<string, unknown>) =>
    React.createElement('PlaceEditorWizardHeader', props),
}));

vi.mock('@/mobile/app/shared/components/feedback/ConfirmActionModal', () => ({
  ConfirmActionModal: (props: Record<string, unknown>) =>
    React.createElement('ConfirmActionModal', props),
}));

vi.mock('@/mobile/app/shared/components/feedback/MediaLightbox', () => ({
  MediaLightbox: (props: Record<string, unknown>) => React.createElement('MediaLightbox', props),
}));

import { buildPlaceEditorDraft } from '@/mobile/app/features/map/application/placeEditorPreview';
import { PlaceEditorModal } from '@/mobile/app/features/map/ui/components/PlaceEditorModal';

function initialDraft(name = '') {
  return {
    step: 0,
    name,
    title: '',
    menuUrl: '',
    address: '',
    notes: '',
    selectedCategories: [],
    rating: 0,
    studentFriendly: false,
    priceMin: '',
    priceMax: '',
    selectedLists: [],
    media: [],
    bestTimes: [],
    atmosphere: [],
    features: [],
    newListName: '',
    newListDescription: '',
    newListCoverImage: '',
    newListPublic: false,
    showNewListForm: false,
  };
}

describe('PlaceEditorModal accessibility dismissal', () => {
  it('dismisses on accessibility escape while preserving step-back for the hardware back action', () => {
    editorState.step = 2;
    editorState.isCreatingList = false;
    editorState.buildDraft.mockReturnValue(initialDraft());
    editorState.goToPreviousStep.mockClear();
    const onClose = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <PlaceEditorModal
          visible
          lat={41}
          lng={29}
          lists={[]}
          onClose={onClose}
          onSave={vi.fn()}
        />,
      );
    });

    const modal = renderer.root.find((node) => String(node.type) === 'Modal');
    const modalSurface = renderer.root.find(
      (node) => String(node.type) === 'KeyboardAvoidingView',
    );

    act(() => modalSurface.props.onAccessibilityEscape());
    expect(onClose).toHaveBeenCalledOnce();
    expect(editorState.goToPreviousStep).not.toHaveBeenCalled();

    act(() => modal.props.onRequestClose());
    expect(editorState.goToPreviousStep).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes an untouched editor without asking to discard changes', () => {
    editorState.step = 0;
    editorState.isCreatingList = false;
    // The editor's own draft carries the photo list its builder adds.
    editorState.buildDraft.mockReturnValue(buildPlaceEditorDraft(initialDraft()));
    const onClose = vi.fn();
    const renderModal = () => (
      <PlaceEditorModal
        visible
        lat={41}
        lng={29}
        lists={[]}
        onClose={onClose}
        onSave={vi.fn()}
      />
    );
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(renderModal());
    });
    act(() => renderer.update(renderModal()));
    act(() => {
      renderer.root.find(
        (node) => String(node.type) === 'KeyboardAvoidingView',
      ).props.onAccessibilityEscape();
    });

    expect(onClose).toHaveBeenCalledOnce();
    expect(
      renderer.root.findAll((node) => String(node.type) === 'ConfirmActionModal'),
    ).toHaveLength(0);
  });

  it('keeps dirty confirmation and creation lock on accessibility escape', () => {
    editorState.step = 2;
    editorState.isCreatingList = false;
    editorState.buildDraft.mockReturnValue(initialDraft('edited'));
    const onClose = vi.fn();
    const renderModal = () => (
      <PlaceEditorModal
        visible
        lat={41}
        lng={29}
        lists={[]}
        onClose={onClose}
        onSave={vi.fn()}
      />
    );
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(renderModal());
    });
    act(() => renderer.update(renderModal()));
    act(() => {
      renderer.root.find(
        (node) => String(node.type) === 'KeyboardAvoidingView',
      ).props.onAccessibilityEscape();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(
      renderer.root.findAll((node) => String(node.type) === 'ConfirmActionModal'),
    ).toHaveLength(1);

    editorState.isCreatingList = true;
    act(() => renderer.update(renderModal()));
    const lockedSurface = renderer.root.find(
      (node) => String(node.type) === 'KeyboardAvoidingView',
    );
    act(() => lockedSurface.props.onAccessibilityEscape());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the delete confirmation pending until asynchronous deletion completes', async () => {
    editorState.step = 2;
    editorState.isCreatingList = false;
    editorState.buildDraft.mockReturnValue(initialDraft());
    let resolveDelete!: () => void;
    const deletion = new Promise<void>((resolve) => {
      resolveDelete = resolve;
    });
    const onDelete = vi.fn(() => deletion);
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <PlaceEditorModal
          visible
          lat={41}
          lng={29}
          existingPlace={{
            id: 'place-1',
            name: 'Kafe',
            lat: 41,
            lng: 29,
            addedAt: '2026-01-01T00:00:00.000Z',
          }}
          lists={[]}
          onClose={vi.fn()}
          onDelete={onDelete}
          onSave={vi.fn()}
        />,
      );
    });

    act(() => {
      renderer.root.find(
        (node) => String(node.type) === 'PlaceEditorModalFooter',
      ).props.onDelete();
    });
    const confirmation = renderer.root.find(
      (node) => String(node.type) === 'ConfirmActionModal',
    );
    let completed = false;
    const confirmationPromise = confirmation.props.onConfirm().then(() => {
      completed = true;
    });

    await Promise.resolve();
    expect(onDelete).toHaveBeenCalledWith('place-1');
    expect(completed).toBe(false);

    await act(async () => {
      resolveDelete();
      await confirmationPromise;
    });
    expect(completed).toBe(true);
  });
});
