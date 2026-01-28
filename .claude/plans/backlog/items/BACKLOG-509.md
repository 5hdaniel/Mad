# BACKLOG-509: Unify Loading Animations (Starting Magic Audit vs Keychain)

## Type
ui/ux

## Priority
low

## Status
backlog

## Description

The "Starting Magic Audit..." loading animation doesn't match the keychain waiting animation. This creates visual inconsistency in the app's loading states.

### Current State

**Starting Magic Audit animation:**
```html
<div class="text-center">
  <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
    <svg class="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  </div>
  <p class="text-gray-600 text-sm">Starting Magic Audit...</p>
</div>
```

**Keychain waiting animation:** (different style)

### Proposed Solution

1. Create a shared `LoadingSpinner` component with consistent styling
2. Use it in both locations:
   - App startup "Starting Magic Audit..."
   - Keychain access waiting state
   - Any other loading states

### Benefits
- Visual consistency across the app
- Single source of truth for loading UI
- Easier to update/rebrand loading animations

## Acceptance Criteria
- [ ] Identify all loading animation locations in codebase
- [ ] Create shared LoadingSpinner component
- [ ] Update "Starting Magic Audit" to use shared component
- [ ] Update keychain waiting to use shared component
- [ ] Animations are visually identical
- [ ] No functional changes
