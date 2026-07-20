-- Cover the exact keyset, unread-count and private-media authorization predicates.
-- These indexes are additive and safe to build repeatedly in local/CI environments.

create index if not exists idx_comments_place_top_level_keyset
  on public.list_place_comments (list_place_id, created_at desc, id desc)
  where parent_comment_id is null;

create index if not exists idx_comments_parent_keyset
  on public.list_place_comments (parent_comment_id, created_at asc, id asc)
  where parent_comment_id is not null;

create index if not exists idx_notifications_recipient_unread
  on public.notifications (recipient_user_id, created_at desc, id desc)
  where read is false;

create index if not exists idx_place_media_storage_ref_ready
  on public.list_place_photos (storage_bucket, storage_path)
  where asset_state = 'ready';

create index if not exists idx_place_media_url_ready
  on public.list_place_photos (url)
  where asset_state = 'ready';

create index if not exists idx_place_media_thumbnail_url_ready
  on public.list_place_photos (thumbnail_url)
  where asset_state = 'ready' and thumbnail_url is not null;
