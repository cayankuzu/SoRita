-- Keep Storage enforcement aligned with the client and media-assets function.
-- 5 Mbps video + audio/container headroom for the accepted 183-second window.
update storage.buckets
set file_size_limit = 140313800
where id in ('place-media', 'place-media-private');
