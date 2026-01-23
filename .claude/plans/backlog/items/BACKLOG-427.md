# BACKLOG-427: License-Aware UI Components

## Summary

Implement UI component wrappers and conditional rendering based on:
1. **Base license type** (Individual vs Team) - determines Export vs Submit buttons
2. **AI Detection add-on** (separate flag, can be added to ANY base license) - determines AI features

**Important:** AI add-on is NOT a license type. It's an add-on feature that can be enabled for both Individual and Team licenses.

## Category

UI / Feature Gating

## Priority

P0 - Critical (Core license functionality)

## Description

### Problem

Currently all UI features are visible to all users regardless of license type. Need to:
- Show/hide Export button based on license
- Show/hide Submit button based on license
- Show/hide AI Detection features based on add-on status

### Solution

Create a license-aware UI system:

1. **LicenseGate Component**:
```tsx
// Generic wrapper for license-gated features
<LicenseGate requires="individual" fallback={null}>
  <ExportButton />
</LicenseGate>

<LicenseGate requires="team" fallback={null}>
  <SubmitForReviewButton />
</LicenseGate>

<LicenseGate requires="ai_addon" fallback={null}>
  <AutoDetectionButton />
</LicenseGate>
```

2. **Feature-Specific Gates**:

| Feature | Component | Show When |
|---------|-----------|-----------|
| Export button | Transaction Details | `license_type === 'individual'` |
| Submit button | Transaction Details | `license_type === 'team' && hasOrg` |
| Auto-detection button | Dashboard | `ai_detection_enabled === true` |
| AI transaction filters | Transaction List | `ai_detection_enabled === true` |
| AI section in New Audit | AuditTransactionModal | `ai_detection_enabled === true` |
| Manual transaction | All screens | Always visible |

3. **useLicense Hook**:
```tsx
const {
  licenseType,      // 'individual' | 'team' | 'enterprise'
  hasAIAddon,       // boolean
  canExport,        // computed: licenseType === 'individual'
  canSubmit,        // computed: licenseType === 'team'
  canAutoDetect,    // computed: hasAIAddon
  organization      // org details if team member
} = useLicense();
```

### Files to Modify

1. **New Files**:
   - `src/contexts/LicenseContext.tsx` - License state management
   - `src/components/common/LicenseGate.tsx` - Conditional rendering wrapper
   - `src/hooks/useLicense.ts` - License access hook

2. **Modified Files**:
   - `src/components/TransactionDetails/TransactionDetailsHeader.tsx` - Export/Submit buttons
   - `src/components/Dashboard/Dashboard.tsx` - Auto-detection button
   - `src/components/Transactions/TransactionFilters.tsx` - AI filters
   - `src/components/AuditTransactionModal/AuditTransactionModal.tsx` - AI section

## Acceptance Criteria

- [ ] LicenseGate component renders children only when license matches
- [ ] useLicense hook provides all license state and computed flags
- [ ] Export button visible only for Individual license
- [ ] Submit button visible only for Team license
- [ ] Auto-detection button visible only with AI add-on
- [ ] AI transaction filters hidden without AI add-on
- [ ] AI section in New Audit hidden without AI add-on
- [ ] Manual transaction screen always visible

## Estimated Effort

~35K tokens

## Dependencies

- BACKLOG-426: License Type Database Schema Support

## Related Items

- BACKLOG-428: License Context Provider
- BACKLOG-429: License Upgrade Flow UI
