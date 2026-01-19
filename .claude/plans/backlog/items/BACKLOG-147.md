# BACKLOG-147: Secure Storage Setup Should Not Show for Returning Users

## Summary

The "Secure Storage Setup" screen currently shows for returning users unless they've checked the "Don't show again" checkbox. This is unnecessary friction - returning users have already set up secure storage.

## Current Behavior

1. Returning user restarts app
2. Sees "Secure Storage Setup - Protect your data with macOS Keychain"
3. Must click through or check "Don't show again"

## Desired Behavior

1. Returning user restarts app
2. If secure storage is already configured → Skip this screen entirely
3. Only show if secure storage genuinely needs setup

## Implementation Notes

- The "Don't show again" checkbox is a workaround for the real issue
- Should check if secure storage is already initialized before showing
- Similar pattern to TASK-955 (skip unnecessary onboarding steps)

## Priority

**Medium** - UX improvement, not blocking

## Related

- TASK-955: Skip Onboarding for Returning Users (addresses the broader issue)
- BACKLOG-144: UI Flicker for Returning Users

## Status

**Open** - May be resolved as part of TASK-955 or require separate work
