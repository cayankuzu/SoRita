import React from 'react';

export type DeferredActionMenuSheetProps = React.ComponentProps<
  typeof import('@/mobile/app/shared/components/feedback/ActionMenuSheet')['ActionMenuSheet']
>;

export function DeferredActionMenuSheet(props: DeferredActionMenuSheetProps) {
  const { ActionMenuSheet } = require('@/mobile/app/shared/components/feedback/ActionMenuSheet') as
    typeof import('@/mobile/app/shared/components/feedback/ActionMenuSheet');
  return <ActionMenuSheet {...props} />;
}
