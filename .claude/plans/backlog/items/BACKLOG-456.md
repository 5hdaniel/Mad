# BACKLOG-456: Unify Loading Animation UI

## Summary

The "Waiting for keychain" and "Starting Magic Audit..." loading screens use different UI styles. They should be consistent.

## Category

UI / Polish

## Priority

P3 - Low (Visual consistency, not functional)

## Description

### Problem

During app startup, users see two different loading states:
1. "Waiting for keychain..." - one style
2. "Starting Magic Audit..." - different style

This creates a jarring visual experience during the loading sequence.

### Solution

Unify both loading states to use the same UI component:
- Same animation style
- Same typography
- Same layout/positioning
- Consistent branding

### Affected Screens

- Keychain unlock waiting screen
- App initialization loading screen

## Acceptance Criteria

- [ ] Both loading states use identical UI component
- [ ] Animation is smooth and consistent
- [ ] Typography matches app design system
- [ ] Loading messages are clear and informative

## Estimated Effort

~10K tokens

## Dependencies

None

## Related Items

- Onboarding flow polish
