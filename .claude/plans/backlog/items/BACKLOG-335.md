# BACKLOG-335: Enforce Transaction Start Date with Historical Message Filtering

## Summary

Make transaction start date a required/enforced field and use it for historical message filtering. This ensures only relevant communications are included in audits.

## Problem

The start date is critical for:
1. Filtering out messages that predate the transaction
2. Ensuring audit reports only contain relevant communications
3. Compliance and accuracy of transaction records

## Requirements

### 1. Enforce Start Date on Manual Transaction Creation
- Make start date a required field when creating transactions manually
- Cannot save/create transaction without a start date
- Provide date picker with sensible defaults

### 2. AI-Extracted Start Date Verification
- When start date is extracted from emails using AI, flag it for verification
- Show indicator: "Start date extracted from emails - please verify"
- Real estate agent must confirm/adjust the date before it's considered final
- Store verification status (verified/unverified)

### 3. Historical Message Filtering
- Filter out ALL messages with sent_at before the transaction start date
- Apply at:
  - Message linking time (don't link old messages)
  - Export time (double-check filter)
  - UI display (show warning if old messages exist)

### 4. UI Indicators
- Show "Verified" badge if agent confirmed the start date
- Show "Needs Verification" badge if AI-extracted and unconfirmed
- Warn if linked messages exist before start date

## Database Changes

```sql
ALTER TABLE transactions ADD COLUMN start_date_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN start_date_source TEXT; -- 'manual', 'ai_extracted'
```

## Files Likely Affected

- Transaction creation form/modal
- Transaction model/schema
- Message linking service
- Export services (PDF, audit package)
- AI extraction service

## Priority

HIGH - Critical for audit accuracy and compliance

## Created

2026-01-19
