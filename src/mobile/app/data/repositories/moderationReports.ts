import { onlineManager } from '@tanstack/react-query';

import { enqueueDurableOutboxEntry } from '@/mobile/app/data/outbox/enqueueDurableOutboxEntry';
import type { JsonValue } from '@/mobile/app/data/outbox/outboxStorage';
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

function getReportTargetId(payload: ModerationReportPayload) {
  switch (payload.targetType) {
    case 'comment':
      return payload.commentId;
    case 'list':
      return payload.listId;
    case 'place':
      return payload.placeId;
    case 'user':
      return payload.targetUserId;
  }
}

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
  if (!onlineManager.isOnline()) {
    const { reporterUserId, ...reportPayload } = payload;
    const payloadRef = Object.fromEntries(
      Object.entries(reportPayload).filter(([, value]) => typeof value !== 'undefined'),
    ) as JsonValue;
    await enqueueDurableOutboxEntry({
      idempotencyKey: `moderation-report:${reporterUserId}:${payload.targetType}:${getReportTargetId(payload)}:${payload.reason}`,
      kind: 'moderation-report',
      payloadRef,
      userId: reporterUserId,
    });
    return;
  }

  const accessToken = await getReportAccessToken();

  await callJsonEdgeFunction<{ success: true }>(
    env.supabaseModerationReportsFunctionName,
    payload,
    { accessToken },
  );
}
