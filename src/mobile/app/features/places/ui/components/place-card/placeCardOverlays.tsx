// The place card's own overlays (the place editor and the source card), loaded only when one opens so a feed of cards stays light; shared dialogs come from DeferredFeedback.

import React from 'react';

type PlaceEditorModalProps = React.ComponentProps<
  typeof import('@/mobile/app/features/map/public/components')['PlaceEditorModal']
>;

type SourcePlaceCardModalProps = React.ComponentProps<
  typeof import('@/mobile/app/features/places/ui/components/place-card/SourcePlaceCardModal')['SourcePlaceCardModal']
>;

export type PlaceCardOverlay =
  | { type: 'none' }
  | { type: 'add-to-list' }
  | { type: 'lightbox'; index: number }
  | { type: 'owned-delete' }
  | { type: 'owned-editor' }
  | { type: 'report' }
  | { type: 'share-menu' }
  | { type: 'source-place' };

export function renderWhen(
  visible: boolean,
  render: () => React.ReactNode,
) {
  return visible ? render() : null;
}

export function DeferredPlaceEditorModal(props: PlaceEditorModalProps) {
  const { PlaceEditorModal } = require('@/mobile/app/features/map/public/components') as
    typeof import('@/mobile/app/features/map/public/components');
  return <PlaceEditorModal {...props} />;
}

export function DeferredSourcePlaceCardModal(props: SourcePlaceCardModalProps) {
  const { SourcePlaceCardModal } = require('@/mobile/app/features/places/ui/components/place-card/SourcePlaceCardModal') as
    typeof import('@/mobile/app/features/places/ui/components/place-card/SourcePlaceCardModal');
  return <SourcePlaceCardModal {...props} />;
}
