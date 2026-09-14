import { z } from 'zod';

// These are a server contract, not a UI hint.  Any legal-text change must
// deliberately update this version and the matching mobile document bundle.
export const LEGAL_CONSENT_VERSION = '2026-09-08-terms-community-privacy';
export const REQUIRED_LEGAL_DOCUMENTS = ['community', 'kvkk', 'privacy', 'terms'] as const;

export const legalConsentSchema = z.object({
  acceptedAt: z.string().datetime(),
  documentsAccepted: z.array(z.enum(REQUIRED_LEGAL_DOCUMENTS)).length(REQUIRED_LEGAL_DOCUMENTS.length),
  version: z.literal(LEGAL_CONSENT_VERSION),
}).superRefine((value, context) => {
  const documents = [...value.documentsAccepted].sort();
  if (documents.some((document, index) => document !== REQUIRED_LEGAL_DOCUMENTS[index])) {
    context.addIssue({ code: 'custom', message: 'Guncel yasal belgelerin tumu kabul edilmelidir.' });
  }

  // Reject timestamps that are clearly fabricated while allowing a user to
  // read the documents before submitting the form. The server records its
  // own receipt time below as the authoritative audit timestamp.
  const acceptedAt = Date.parse(value.acceptedAt);
  if (
    !Number.isFinite(acceptedAt)
    || acceptedAt < Date.now() - 24 * 60 * 60_000
    || acceptedAt > Date.now() + 5 * 60_000
  ) {
    context.addIssue({ code: 'custom', message: 'Gecersiz yasal onay zamani.' });
  }
});
