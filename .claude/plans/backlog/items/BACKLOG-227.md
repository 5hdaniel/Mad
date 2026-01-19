# BACKLOG-227: Show iMessage Attachments in Attachments Tab

## Problem Statement

The Attachments tab in transaction details only shows email attachments. iMessage attachments (photos, GIFs, files) are only visible inline when viewing individual conversations. Users want a centralized view of all media.

## Current Behavior

- Attachments tab shows only email attachments
- iMessage attachments only visible in conversation view modal
- No way to see all text message media at a glance

## Expected Behavior

Separate tabs or sections for:
1. **Email Attachments** - Current functionality (from emails)
2. **Text Attachments** - New (from iMessages/SMS)

Each should be in its own tab, NOT combined.

## Implementation Options

### Option A: Sub-tabs within Attachments
```
Attachments Tab
├── Email (current)
└── Text Messages (new)
```

### Option B: Separate Top-level Tabs
```
Transaction Details
├── Overview
├── Messages
├── Email Attachments
├── Text Attachments  (new)
└── Contacts
```

### Option C: Filter Toggle
```
Attachments Tab
[Email] [Text] [All]  <- toggle buttons
```

## Technical Details

- iMessage attachments stored in `attachments` table with `message_id` FK
- Need to query attachments for messages linked to transaction
- Display should include: thumbnail, filename, date, sender

## Priority

Medium - Enhancement

## Acceptance Criteria

- [ ] iMessage attachments visible in dedicated section/tab
- [ ] Separated from email attachments (not combined)
- [ ] Shows thumbnail preview for images
- [ ] Shows sender/date context
- [ ] Can click to view full size

## Related

- BACKLOG-225: Video attachment support (would also appear here)
- BACKLOG-226: URL preview formatting

## Created

2025-01-13
