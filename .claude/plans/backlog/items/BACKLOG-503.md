# BACKLOG-503: Add "Include Message Contacts" Filter to Contacts Screen

## Priority: Low
## Category: Enhancement
## Estimate: ~10K tokens

## Problem

The main Contacts screen (accessed via Dashboard) does not have an "Include message contacts" toggle filter. This filter exists in ContactSelectModal but not on the main Contacts page.

## Current State
- ContactSelectModal (line 329) has the toggle
- Main Contacts.tsx only has search, no contact source filter

## Solution

Add a toggle to the Contacts screen header that filters between:
- Imported contacts only (current default)
- Include message-derived contacts

## Files to Modify
- `src/components/Contacts.tsx` - Add toggle filter

## Acceptance Criteria
- [ ] Toggle appears on Contacts screen
- [ ] Toggling shows/hides message-derived contacts
- [ ] State persists during session

## Created
2026-01-26
