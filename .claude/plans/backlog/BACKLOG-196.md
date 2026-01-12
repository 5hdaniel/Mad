# BACKLOG-196: Implement or Remove Settings.tsx TODOs

## Summary

Address 10 placeholder features with TODO comments in `src/components/Settings.tsx` - either implement them or remove the UI placeholders.

## Problem

The Settings component has multiple placeholder features that:
- Show UI that doesn't work (confusing for users)
- Contain TODO comments indicating incomplete work
- Create false expectations about app capabilities

## Current State

Found 10 TODO/placeholder features in Settings.tsx:

| Feature | Current State | Recommendation |
|---------|--------------|----------------|
| Export format selection | Placeholder | Implement (useful) |
| Theme toggle | Placeholder | Implement or defer |
| Notification settings | Placeholder | Remove (not MVP) |
| Data retention settings | Placeholder | Implement (privacy) |
| Sync frequency | Placeholder | Review necessity |
| Language settings | Placeholder | Remove (English only) |
| Privacy mode | Placeholder | Review necessity |
| Backup schedule | Placeholder | Review necessity |
| Account linking | Placeholder | Review necessity |
| Debug mode toggle | Placeholder | Keep (dev tool) |

## Proposed Solution

### Phase 1: Audit & Categorize
1. Document each placeholder feature
2. Categorize: Implement | Remove | Defer

### Phase 2: Execute Decisions
1. Remove features marked for removal
2. Add "Coming Soon" badge to deferred features
3. Implement quick-win features if time allows

### Example Implementation

```typescript
// BEFORE
<SettingsItem
  title="Export Format"
  description="Choose export format"
  onClick={() => {}} // TODO: implement
/>

// AFTER (if removing)
// Just delete the component

// AFTER (if deferring)
<SettingsItem
  title="Export Format"
  description="Choose export format"
  disabled
  badge="Coming Soon"
/>
```

## Acceptance Criteria

- [ ] All TODO comments in Settings.tsx addressed
- [ ] No non-functional UI elements without "Coming Soon" badge
- [ ] User expectations match actual functionality
- [ ] Settings page is clean and professional

## Priority

**LOW** - User experience clarity, not blocking

## Estimate

~20K tokens

## Category

ui/enhancement

## Impact

- Clearer user expectations
- Professional appearance
- Reduced confusion

## Dependencies

None

## Notes

This is primarily a UX cleanup task. Technical complexity is low, but decisions need to be made about each feature.
