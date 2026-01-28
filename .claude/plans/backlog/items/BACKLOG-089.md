# BACKLOG-089: Password Manager Support in Authentication

## Priority: Medium

## Summary

Enable password manager integration (1Password, LastPass, Google Password Manager, etc.) for authentication flows in the Electron app.

## Problem

Currently, OAuth popups open in Electron's BrowserWindow which doesn't support browser extensions. Users who rely on password managers can't autofill their credentials.

## Technical Analysis

### Current State
- OAuth (Google/Microsoft) uses BrowserWindow popups
- Browser extensions (1Password, LastPass) don't work in Electron
- OS-level password managers may partially work but unreliably

### Options

| Option | Pros | Cons |
|--------|------|------|
| **A: Use system browser** | Full password manager support, familiar UX | Requires deep link/localhost callback handling |
| **B: OS-level integration** | Works within app | Platform-specific, limited manager support |
| **C: Manual paste workflow** | Simple to implement | Poor UX |

### Recommended: Option A (System Browser)

Use `shell.openExternal` for OAuth flows:

```typescript
// Instead of BrowserWindow popup
import { shell } from 'electron';

// Open OAuth in system browser
shell.openExternal(authUrl);

// Handle callback via:
// 1. Deep link (magicaudit://oauth/callback)
// 2. Localhost redirect (http://localhost:PORT/callback)
```

**Implementation steps:**
1. Register deep link protocol handler (`magicaudit://`)
2. Or spin up temporary localhost server for callback
3. Update OAuth redirect URIs in Google/Microsoft consoles
4. Parse callback and complete auth flow

### Platform Considerations

| Platform | Deep Link Support | Localhost Redirect |
|----------|-------------------|-------------------|
| Windows | Yes (registry) | Yes |
| macOS | Yes (Info.plist) | Yes |

## Acceptance Criteria

- [ ] OAuth flows open in system default browser
- [ ] Password managers can autofill credentials
- [ ] Callback correctly returns to app and completes auth
- [ ] Works on both Windows and macOS
- [ ] Fallback to BrowserWindow if system browser fails

## Dependencies

- OAuth redirect URI updates in Google Cloud Console
- OAuth redirect URI updates in Microsoft Azure Portal

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Research & prototype | 0.5 sprint |
| Implementation | 1 sprint |
| Testing (both platforms) | 0.5 sprint |
| **Total** | 2 sprints |

## References

- [Electron shell.openExternal](https://www.electronjs.org/docs/latest/api/shell#shellopenexternalurl-options)
- [Electron protocol handler](https://www.electronjs.org/docs/latest/api/app#appsetasdefaultprotocolclientprotocol-path-args)
- [1Password browser integration](https://developer.1password.com/docs/web/)
