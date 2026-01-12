# BACKLOG-179: Show Contact Names Instead of Phone Numbers in Messages

## Summary

Display contact names instead of raw phone numbers throughout the messaging UI when a matching contact exists in the database.

## Priority

High

## Category

UI/UX - Messages

## Problem

Currently, message threads and the "Also Include" section show phone numbers (e.g., "+15551234567") instead of resolved contact names. This makes it harder for users to identify who they're communicating with at a glance.

## Affected Areas

1. **MessageThreadCard header** - Shows phone number as fallback, should look up contact name
2. **AttachMessagesModal contact list** - May show numbers instead of names
3. **Thread grouping display** - Group chats should show participant names

## Requirements

- [ ] Look up contact names by phone number when displaying threads
- [ ] Use contact name as primary display, phone as subtitle
- [ ] Handle cases where contact doesn't exist (show phone number)
- [ ] Cache contact lookups to avoid repeated queries

## Technical Approach

1. Add a `getContactByPhone(phone: string)` lookup method
2. In `TransactionMessagesTab`, resolve contact names for each thread
3. Pass resolved names to `MessageThreadCard`
4. Handle multiple contacts for group chats

## Acceptance Criteria

- [ ] Thread headers show contact names when available
- [ ] Phone numbers show as subtitle under contact name
- [ ] Unknown contacts still show phone number
- [ ] No performance regression from lookups

## Created

2026-01-09

## Status

Backlog
