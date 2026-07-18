import { callJsonEdgeFunction } from '@/mobile/app/platform/api/edgeFunctions';
import { env } from '@/mobile/app/platform/config/env';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { tr } from '@/mobile/app/shared/i18n/tr';

type BaseModerationReportPayload = {
  details?: string;
  reason: string;
  reporterUserId: string;
};

export type ModerationReportPayload =
  | (BaseModerationReportPayload & {
      targetType: 'comment';
      commentId: string;
    })
  | (BaseModerationReportPayload & {
      targetType: 'list';
      listId: string;
    })
  | (BaseModerationReportPayload & {
      targetType: 'place';
      placeId: string;
    })
  | (BaseModerationReportPayload & {
      targetType: 'user';
      targetUserId: string;
    });

async function getReportAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  if (!session?.access_token) {
    throw new Error(tr.settings.sessionMissing);
  }

  return session.access_token;
}

export async function submitModerationReport(payload: ModerationReportPayload) {
  const accessToken = await getReportAccessToken();

  await callJsonEdgeFunction<{ success: true }>(
    env.supabaseModerationReportsFunctionName,
    payload,
    { accessToken },
  );
}
