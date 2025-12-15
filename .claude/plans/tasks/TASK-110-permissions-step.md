# Task TASK-110: Extract PermissionsStep (macOS Only)

## Goal

Extract the macOS Full Disk Access permissions screen into the new step architecture. This step is **macOS only** and handles system permission requests.

## Non-Goals

- Do NOT delete PermissionsScreen.tsx (deprecation is TASK-115)
- Do NOT modify AppRouter routing yet (TASK-114)
- Do NOT change permission checking logic

## Deliverables

1. New file: `src/components/onboarding/steps/PermissionsStep.tsx`
2. Update: `src/components/onboarding/steps/index.ts` (register step)

## Acceptance Criteria

- [ ] `meta.id` is `'permissions'`
- [ ] `meta.progressLabel` is `'Permissions'`
- [ ] `meta.platforms` is `['macos']` **ONLY**
- [ ] `meta.navigation.showBack` is `true`
- [ ] `meta.navigation.showNext` is `true`
- [ ] `meta.required` is `true` (needed for app functionality)
- [ ] Content explains Full Disk Access requirement
- [ ] Content shows how to enable in System Settings
- [ ] Content checks permission status
- [ ] Step registered in STEP_REGISTRY

## Implementation Notes

### Platform Restriction

Like SecureStorageStep, this is macOS-only:

```typescript
export const meta: OnboardingStepMeta = {
  id: 'permissions',
  progressLabel: 'Permissions',
  title: 'Grant Permissions',
  platforms: ['macos'],  // NOT Windows
  navigation: {
    showBack: true,
    showNext: true,
    nextLabel: 'Continue',
  },
  skip: false,
  required: true,
  canProceed: (context) => context.hasPermissions,
};
```

### Content from PermissionsScreen.tsx (863 lines)

Key elements:
- Shield icon with lock
- Explanation of Full Disk Access
- System Settings mockup/guide
- "Open System Settings" button
- Permission status indicator
- Instructions for enabling

### Action Types

```typescript
| { type: 'PERMISSION_GRANTED' }
| { type: 'OPEN_SYSTEM_SETTINGS' }
```

### Permission Checking

The content may need to:
1. Check current permission status
2. Poll for changes after user opens System Settings
3. Update context when permission granted

This logic currently exists in PermissionsScreen.tsx and should be preserved.

## Integration Notes

- Uses `window.api` for permission checking
- May need effect to poll permission status
- Opens System Settings via Electron API

## Do / Don't

### Do:
- Restrict to macOS only
- Include System Settings guidance
- Handle permission status checking
- Provide clear instructions

### Don't:
- Add Windows to platforms
- Implement actual permission granting (system handles)
- Skip permission explanation
- Auto-advance without permission confirmed

## When to Stop and Ask

- If permission checking logic is complex
- If unclear how polling should work
- If System Settings guide needs updating

## Testing Expectations

- Unit test: Platform validation throws for Windows
- Unit test: Renders permission explanation
- Unit test: Open System Settings fires action
- Unit test: canProceed returns based on context

## PR Preparation

- Title: `feat(onboarding): extract PermissionsStep (macOS only)`
- Label: `phase-3`, `step-extraction`, `macos`
- Depends on: Phase 2 complete

## Implementation Summary (Engineer-Owned)

*To be completed by implementing engineer after task completion.*

```
Files created:
- [ ] src/components/onboarding/steps/PermissionsStep.tsx

Platform restriction verified:
- [ ] platforms: ['macos'] only

Features implemented:
- [ ] Permission explanation UI
- [ ] System Settings guide
- [ ] Open Settings action
- [ ] Permission status indicator
- [ ] canProceed validation

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
```
