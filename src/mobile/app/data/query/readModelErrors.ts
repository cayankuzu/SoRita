type SupabaseRpcError = {
  code?: string;
  message?: string;
};

const READ_MODEL_FUNCTION_NAMES = [
  'explore_page',
  'feed_page',
  'list_detail_header',
  'list_places_page',
  'notification_unread_count',
  'notifications_page',
  'profile_content_page',
  'profile_summary',
] as const;

export function isMissingReadModelError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const supabaseError = error as SupabaseRpcError;
  const message = supabaseError.message?.toLowerCase() || '';

  return (
    supabaseError.code === '42883' ||
    supabaseError.code === 'PGRST202' ||
    READ_MODEL_FUNCTION_NAMES.some((functionName) => message.includes(functionName))
  );
}
