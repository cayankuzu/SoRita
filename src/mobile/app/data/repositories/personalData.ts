import { z } from 'zod';

import { callJsonEdgeFunction } from '@/mobile/app/platform/api/edgeFunctions';
import { hasTruncatedPersonalDataCollection } from '@/mobile/app/data/repositories/personalDataExportMetadata';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { tr } from '@/mobile/app/shared/i18n/tr';

const personalDataExportResponseSchema = z.object({
  data: z.object({ truncated: z.unknown().optional() }).passthrough(),
});

// This response stays in memory until the user chooses a native share target.
// It is deliberately never cached, logged, or added to the offline outbox.
export async function requestCurrentUserPersonalDataExport() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error(tr.settings.sessionMissing);

  const response = await callJsonEdgeFunction('personal-data', { action: 'export' }, {
    accessToken: session.access_token,
    responseSchema: personalDataExportResponseSchema,
    timeoutMs: 60_000,
  });

  return {
    ...response,
    isTruncated: hasTruncatedPersonalDataCollection(response.data.truncated),
  };
}
