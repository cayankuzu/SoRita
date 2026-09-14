import { supabase } from '@/mobile/app/platform/supabase/client';

export async function assertNotificationSessionOwner(expectedUserId: string): Promise<void> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!expectedUserId || session?.user?.id !== expectedUserId) {
    throw new Error('Notification session owner mismatch.');
  }
}
