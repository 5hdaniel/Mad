# BACKLOG-946: Starred/Favorite Pages in Admin Sidebar

**Type:** Feature
**Area:** Admin Portal
**Priority:** Low
**Status:** Pending

## Description

Allow admin users to star/favorite specific pages for quick access. A "Favorites" section appears at the top of the sidebar showing starred pages.

## Implementation Options

### Option A: localStorage-only (simpler, ~8K tokens)
- Store favorites in `localStorage` per browser
- No backend changes needed
- Device-specific (won't sync across browsers)

### Option B: Supabase-synced (cross-device, ~15K tokens)
- Store in `user_preferences` table or new `admin_user_favorites` table
- Syncs across devices/browsers
- Requires migration + RPC

## UI Design

- Star icon (outline/filled) next to each nav item on hover
- "Favorites" section at top of sidebar nav (above main items)
- Drag-to-reorder within favorites (optional, stretch goal)
- Max ~5 favorites to keep sidebar clean

## Acceptance Criteria

- [ ] Users can star/unstar any sidebar nav page
- [ ] Starred pages appear in a "Favorites" section at top of sidebar
- [ ] Stars persist across page refreshes
- [ ] Works correctly with collapsed sidebar (show star icon only)
