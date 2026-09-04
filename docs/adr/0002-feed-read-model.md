# ADR 0002: Viewer-Scoped Feed Read Model

Status: accepted for implementation, partially implemented

## Context

The previous visible-data graph grew with users, social relationships, comments, and media. Production feed loading must be bounded by page size rather than total platform size.

## Decision

Introduce a viewer-scoped keyset feed read model:

- `feed_page(cursor, limit)` derives viewer from `auth.uid()`.
- Cursor is opaque and based on `(published_at, id)`.
- DTO includes only card-critical fields, counts, viewer flags, owner summary, and first media descriptor.
- Comments, likers, and full profiles load through separate paginated endpoints.
- Follow, block, private account, and list visibility filtering happen in the database.

## Consequences

- Feed payloads become predictable and cacheable.
- Offset pagination gaps/duplicates are avoided during live inserts.
- UI can show a "new items" buffer instead of reshuffling existing pages.

## Current State

The initial graph has been reduced and comments are no longer included in default visible-data calls. The final keyset feed RPC/API and integration tests remain pending.
