# BACKLOG-178: WhatsApp Message Fetching Support

## Summary

Add support for fetching and importing WhatsApp messages into the communications/messages system.

## Priority

Medium

## Category

Feature - Communications

## Description

Currently the app supports:
- macOS Messages (iMessage/SMS)
- Email (Microsoft Graph, Gmail)

WhatsApp is a popular messaging platform used by many real estate professionals. Adding support would expand communication coverage.

## Requirements (High-level)

- Investigate WhatsApp data access options:
  - WhatsApp Business API
  - WhatsApp Web export
  - Local WhatsApp database access (if possible)
- Implement message import service
- Map WhatsApp messages to existing message schema
- Support thread/conversation grouping
- Handle WhatsApp-specific features (media, voice notes, etc.)

## Technical Considerations

- WhatsApp API access may require business account
- End-to-end encryption limits direct data access
- May need to rely on export/backup approach
- Consider privacy and compliance requirements

## Estimated Effort

Large (needs research phase first)

## Dependencies

- Existing messaging infrastructure (SPRINT-025, SPRINT-027)
- Message viewer components

## Acceptance Criteria

- [ ] Research completed on WhatsApp data access options
- [ ] Chosen approach documented
- [ ] WhatsApp messages can be imported
- [ ] Messages display in Transaction Details
- [ ] Contact matching works for WhatsApp contacts

## Created

2026-01-09

## Status

Backlog
