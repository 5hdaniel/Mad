# TASK-1721: RoleAssigner Integration

## Overview
Create RoleAssigner component and integrate the 2-step contact selection flow:
1. First user selects contacts using ContactSelector
2. Then user assigns roles to selected contacts using RoleAssigner

## Context
- TASK-1720 (ContactSelector) completed and merged (PR #667)
- ContactSelector available at `src/components/shared/ContactSelector.tsx`
- Role constants defined in `src/constants/contactRoles.ts`
- Role utilities in `src/utils/transactionRoleUtils.ts`

## Implementation Plan

### Step 1: Create RoleAssigner Component
**File:** `src/components/shared/RoleAssigner.tsx`

**Props:**
```typescript
interface RoleAssignerProps {
  /** Contacts that were selected in step 1 */
  selectedContacts: ExtendedContact[];
  /** Transaction type for role filtering */
  transactionType: 'purchase' | 'sale' | 'other';
  /** Current role assignments */
  assignments: RoleAssignments;
  /** Callback when assignments change */
  onAssignmentsChange: (assignments: RoleAssignments) => void;
  /** Optional className */
  className?: string;
}

interface RoleAssignments {
  [role: string]: string[]; // role -> array of contact IDs
}
```

**Features:**
- Display selected contacts on the left
- Display available roles on the right (grouped by AUDIT_WORKFLOW_STEPS)
- Allow drag-and-drop or click to assign contacts to roles
- Show role requirements (required, multiple)
- Filter roles based on transaction type
- Validation for required roles

### Step 2: Create Tests for RoleAssigner
**File:** `src/components/shared/RoleAssigner.test.tsx`

**Test Coverage:**
- Rendering selected contacts
- Rendering role sections
- Assigning contact to role
- Removing contact from role
- Required role validation
- Transaction type filtering
- Multiple contacts per role

### Step 3: Create ContactRoleFlow Component (optional if needed)
A wrapper component that orchestrates the 2-step flow:
1. ContactSelector step
2. RoleAssigner step
3. Confirm action

## Technical Details

### Role Structure (from contactRoles.ts)
```typescript
AUDIT_WORKFLOW_STEPS = [
  {
    title: "Client & Agents",
    description: "Core parties",
    roles: [CLIENT, BUYER_AGENT, SELLER_AGENT]
  },
  {
    title: "Professional Services",
    description: "Title, escrow, inspection...",
    roles: [TITLE_COMPANY, ESCROW_OFFICER, INSPECTOR, ...]
  }
]
```

### Integration Points
1. Use existing `filterRolesByTransactionType()` from transactionRoleUtils
2. Use `getRoleDisplayName()` for role labels
3. Use `ROLE_DISPLAY_NAMES` for display
4. Match styling with ContactSelector (purple gradients, rounded borders)

## Acceptance Criteria
- [ ] RoleAssigner component created with proper TypeScript types
- [ ] Tests cover main functionality (>80% coverage)
- [ ] Integrates with ContactSelector for 2-step flow
- [ ] Follows existing styling patterns
- [ ] Type-check and lint pass

## Files to Create/Modify
- CREATE: `src/components/shared/RoleAssigner.tsx`
- CREATE: `src/components/shared/RoleAssigner.test.tsx`
- MAYBE: Update export in shared folder

## Estimated Effort
- ~15K tokens
