# BACKLOG-300: Display Contact Roles in User-Friendly Format

## Status: Open
## Priority: Low
## Category: UX Polish
## Estimated Tokens: ~5K

---

## Problem Statement

When viewing linked contacts on a transaction, the role pills display raw database values like "seller_agent" instead of user-friendly labels like "Seller Agent". This creates a poor user experience as snake_case values are not human-readable.

## Current Behavior

Role pills display raw database values:
- `seller_agent`
- `buyer_agent`
- `escrow_officer`
- `title_officer`
- `lender`
- etc.

## Expected Behavior

Role pills should display formatted, human-readable labels:
- "seller_agent" -> "Seller Agent"
- "buyer_agent" -> "Buyer Agent"
- "escrow_officer" -> "Escrow Officer"
- "title_officer" -> "Title Officer"
- "lender" -> "Lender"
- etc.

## Proposed Solution

Add a simple formatting function to convert snake_case role values to Title Case display labels. Two approaches:

### Option A: String Manipulation (Generic)
```typescript
const formatRole = (role: string): string =>
  role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
```

### Option B: Lookup Map (Explicit)
```typescript
const ROLE_LABELS: Record<string, string> = {
  seller_agent: 'Seller Agent',
  buyer_agent: 'Buyer Agent',
  escrow_officer: 'Escrow Officer',
  title_officer: 'Title Officer',
  lender: 'Lender',
  // ... other roles
};

const formatRole = (role: string): string => ROLE_LABELS[role] ?? role;
```

Option A is more flexible; Option B gives explicit control over labels.

## Affected Components

- Transaction detail view (linked contacts section)
- Contact role pills/badges

## Acceptance Criteria

- [ ] Role pills display human-readable labels instead of snake_case values
- [ ] All existing roles have proper formatting
- [ ] Unknown roles gracefully fallback to the raw value (not crash)

## Notes

This is a cosmetic/polish fix with minimal risk. Very straightforward string formatting change.
