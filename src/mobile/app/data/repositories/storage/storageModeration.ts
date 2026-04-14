import type { PlaceList } from '@/mobile/app/data/contracts/entities';

type StorageModerationEnv = {
  supabaseDeleteUserFunctionName: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
};

type StorageModerationDependencies = {
  env: StorageModerationEnv;
  supabase: typeof import('@/mobile/app/platform/supabase/client').supabase;
  getListsCache: () => PlaceList[];
  clearCache: () => void;
};

async function extractResponseErrorMessage(response: Response) {
  try {
    const payload = await response.json();

    if (payload && typeof payload === 'object') {
      if ('error' in payload && typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error;
      }

      if ('message' in payload && typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message;
      }
    }
  } catch {
    const text = await response.text().catch(() => '');

    if (text.trim()) {
      return text;
    }
  }

  return `Istek basarisiz oldu (${response.status})`;
}

function isFunctionNotFoundError(message: string) {
  const normalized = message.trim().toLowerCase();
  return normalized.includes('requested function was not found') || normalized.includes('not_found');
}

function getFunctionUrl(env: StorageModerationEnv, functionName: string) {
  const baseUrl = env.supabaseUrl.replace(/\/+$/, '');
  return `${baseUrl}/functions/v1/${functionName}`;
}

export function createStorageModerationRepository({
  env,
  supabase,
  getListsCache,
  clearCache,
}: StorageModerationDependencies) {
  return {
    async reportUser(reporterUserId: string, targetUserId: string, reason: string): Promise<void> {
      if (reporterUserId === targetUserId) {
        throw new Error('Kendi hesabini sikayet edemezsin.');
      }

      const { error } = await supabase.from('user_reports').upsert(
        {
          reporter_user_id: reporterUserId,
          target_user_id: targetUserId,
          reason: reason.trim(),
          created_at: new Date().toISOString(),
        },
        { onConflict: 'reporter_user_id,target_user_id' },
      );

      if (error) {
        throw error;
      }
    },

    async reportList(reporterUserId: string, listId: string, reason: string): Promise<void> {
      const targetList = getListsCache().find((item) => item.id === listId);

      if (targetList && targetList.userId === reporterUserId) {
        throw new Error('Kendi listeni sikayet edemezsin.');
      }

      const { error } = await supabase.from('list_reports').upsert(
        {
          list_id: listId,
          reporter_user_id: reporterUserId,
          reason: reason.trim(),
          created_at: new Date().toISOString(),
        },
        { onConflict: 'list_id,reporter_user_id' },
      );

      if (error) {
        throw error;
      }
    },

    async reportPlace(reporterUserId: string, placeId: string, reason: string): Promise<void> {
      const targetList = getListsCache().find((list) => list.places.some((item) => item.id === placeId));
      const targetPlace = targetList?.places.find((item) => item.id === placeId);
      const targetPlaceOwnerId = targetPlace?.addedBy?.userId || targetList?.userId;

      if (targetPlaceOwnerId && targetPlaceOwnerId === reporterUserId) {
        throw new Error('Kendi mekan kartini sikayet edemezsin.');
      }

      const { error } = await supabase.from('list_place_reports').upsert(
        {
          list_place_id: placeId,
          reporter_user_id: reporterUserId,
          reason: reason.trim(),
          created_at: new Date().toISOString(),
        },
        { onConflict: 'list_place_id,reporter_user_id' },
      );

      if (error) {
        throw error;
      }
    },

    async reportPlaceComment(commentId: string, reporterUserId: string, reason: string): Promise<void> {
      const { error } = await supabase.from('list_place_comment_reports').insert({
        comment_id: commentId,
        reporter_user_id: reporterUserId,
        reason: reason.trim(),
      });

      if (error) {
        throw error;
      }
    },

    async deleteUser(): Promise<void> {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      if (!session?.access_token) {
        throw new Error('Aktif oturum bulunamadi. Lutfen tekrar giris yapip yeniden dene.');
      }

      const functionCandidates = Array.from(
        new Set([env.supabaseDeleteUserFunctionName, 'swift-api', 'delete-user'].filter(Boolean)),
      );

      let lastErrorMessage = 'Hesap silinemedi';

      for (const functionName of functionCandidates) {
        const response = await fetch(getFunctionUrl(env, functionName), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: env.supabasePublishableKey,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const message = await extractResponseErrorMessage(response);
          lastErrorMessage = message;

          if (isFunctionNotFoundError(message)) {
            continue;
          }

          throw new Error(message);
        }

        const payload = await response.json().catch(() => null);

        if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
          throw new Error(payload.error);
        }

        clearCache();
        return;
      }

      throw new Error(lastErrorMessage);
    },
  };
}
