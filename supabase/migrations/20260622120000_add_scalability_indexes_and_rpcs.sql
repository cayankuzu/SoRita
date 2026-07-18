-- Performance indexes for social network scalability (1000+ concurrent users)
-- These indexes target the most common query patterns.

-- User profile lookups and search
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON public.profiles (lower(username));
-- Follow relationship lookups (who follows whom)
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_created_at
  ON public.user_follows (follower_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_follows_following_created_at
  ON public.user_follows (following_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follow_requests_pending_target_created_at
  ON public.follow_requests (target_user_id, created_at DESC) WHERE status = 'pending';
-- Place likes - user's liked places and place like counts
CREATE INDEX IF NOT EXISTS idx_list_place_likes_user_created_at
  ON public.list_place_likes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_list_place_likes_place_id
  ON public.list_place_likes (list_place_id);
-- Notifications - recipient's unread + recent
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (recipient_user_id, created_at DESC)
  WHERE read = false;
-- Comments - place comment thread ordering
CREATE INDEX IF NOT EXISTS idx_list_place_comments_place_created_at
  ON public.list_place_comments (list_place_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent
  ON public.list_place_comments (parent_comment_id, created_at ASC)
  WHERE parent_comment_id IS NOT NULL;
-- Block lookups
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_user_id
  ON public.user_blocks (blocked_user_id);
-- Lists - owner and public listing
CREATE INDEX IF NOT EXISTS idx_lists_owner_updated
  ON public.lists (owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lists_public_updated
  ON public.lists (updated_at DESC) WHERE is_public = true;
-- Push token cleanup
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id_active
  ON public.user_push_tokens (user_id, is_active, last_seen_at DESC);
-- Request nonce expiry cleanup
CREATE INDEX IF NOT EXISTS request_nonces_expires_at_idx
  ON public.request_nonces (expires_at);
-- Efficient single-user profile fetch RPC (avoids fetching all 400 users)
CREATE OR REPLACE FUNCTION get_public_profile(target_user_id uuid)
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = target_user_id LIMIT 1;
$$;
-- Efficient block state check RPC
CREATE OR REPLACE FUNCTION check_block_state(
  p_current_user_id uuid,
  p_target_user_id uuid
)
RETURNS TABLE(
  is_blocked_by_me boolean,
  is_blocking_me boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS(
      SELECT 1 FROM public.user_blocks
      WHERE blocker_user_id = p_current_user_id AND blocked_user_id = p_target_user_id
    ) AS is_blocked_by_me,
    EXISTS(
      SELECT 1 FROM public.user_blocks
      WHERE blocker_user_id = p_target_user_id AND blocked_user_id = p_current_user_id
    ) AS is_blocking_me;
$$;
-- Rate limiting table for Edge Functions
CREATE TABLE IF NOT EXISTS rate_limits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count int NOT NULL DEFAULT 1,
  CONSTRAINT rate_limits_key_window_unique UNIQUE (key, window_start)
);
-- Enable RLS on rate_limits (only service role can access)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- Cleanup old rate limit entries (run periodically via pg_cron or trigger)
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '5 minutes';
$$;
