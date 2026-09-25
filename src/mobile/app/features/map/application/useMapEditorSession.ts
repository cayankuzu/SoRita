import { useCallback, useEffect, useRef, useState } from 'react';

import type { MinimizedEditorState, PanelData } from '@/mobile/app/contracts/mapScreenState';
import type { PlaceEditorDraft } from '@/mobile/app/contracts/placeEditorDraft';

// The place editor on the map: open over the map, minimized to the pill
// (keeping its draft), or locked while a save runs behind the progress banner.
export function useMapEditorSession() {
  const [editorData, setEditorData] = useState<PanelData | null>(null);
  const [editorDraft, setEditorDraft] = useState<PlaceEditorDraft | null>(null);
  const [isEditorInteractionLocked, setIsEditorInteractionLocked] = useState(false);
  const [minimizedEditor, setMinimizedEditor] = useState<MinimizedEditorState | null>(null);
  const [editorFocusTrigger, setEditorFocusTrigger] = useState(0);
  // The progress banner calls back after the render that minimized the editor.
  const minimizedEditorRef = useRef<MinimizedEditorState | null>(null);

  useEffect(() => {
    minimizedEditorRef.current = minimizedEditor;
  }, [minimizedEditor]);

  const focusEditor = useCallback(() => {
    setEditorFocusTrigger((current) => current + 1);
  }, []);

  // No editor, open or minimized, and nothing it held.
  const clearEditor = useCallback(() => {
    setEditorData(null);
    setEditorDraft(null);
    setIsEditorInteractionLocked(false);
    setMinimizedEditor(null);
  }, []);

  // A fresh editor for a point, in place of any other.
  const openEditor = useCallback(
    (panel: PanelData) => {
      setMinimizedEditor(null);
      setEditorDraft(null);
      setIsEditorInteractionLocked(false);
      setEditorData(panel);
      focusEditor();
    },
    [focusEditor],
  );

  const reopenMinimizedEditor = useCallback(() => {
    const minimized = minimizedEditorRef.current;

    if (!minimized) {
      return;
    }

    setEditorData(minimized.panel);
    setMinimizedEditor(null);
    focusEditor();
  }, [focusEditor]);

  // Puts the open editor away with its draft; a save locks it until done.
  const minimizeEditor = useCallback(
    (draft: PlaceEditorDraft, options?: { lockForSave?: boolean }) => {
      if (!editorData) {
        return null;
      }

      setEditorDraft(draft);
      setMinimizedEditor({ panel: editorData, draft });
      setEditorData(null);

      if (options?.lockForSave) {
        setIsEditorInteractionLocked(true);
      }

      focusEditor();
      return editorData;
    },
    [editorData, focusEditor],
  );

  // A failed save hands its draft back so reopening shows what was typed.
  const unlockEditorAfterSaveFailure = useCallback(
    (draft?: PlaceEditorDraft) => {
      setIsEditorInteractionLocked(false);

      if (!draft) {
        return;
      }

      setEditorDraft(draft);

      if (!editorData && minimizedEditor) {
        setMinimizedEditor({ panel: minimizedEditor.panel, draft });
      }
    },
    [editorData, minimizedEditor],
  );

  const restoreEditor = useCallback(
    (state: {
      editorData: PanelData | null;
      editorDraft: PlaceEditorDraft | null;
      minimizedEditor: MinimizedEditorState | null;
    }) => {
      setEditorData(state.editorData);
      setEditorDraft(state.editorDraft);
      setMinimizedEditor(state.minimizedEditor);
    },
    [],
  );

  return {
    clearEditor,
    editorData,
    editorDraft,
    editorFocusTrigger,
    isEditorInteractionLocked,
    minimizeEditor,
    minimizedEditor,
    openEditor,
    reopenMinimizedEditor,
    restoreEditor,
    setEditorData,
    setIsEditorInteractionLocked,
    unlockEditorAfterSaveFailure,
  };
}

export type MapEditorSession = ReturnType<typeof useMapEditorSession>;
