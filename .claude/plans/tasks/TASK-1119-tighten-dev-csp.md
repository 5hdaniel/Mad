# TASK-1119: Tighten CSP in Development Mode

**Backlog ID:** BACKLOG-249
**Sprint:** SPRINT-043
**Phase:** 2 (Parallel with TASK-1115)
**Branch:** `fix/task-1116-tighten-dev-csp`
**Estimated Turns:** 5-8
**Estimated Tokens:** 15K-25K

---

## Objective

Tighten the Content Security Policy (CSP) in development mode to reduce the attack surface while maintaining Hot Module Replacement (HMR) functionality. The current dev CSP is more permissive than production, creating a gap that could be exploited during development.

---

## Context

### Current State

In `electron/main.ts` (lines 79-93), the development CSP is:
```typescript
const cspDirectives = isDevelopment
  ? [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",       // <-- unsafe-inline for HMR
      "style-src 'self' 'unsafe-inline'",         // <-- unsafe-inline for HMR
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' http://localhost:* ws://localhost:* https:",  // <-- broad localhost
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "worker-src 'self' blob:",
      "upgrade-insecure-requests",
    ]
```

### Production CSP (lines 95-108):
```typescript
  : [
      "default-src 'self'",
      "script-src 'self'",                        // <-- No unsafe-inline
      "style-src 'self' 'unsafe-inline'",         // <-- Still has unsafe-inline (CSS-in-JS)
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",                // <-- HTTPS only
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "worker-src 'self' blob:",
    ];
```

### Issues with Current Dev CSP

1. **`script-src 'unsafe-inline'`**: Allows inline scripts, XSS risk
2. **`connect-src http://localhost:*`**: Very broad localhost access
3. **No nonce/hash alternative explored**: Modern bundlers support CSP-compliant HMR

### Why This Matters

- Development environments can be attacked (supply chain, malicious dependencies)
- Wide gap between dev and prod CSP can hide issues until production
- Defense in depth even in development

---

## Requirements

### Must Do:
1. Investigate if Vite HMR can work without `'unsafe-inline'` in script-src
2. If unsafe-inline is required for HMR, document why and keep minimal
3. Tighten `connect-src` to specific localhost ports used by dev server
4. Verify what ports Vite uses (typically 5173 for dev, specific port for HMR websocket)
5. Add CSP reporting in development to catch violations (console logging)
6. Document the remaining differences between dev and prod CSP

### Must NOT Do:
- Break HMR functionality in development
- Remove 'unsafe-inline' from style-src (CSS-in-JS needs it)
- Make dev experience significantly worse
- Change production CSP
- Add external CDN sources

---

## Acceptance Criteria

- [ ] connect-src limited to specific localhost ports (not wildcard)
- [ ] CSP differences between dev and prod minimized
- [ ] HMR still works with `npm run dev`
- [ ] No CSP violation errors during normal development workflow
- [ ] Documentation comment explaining any remaining unsafe directives
- [ ] All CI tests pass
- [ ] Console logging for CSP violations in dev mode (optional enhancement)

---

## Files to Modify

- `electron/main.ts` - Update setupContentSecurityPolicy function

## Files to Read (for context)

- `vite.config.ts` - Check dev server port configuration
- `package.json` - Check dev script and ports

---

## Testing Expectations

### Unit Tests
- **Required:** No - CSP is runtime configuration
- **New tests to write:** None
- **Existing tests to update:** None

### Integration Tests
- App should start without CSP errors

### Manual Testing Required
1. **Development Startup:**
   - Run `npm run dev`
   - Verify app starts without CSP errors in console
   - Verify no network errors related to blocked resources

2. **HMR Functionality:**
   - Make a change to a React component
   - Verify HMR updates the component without page reload
   - Check console for any CSP-related warnings

3. **Feature Testing:**
   - Navigate through app
   - Load images, fonts
   - Make API calls (if any)
   - Verify no CSP violations

4. **Violation Logging (if implemented):**
   - Intentionally add inline script in dev tools
   - Verify CSP violation is logged

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(security): tighten CSP in development mode`
- **Branch:** `fix/task-1116-tighten-dev-csp`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: Broad dev CSP with localhost:* and unsafe-inline
- **After**: Tighter dev CSP with specific ports and documented exceptions
- **Actual Turns**: X (Est: 5-8)
- **Actual Tokens**: ~XK (Est: 15K-25K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- HMR stops working after CSP changes
- You cannot find a way to tighten CSP without breaking dev workflow
- You discover the app needs external resources not covered by current CSP
- Significant CSP violations appear that require architectural changes
- You encounter blockers not covered in the task file

---

## Technical Notes

### Vite Development Server Ports

Check `vite.config.ts` and `package.json` for port configuration. Typical Vite setup:
- Dev server: port 5173 (default) or custom
- HMR websocket: same port or custom

### Recommended CSP Changes

**connect-src tightening:**
```typescript
// Before (too broad)
"connect-src 'self' http://localhost:* ws://localhost:* https:",

// After (specific ports) - adjust based on actual vite config
"connect-src 'self' http://localhost:5173 ws://localhost:5173 https:",
```

**script-src investigation:**
```typescript
// Current
"script-src 'self' 'unsafe-inline'",

// If Vite supports nonce-based CSP:
"script-src 'self' 'nonce-{generated}'",

// If unsafe-inline is truly required for HMR, document why:
// NOTE: unsafe-inline required for Vite HMR in development
// See: https://vitejs.dev/guide/features.html#content-security-policy
"script-src 'self' 'unsafe-inline'",
```

### CSP Violation Reporting (Optional Enhancement)

Add violation logging in development:
```typescript
if (isDevelopment) {
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      // ... existing CSP logic
    }
  );

  // Add CSP violation logging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (message.includes('Content Security Policy')) {
      console.warn('[CSP Violation]', message);
    }
  });
}
```

### Reference: Electron CSP Best Practices

- https://www.electronjs.org/docs/latest/tutorial/security#7-define-a-content-security-policy
- Electron recommends strict CSP even in development
- Trade-off between security and developer experience

### What To Document

After implementation, the CSP section should have comments like:
```typescript
const cspDirectives = isDevelopment
  ? [
      "default-src 'self'",
      // NOTE: 'unsafe-inline' required for Vite HMR - cannot be removed without
      // breaking hot module replacement. Production does not use this directive.
      "script-src 'self' 'unsafe-inline'",
      // ... etc
    ]
```
