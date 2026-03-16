# Task TASK-2181: Broker Portal Ticket Form Enhancements (Diagnostics + Screenshot Paste)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Enhance the existing broker portal support ticket form (`TicketForm.tsx`) to automatically capture browser diagnostics (user agent, viewport, current URL) and support screenshot paste from clipboard (Ctrl+V / Cmd+V) and drag-and-drop. Diagnostics are attached as metadata to the ticket submission. This gives support agents better context without requiring manual information gathering.

## Non-Goals

- Do NOT redesign the ticket form layout or add new required fields
- Do NOT add a screenshot capture tool (browser screen capture API) -- just paste/upload support
- Do NOT modify the support RPCs or database schema
- Do NOT add email notifications -- that is TASK-2179
- Do NOT add ticket history/management features to the broker portal
- Do NOT add diagnostics to the admin portal's `CreateTicketDialog` (admin-created tickets don't need client diagnostics)

## Deliverables

1. New file: `broker-portal/app/support/components/BrowserDiagnostics.tsx` -- collects and displays browser diagnostics
2. New file: `broker-portal/app/support/components/ScreenshotPaste.tsx` -- clipboard paste + drag-and-drop for screenshots
3. Update: `broker-portal/app/support/components/TicketForm.tsx` -- integrate diagnostics and screenshot paste
4. Update: `broker-portal/lib/support-queries.ts` -- add diagnostics metadata to ticket creation if needed
5. New file: `broker-portal/app/support/__tests__/BrowserDiagnostics.test.tsx` -- unit tests

## File Boundaries

N/A -- sequential execution.

## Acceptance Criteria

- [ ] Ticket form shows a collapsible "Diagnostics (attached automatically)" section
- [ ] Browser diagnostics collected on form mount: user agent, viewport size, current URL, timezone, language
- [ ] User can paste a screenshot from clipboard (Ctrl+V / Cmd+V) into the form
- [ ] Pasted screenshot shows as preview with remove option
- [ ] User can drag-and-drop an image file onto the form
- [ ] Diagnostics are submitted as a structured JSON attachment alongside the ticket
- [ ] Diagnostics collection failure does NOT prevent ticket submission
- [ ] Screenshot paste works in Chrome, Firefox, Safari, Edge
- [ ] Existing file upload (`FileUpload.tsx`) still works alongside screenshot paste
- [ ] Form still works for unauthenticated users (diagnostics are best-effort)
- [ ] `npx tsc --noEmit` passes in broker-portal
- [ ] All CI checks pass

### Browser Diagnostics to Collect

| Field | Source | Notes |
|-------|--------|-------|
| `user_agent` | `navigator.userAgent` | Full UA string |
| `viewport_width` | `window.innerWidth` | pixels |
| `viewport_height` | `window.innerHeight` | pixels |
| `screen_width` | `screen.width` | pixels |
| `screen_height` | `screen.height` | pixels |
| `device_pixel_ratio` | `window.devicePixelRatio` | e.g., 2 for Retina |
| `current_url` | `window.location.href` | Current page URL |
| `referrer` | `document.referrer` | Where user came from |
| `timezone` | `Intl.DateTimeFormat().resolvedOptions().timeZone` | e.g., "America/Los_Angeles" |
| `language` | `navigator.language` | e.g., "en-US" |
| `online` | `navigator.onLine` | boolean |
| `cookies_enabled` | `navigator.cookieEnabled` | boolean |
| `collected_at` | `new Date().toISOString()` | ISO timestamp |

## Implementation Notes

### BrowserDiagnostics Component

```typescript
'use client';

import { useEffect, useState } from 'react';

export interface BrowserDiagnosticsData {
  user_agent: string;
  viewport_width: number;
  viewport_height: number;
  screen_width: number;
  screen_height: number;
  device_pixel_ratio: number;
  current_url: string;
  referrer: string;
  timezone: string;
  language: string;
  online: boolean;
  cookies_enabled: boolean;
  collected_at: string;
}

export function useBrowserDiagnostics(): BrowserDiagnosticsData | null {
  const [diagnostics, setDiagnostics] = useState<BrowserDiagnosticsData | null>(null);

  useEffect(() => {
    try {
      setDiagnostics({
        user_agent: navigator.userAgent,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
        screen_width: screen.width,
        screen_height: screen.height,
        device_pixel_ratio: window.devicePixelRatio,
        current_url: window.location.href,
        referrer: document.referrer,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        online: navigator.onLine,
        cookies_enabled: navigator.cookieEnabled,
        collected_at: new Date().toISOString(),
      });
    } catch {
      // Diagnostics collection is best-effort
      console.warn('[Support] Browser diagnostics collection failed');
    }
  }, []);

  return diagnostics;
}

export function BrowserDiagnostics({ diagnostics }: { diagnostics: BrowserDiagnosticsData | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!diagnostics) return null;

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-gray-600 w-full text-left"
      >
        <span>{expanded ? '...' : '...'}</span>
        Diagnostics (attached automatically)
      </button>
      {expanded && (
        <pre className="mt-2 text-xs text-gray-500 overflow-auto max-h-40">
          {JSON.stringify(diagnostics, null, 2)}
        </pre>
      )}
    </div>
  );
}
```

### ScreenshotPaste Component

```typescript
'use client';

import { useEffect, useCallback, useState } from 'react';

interface ScreenshotPasteProps {
  onScreenshot: (file: File) => void;
  screenshot: File | null;
  onRemove: () => void;
}

export function ScreenshotPaste({ onScreenshot, screenshot, onRemove }: ScreenshotPasteProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Handle clipboard paste
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          onScreenshot(new File([file], `screenshot-${Date.now()}.png`, { type: file.type }));
          break;
        }
      }
    }
  }, [onScreenshot]);

  // Handle drag-and-drop
  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        onScreenshot(file);
        break;
      }
    }
  }, [onScreenshot]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // Preview URL management
  useEffect(() => {
    if (screenshot) {
      const url = URL.createObjectURL(screenshot);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [screenshot]);

  // Render: paste hint area + preview if screenshot exists
  // ...
}
```

### Integration with TicketForm

In `TicketForm.tsx`, add:

1. Import and call `useBrowserDiagnostics()` hook
2. Add `<BrowserDiagnostics diagnostics={diagnostics} />` component in form
3. Add `<ScreenshotPaste />` component
4. On form submit: upload diagnostics as JSON attachment, upload screenshot as image attachment

```typescript
// In TicketForm handleSubmit, after creating ticket:
if (diagnostics) {
  const diagnosticsBlob = new Blob([JSON.stringify(diagnostics, null, 2)], { type: 'application/json' });
  const diagnosticsFile = new File([diagnosticsBlob], 'browser-diagnostics.json', { type: 'application/json' });
  await uploadAttachment(ticketId, diagnosticsFile);
}

if (screenshot) {
  await uploadAttachment(ticketId, screenshot);
}
```

### Existing TicketForm Structure

The existing `TicketForm.tsx` at `broker-portal/app/support/components/TicketForm.tsx`:
- Already has file upload via `FileUpload` component (`PendingFile` type)
- Already calls `createTicket()` from `support-queries.ts`
- Already calls `uploadAttachment()` for file uploads
- Auto-fills user info if authenticated

You are EXTENDING this form, not replacing it. Add the diagnostics and screenshot paste alongside existing functionality.

## Integration Notes

- Imports from: existing `broker-portal/lib/support-queries.ts` (`createTicket`, `uploadAttachment`)
- Imports from: existing `broker-portal/app/support/components/FileUpload.tsx`
- Does NOT depend on: TASK-2177/2178/2179 (email tasks)
- Depends on: BACKLOG-938 (Support Platform Phase 1 -- already shipped)

## Do / Don't

### Do:

- Keep diagnostics collection in a `useEffect` with try-catch (best-effort)
- Show diagnostics in a collapsible section so users can see what's being shared
- Handle clipboard paste at the document level (not just on a specific element)
- Clean up `URL.createObjectURL` in useEffect cleanup
- Support both image paste and image drag-and-drop
- Keep the existing file upload mechanism working alongside screenshot paste

### Don't:

- Do NOT use `navigator.mediaDevices.getDisplayMedia()` -- that prompts for screen sharing permission
- Do NOT collect sensitive data (localStorage contents, cookies values, etc.)
- Do NOT make diagnostics a required field
- Do NOT remove or break existing `FileUpload` functionality
- Do NOT modify `support-types.ts` or any Supabase RPCs
- Do NOT add diagnostics to admin-portal `CreateTicketDialog`

## When to Stop and Ask

- If the existing `TicketForm.tsx` has been significantly restructured since the code was reviewed
- If `uploadAttachment` doesn't support JSON file uploads
- If the clipboard paste API (`ClipboardEvent.clipboardData`) is restricted in the deployment environment
- If you need to modify more than 3 existing files

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `BrowserDiagnostics.test.tsx`: Test that `useBrowserDiagnostics` hook returns all expected fields. Test that component renders in collapsed/expanded state.
  - Test that diagnostics collection failure doesn't throw (graceful degradation)
- Existing tests to update: None expected

### Coverage

- Coverage impact: New files, target >70%

### Integration / Feature Tests

- Required scenarios:
  - Manual: Open ticket form -> verify diagnostics section appears
  - Manual: Copy screenshot to clipboard -> Ctrl+V in form -> verify preview
  - Manual: Drag image file onto form -> verify it appears as screenshot
  - Manual: Submit ticket with diagnostics -> verify `browser-diagnostics.json` attachment in admin portal
  - Manual: Submit ticket with pasted screenshot -> verify image attachment in admin portal

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking (`npx tsc --noEmit`)
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(support): add browser diagnostics and screenshot paste to ticket form`
- **Labels**: `feature`, `broker-portal`, `support`, `SPRINT-131`
- **Depends on**: None (uses existing support platform)

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~20K-30K

**Token Cap:** 120K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 3 new files (2 components, 1 test) | +10K |
| Files to modify | 2 files (TicketForm.tsx, support-queries.ts) | +10K |
| Code volume | ~300 lines | +5K |
| Test complexity | Low (DOM events, hook output) | +5K |

**Confidence:** High

**Risk factors:**
- Clipboard paste API differences across browsers
- Existing TicketForm complexity may make extension tricky

**Similar past tasks:** UI tasks use 1.0x multiplier (no adjustment)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] broker-portal/app/support/components/BrowserDiagnostics.tsx
- [ ] broker-portal/app/support/components/ScreenshotPaste.tsx
- [ ] broker-portal/app/support/__tests__/BrowserDiagnostics.test.tsx

Features implemented:
- [ ] Browser diagnostics collection
- [ ] Collapsible diagnostics preview
- [ ] Screenshot paste from clipboard
- [ ] Screenshot drag-and-drop
- [ ] Diagnostics JSON attachment on submit
- [ ] Screenshot attachment on submit

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~30K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~30K | ~XK | +/-X% |
| Duration | - | X sec | - |

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
