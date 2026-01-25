# BACKLOG-482: Desktop Deep Link Handler

**Category**: infrastructure
**Priority**: P0
**Sprint**: SPRINT-058
**Estimated Tokens**: ~25K
**Status**: Pending

---

## Summary

Implement `magicaudit://` URL scheme handling so the desktop app can receive authentication callbacks from the browser.

## Background

Browser-based auth requires the ability to redirect back to the desktop app via deep links (like Figma, Slack, VS Code).

## Requirements

### macOS Implementation

1. **Register URL Scheme** (electron-builder config):
   ```json
   {
     "protocols": {
       "name": "Magic Audit",
       "schemes": ["magicaudit"]
     }
   }
   ```

2. **Entitlements** (build/entitlements.mac.plist):
   ```xml
   <key>com.apple.developer.associated-domains</key>
   <array>
     <string>applinks:auth.magicaudit.com</string>
   </array>
   ```

3. **Handler** (electron/main.ts):
   ```typescript
   app.on('open-url', (event, url) => {
     event.preventDefault();
     handleAuthCallback(url);
   });
   ```

### Windows Implementation

```typescript
// Windows uses second instance
app.on('second-instance', (event, commandLine) => {
  const url = commandLine.find(arg => arg.startsWith('magicaudit://'));
  if (url) handleAuthCallback(url);
});
```

### Callback Handler

```typescript
function handleAuthCallback(url: string) {
  const parsed = new URL(url);
  // magicaudit://callback?access_token=...&refresh_token=...

  const accessToken = parsed.searchParams.get('access_token');
  const refreshToken = parsed.searchParams.get('refresh_token');

  if (accessToken && refreshToken) {
    mainWindow?.webContents.send('auth:callback', {
      accessToken,
      refreshToken
    });
  }
}
```

## Acceptance Criteria

- [ ] URL scheme registered in electron-builder config
- [ ] macOS `open-url` handler implemented
- [ ] Windows `second-instance` handler implemented
- [ ] Callback sends tokens to renderer
- [ ] App opens when `magicaudit://callback?token=test` is triggered
- [ ] Works when app is already running
- [ ] Works when app is not running (cold start)

## Dependencies

- SPRINT-057 must be complete

## Related Files

- `electron/main.ts`
- `electron-builder.yml` or `package.json`
- `build/entitlements.mac.plist`
- `electron/preload.ts`
