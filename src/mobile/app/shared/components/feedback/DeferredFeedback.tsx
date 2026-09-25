import React from 'react';

// Sheets, dialogs and viewers that most screens never open: each loads its
// module on first render, so a feed of cards or a profile starts lighter.

export type DeferredActionMenuSheetProps = React.ComponentProps<
  typeof import('@/mobile/app/shared/components/feedback/ActionMenuSheet')['ActionMenuSheet']
>;
type ConfirmActionModalProps = React.ComponentProps<
  typeof import('@/mobile/app/shared/components/feedback/ConfirmActionModal')['ConfirmActionModal']
>;
type ImageLightboxProps = React.ComponentProps<
  typeof import('@/mobile/app/shared/components/feedback/ImageLightbox')['ImageLightbox']
>;
type MediaLightboxProps = React.ComponentProps<
  typeof import('@/mobile/app/shared/components/feedback/MediaLightbox')['MediaLightbox']
>;
type ReportActionSheetProps = React.ComponentProps<
  typeof import('@/mobile/app/shared/components/feedback/ReportActionSheet')['ReportActionSheet']
>;

export function DeferredActionMenuSheet(props: DeferredActionMenuSheetProps) {
  const { ActionMenuSheet } = require('@/mobile/app/shared/components/feedback/ActionMenuSheet') as
    typeof import('@/mobile/app/shared/components/feedback/ActionMenuSheet');
  return <ActionMenuSheet {...props} />;
}

export function DeferredConfirmActionModal(props: ConfirmActionModalProps) {
  const { ConfirmActionModal } = require('@/mobile/app/shared/components/feedback/ConfirmActionModal') as
    typeof import('@/mobile/app/shared/components/feedback/ConfirmActionModal');
  return <ConfirmActionModal {...props} />;
}

export function DeferredImageLightbox(props: ImageLightboxProps) {
  const { ImageLightbox } = require('@/mobile/app/shared/components/feedback/ImageLightbox') as
    typeof import('@/mobile/app/shared/components/feedback/ImageLightbox');
  return <ImageLightbox {...props} />;
}

export function DeferredMediaLightbox(props: MediaLightboxProps) {
  const { MediaLightbox } = require('@/mobile/app/shared/components/feedback/MediaLightbox') as
    typeof import('@/mobile/app/shared/components/feedback/MediaLightbox');
  return <MediaLightbox {...props} />;
}

export function DeferredReportActionSheet(props: ReportActionSheetProps) {
  const { ReportActionSheet } = require('@/mobile/app/shared/components/feedback/ReportActionSheet') as
    typeof import('@/mobile/app/shared/components/feedback/ReportActionSheet');
  return <ReportActionSheet {...props} />;
}
