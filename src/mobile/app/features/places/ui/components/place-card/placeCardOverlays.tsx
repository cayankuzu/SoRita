// The place card's overlays (editor, lightbox, report, confirm, source card), loaded only when one opens so a feed of cards stays light.

import React from 'react';

type ConfirmActionModalProps = React.ComponentProps<
  typeof import('@/mobile/app/shared/components/feedback/ConfirmActionModal')['ConfirmActionModal']
>;

type MediaLightboxProps = React.ComponentProps<
  typeof import('@/mobile/app/shared/components/feedback/MediaLightbox')['MediaLightbox']
>;

type PlaceEditorModalProps = React.ComponentProps<
  typeof import('@/mobile/app/features/map/public/components')['PlaceEditorModal']
>;

type ReportActionSheetProps = React.ComponentProps<
  typeof import('@/mobile/app/shared/components/feedback/ReportActionSheet')['ReportActionSheet']
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

export function DeferredConfirmActionModal(props: ConfirmActionModalProps) {
  const { ConfirmActionModal } = require('@/mobile/app/shared/components/feedback/ConfirmActionModal') as
    typeof import('@/mobile/app/shared/components/feedback/ConfirmActionModal');
  return <ConfirmActionModal {...props} />;
}

export function DeferredMediaLightbox(props: MediaLightboxProps) {
  const { MediaLightbox } = require('@/mobile/app/shared/components/feedback/MediaLightbox') as
    typeof import('@/mobile/app/shared/components/feedback/MediaLightbox');
  return <MediaLightbox {...props} />;
}

export function DeferredPlaceEditorModal(props: PlaceEditorModalProps) {
  const { PlaceEditorModal } = require('@/mobile/app/features/map/public/components') as
    typeof import('@/mobile/app/features/map/public/components');
  return <PlaceEditorModal {...props} />;
}

export function DeferredReportActionSheet(props: ReportActionSheetProps) {
  const { ReportActionSheet } = require('@/mobile/app/shared/components/feedback/ReportActionSheet') as
    typeof import('@/mobile/app/shared/components/feedback/ReportActionSheet');
  return <ReportActionSheet {...props} />;
}

export function DeferredSourcePlaceCardModal(props: SourcePlaceCardModalProps) {
  const { SourcePlaceCardModal } = require('@/mobile/app/features/places/ui/components/place-card/SourcePlaceCardModal') as
    typeof import('@/mobile/app/features/places/ui/components/place-card/SourcePlaceCardModal');
  return <SourcePlaceCardModal {...props} />;
}
