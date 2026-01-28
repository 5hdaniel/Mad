# BACKLOG-337: Show Agent Name Instead of "You" in PDF Exports

## Summary

In exported PDFs (both text thread PDFs and the main PDF export), outbound messages currently show "You" as the sender. Instead, show the actual real estate agent's name for a more professional audit document.

## Problem

When exporting transaction communications for compliance/audit purposes, the PDFs show:
- "You" for outbound messages
- Contact name for inbound messages

This is informal and doesn't clearly identify who sent the message in an audit context. The agent's name should be displayed for professional documentation.

## Requirements

### 1. Use Agent Name for Outbound Messages
- Get the agent's display name from user profile/settings
- Replace "You" with the agent's actual name in:
  - Text thread PDFs (folderExportService.ts)
  - Main PDF export conversation view (pdfExportService.ts)

### 2. Fallback Behavior
- If agent name is not set, fall back to email address
- If neither available, use "Agent" instead of "You"

## Current Code

**folderExportService.ts** (text thread PDFs):
```typescript
// Line ~858 in generateTextMessageHTML
const isOutbound = msg.direction === 'outbound';
let senderName = 'You';  // <- Should be agent name
```

**pdfExportService.ts** (main PDF export):
```typescript
// Similar pattern - uses "You" for outbound
```

## Implementation Notes

- Need to pass user/agent info to export services
- Get agent name from: `user.display_name` or `user.email`
- May need to update service method signatures

## Files Likely Affected

- `electron/services/folderExportService.ts`
- `electron/services/pdfExportService.ts`
- `electron/transaction-handlers.ts` (to pass user info)

## Priority

LOW - Cosmetic improvement for professionalism

## Created

2026-01-20
