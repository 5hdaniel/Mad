# BACKLOG-581: Replace googleapis with lighter @googleapis/gmail package

## Summary

The full `googleapis` package (102MB, 1302 files) is bundled in the production build, but only the Gmail API is actually used. Replace with the lighter `@googleapis/gmail` package (~5MB) plus `google-auth-library` (already installed).

## Current State

- `googleapis` package: 102MB, 1302 files in app.asar
- Only used for: `google.gmail`, `google.oauth2`, `google.auth.OAuth2`
- Places API uses direct axios calls (not googleapis)

## Proposed Solution

1. Install `@googleapis/gmail` package
2. Update imports in:
   - `electron/services/gmailFetchService.ts`
   - `electron/services/googleAuthService.ts`
3. Remove `googleapis` from dependencies
4. Verify `google-auth-library` handles OAuth2 (already installed)

## Expected Impact

- Reduce app.asar by ~97MB (404MB → ~307MB)
- Reduce DMG by ~30MB (237MB → ~207MB)
- Faster install/update times

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Replace `googleapis` with `@googleapis/gmail` |
| `electron/services/gmailFetchService.ts` | Update imports |
| `electron/services/googleAuthService.ts` | Update imports |

## Priority

Low - Current 237MB DMG is acceptable. This is a nice-to-have optimization.

## References

- DMG size investigation (2026-02-01)
- Reduced DMG from 2GB to 237MB by removing source files
