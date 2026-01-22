# BACKLOG-384: AI-Extracted Date Verification Badges

**Created**: 2026-01-22
**Priority**: Low
**Category**: Feature
**Status**: Pending

---

## Description

When the AI extracts transaction dates from emails, add verification UI to help agents confirm or adjust the dates.

## Requirements

### 1. AI-Extracted Start Date Verification
- When start date is extracted from emails using AI, flag it for verification
- Show indicator: "Start date extracted from emails - please verify"
- Real estate agent must confirm/adjust the date before it's considered final
- Store verification status (verified/unverified)

### 2. UI Indicators
- Show "Verified" badge if agent confirmed the start date
- Show "Needs Verification" badge if AI-extracted and unconfirmed
- Warn if linked messages exist before start date

### 3. Database Changes

```sql
ALTER TABLE transactions ADD COLUMN start_date_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN start_date_source TEXT; -- 'manual', 'ai_extracted'
```

## Acceptance Criteria

- [ ] AI-extracted dates show "Needs Verification" badge
- [ ] User can click to verify/confirm the date
- [ ] Verified dates show "Verified" badge
- [ ] Verification status stored in database
- [ ] Manual transactions auto-verified

## Related

- BACKLOG-335 (Enforce Transaction Start Date)
- AI extraction service

## Notes

Split from BACKLOG-335 to focus on manual transaction flow first.
