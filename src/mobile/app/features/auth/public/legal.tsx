import React from 'react';

export type { LegalDocumentId } from '@/mobile/app/features/auth/ui/content/legalDocuments';

type LegalDocumentSheetProps = React.ComponentProps<
  typeof import('@/mobile/app/features/auth/ui/components/AuthLegalSheet')['AuthLegalSheet']
>;

// The sign-up documents, loaded only when one is opened from Settings.
export function LegalDocumentSheet(props: LegalDocumentSheetProps) {
  const { AuthLegalSheet } = require('@/mobile/app/features/auth/ui/components/AuthLegalSheet') as
    typeof import('@/mobile/app/features/auth/ui/components/AuthLegalSheet');
  return <AuthLegalSheet {...props} />;
}
