# BACKLOG-180: Show Sender Name on Each Message in Group Chats

## Summary

Display the sender's name (or phone number) on each message bubble in group chats so users can see who sent which message.

## Priority

High

## Category

UI/UX - Messages

## Problem

In group chats with multiple participants, all incoming messages appear the same - gray bubbles on the left with no indication of who sent each message. Users cannot tell which participant sent which text.

## Current Behavior

```
[Gray bubble] Hey, are we meeting tomorrow?     <- Who sent this?
[Gray bubble] Yes, 2pm works for me             <- Who sent this?
[Blue bubble] Great, see you then               <- User's message
```

## Desired Behavior

```
John Smith
[Gray bubble] Hey, are we meeting tomorrow?

Jane Doe
[Gray bubble] Yes, 2pm works for me

[Blue bubble] Great, see you then               <- User's message (no name needed)
```

## Requirements

- [ ] Show sender name above each inbound message bubble
- [ ] Don't show name for consecutive messages from same sender
- [ ] Use contact name if available, fall back to phone number
- [ ] Outbound messages (from user) don't need sender label
- [ ] Different colors/avatars for different senders (nice to have)

## Technical Approach

1. Parse `participants.from` field from message data
2. Look up contact name by phone/email
3. Update `MessageBubble` component to accept and display sender
4. Group consecutive messages from same sender to reduce visual clutter

## Data Available

Messages have a `participants` JSON field:
```json
{
  "from": "+15551234567",
  "to": ["+15559876543", "+15551111111"]
}
```

## Acceptance Criteria

- [ ] Inbound messages show sender name/number above bubble
- [ ] Consecutive messages from same sender don't repeat name
- [ ] Contact names used when available
- [ ] Phone numbers shown when contact not found
- [ ] Works for both 1:1 and group threads

## Created

2026-01-09

## Status

Backlog
