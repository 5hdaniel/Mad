# BACKLOG-335: Enforce Transaction Start Date (Representation Date)

## Summary

Make transaction start date a required field for manual transactions. This date represents when the agent officially started representing the client and is used for historical message filtering.

## Problem

The start date is critical for:
1. Filtering out messages that predate the transaction
2. Ensuring audit reports only contain relevant communications
3. Compliance and accuracy of transaction records

## Requirements

### 1. Enforce Start Date on Manual Transaction Creation
- Make start date a **required field** when creating transactions manually
- Cannot save/create transaction without a start date
- Label: "Representation Start Date" or "Started Representing Client"
- Tooltip: "The date you officially started representing this client"
- Provide date picker with sensible defaults

### 2. Historical Message Filtering
- Filter out ALL messages with sent_at before the transaction start date
- Apply at:
  - Message linking time (don't link old messages)
  - Export time (double-check filter)
  - UI display (show warning if old messages exist)

### 3. Validation
- Show clear error if user tries to save without start date
- Prevent form submission until date is provided

## Files Likely Affected

- Transaction creation form/modal (AuditTransactionModal.tsx)
- Transaction validation logic
- Message linking service
- Export services (PDF, audit package)

## Priority

HIGH - Critical for audit accuracy and compliance

## Created

2026-01-19

## Notes

AI-extracted date verification moved to separate backlog item (BACKLOG-384).
