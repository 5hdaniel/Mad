# TASK-2017: Encrypt session tokens with safeStorage

**Backlog ID:** BACKLOG-722
**Sprint:** SPRINT-088
**Phase:** Phase 2 (Sequential - after Phase 1, higher risk)
**Branch:** `feature/task-2017-encrypt-session-tokens`
**Estimated Tokens:** ~15K

---

## Objective

Encrypt the Supabase `access_token` and `refresh_token` stored in `session.json` using Electron's `safeStorage` API. Currently these tokens are stored in plaintext in the user data directory, relying only on OS file permissions for protection. This is a security hardening feature.

---

## Context

### Investigation Findings

- **File:** `electron/services/sessionService.ts`
- **Session file path (line 41):** `path.join(app.getPath("userData"), "session.json")`
- **Current behavior:** Reads/writes `session.json` as plaintext JSON containing Supabase auth tokens (access_token, refresh_token, user object)
- **safeStorage API:** Electron provides `safeStorage.encryptString()` and `safeStorage.decryptString()` for OS-level encryption (Keychain on macOS, DPAPI on Windows, libsecret on Linux)
- **Availability:** `safeStorage.isEncryptionAvailable()` is true after `app.ready` event (independent of the keychainGate used for DB encryption)

### IMPORTANT: Keychain Conflict Warning (from MEMORY.md)

Switching between packaged (DMG) and dev mode can break `safeStorage`:
- Keychain entries are tied to code-signing identity
- Symptom: "Encryption not available" on startup
- **This is why graceful fallback is critical** -- if decrypt fails, delete `session.json` and force re-login

### Related Files

- `electron/services/resetService.ts` -- references `session.json` (cleanup on reset)
- `electron/services/__tests__/sessionService.initialization.test.ts` -- session service tests
- `electron/services/__tests__/sessionService.test.ts` -- more session service tests

---

## Requirements

### Must Do

1. **Encrypt on write:** When saving session data, use `safeStorage.encryptString(JSON.stringify(sessionData))` and write the encrypted buffer to `session.json`
2. **Decrypt on read:** When loading session data, read the file as a buffer, use `safeStorage.decryptString(buffer)` to get the JSON string, then parse
3. **Graceful fallback on decrypt failure:**
   - If `safeStorage.decryptString()` throws (e.g., keychain conflict from DMG/dev switch), delete `session.json` and return null (force re-login)
   - Log a warning via logService explaining the decrypt failure
4. **Handle unencrypted -> encrypted migration:**
   - On first read after this change, the file will be plaintext JSON
   - Detect this (try JSON.parse first; if it succeeds, it was plaintext)
   - Re-encrypt and overwrite the file
   - This handles the upgrade path without forcing all users to re-login
5. **Check `safeStorage.isEncryptionAvailable()`** before encrypting. If not available (very rare edge case), fall back to plaintext with a warning log
6. **Update `resetService.ts`** if it reads session.json (ensure it can handle encrypted format, or just deletes the file)

### Must NOT Do

- Do NOT encrypt the entire file with a custom key -- use safeStorage exclusively
- Do NOT change the session file path or name
- Do NOT modify the auth flow or token refresh logic
- Do NOT store the encryption key anywhere (safeStorage handles this internally)

### Testing Considerations

- Tests mock Electron APIs (`safeStorage`, `app`). Ensure mocks are updated.
- Test: encrypt -> decrypt round-trip
- Test: plaintext migration (read plaintext, auto-encrypt)
- Test: decrypt failure -> returns null (force re-login)
- Test: encryption unavailable -> falls back to plaintext

### Acceptance Criteria

- [ ] Session tokens are encrypted at rest in `session.json`
- [ ] Existing plaintext sessions are auto-migrated on first read
- [ ] Decrypt failure (keychain conflict) gracefully forces re-login
- [ ] Missing safeStorage falls back to plaintext with warning
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] Manual test: login, quit app, relaunch -- session persists
- [ ] Manual test: delete session.json -- app prompts re-login

---

## Files to Modify

| File | Change |
|------|--------|
| `electron/services/sessionService.ts` | Add encrypt/decrypt logic around session.json read/write |
| `electron/services/resetService.ts` | Verify it handles encrypted session.json (or just deletes) |
| `electron/services/__tests__/sessionService.test.ts` | Add/update tests for encryption |
| `electron/services/__tests__/sessionService.initialization.test.ts` | Update if initialization behavior changes |

---

## Implementation Summary

Implemented safeStorage encryption for session tokens in `sessionService.ts`. Session data is now encrypted at rest using Electron's safeStorage API (OS Keychain on macOS, DPAPI on Windows, libsecret on Linux). The implementation includes: (1) encrypted wrapper format `{"encrypted":"<base64>"}` to distinguish encrypted from plaintext files, (2) seamless migration of pre-existing plaintext sessions on first read, (3) graceful fallback to plaintext when safeStorage is unavailable, (4) decrypt failure handling that deletes the corrupt session file and forces re-login instead of crashing. All 66 existing + new tests pass.

| Field | Value |
|-------|-------|
| Agent ID | TBD (auto-captured) |
| Branch | feature/TASK-2017-encrypt-session-tokens |
| PR | TBD |
| Files Changed | 5 (1 modified service, 3 updated test files, 1 new test file) |
| Tests Added/Modified | 4 test files updated, 1 new (sessionService.encryption.test.ts with 10 tests) |
| Actual Tokens | TBD (auto-captured) |

### Engineer Checklist
- [x] Session tokens encrypted at rest in session.json
- [x] Existing plaintext sessions auto-migrated on first read
- [x] Decrypt failure (keychain conflict) gracefully forces re-login
- [x] Missing safeStorage falls back to plaintext with warning
- [x] npm test passes (66/66 tests)
- [x] npm run type-check passes
- [x] resetService.ts verified -- no changes needed (uses clearSession which deletes file)
- [x] No deviations from task requirements
