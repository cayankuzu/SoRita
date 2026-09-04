# ADR 0001: Private Media Asset Model

Status: accepted for implementation, partially implemented

## Context

Place/list media currently has public URL compatibility requirements. A production-ready model needs private object storage, server-side validation, short-lived delivery URLs, and migration safety for older app versions.

## Decision

Use an asset-first model:

- `media_assets` stores owner, bucket/path, MIME, size, checksum, processing status, visibility, moderation state, timestamps.
- `list_place_media` stores relation, sort order, thumbnail/rendition metadata.
- Upload begins through an Edge Function that creates an asset placeholder and signed upload session.
- Finalize is idempotent and validates actual uploaded object metadata.
- Delivery is resolved through `get_media_delivery_urls(asset_ids[])`, scoped to the viewer.

## Consequences

- Clients stop persisting signed URLs.
- Existing public URLs require a copy/verify/switch migration.
- Old binaries need a compatibility window before public objects are removed.
- Storage cost and egress become observable per asset.

## Current State

The private bucket foundation and stricter limits are in place. The full asset schema, upload session endpoint, delivery resolver, and backfill job remain pending.
