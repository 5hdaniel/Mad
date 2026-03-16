# BACKLOG-944: In-App Support Ticket Creation with Diagnostics

**Priority:** High
**Type:** Feature
**Area:** Electron + Broker Portal
**Status:** Pending
**Created:** 2026-03-13

---

## Summary

Enable users to create support tickets directly from the desktop app (Electron) and broker portal (Next.js) with automatically attached diagnostics. Desktop captures screenshots via `desktopCapturer`, app version, OS, sync status, recent error logs from SQLite, and device info. Broker portal captures browser info, current page state, and allows screenshot paste/upload. Tickets route to the existing support platform (BACKLOG-938 / SPRINT-130).

---

## Context

Support Platform Phase 1 (BACKLOG-938) shipped core ticketing with a web form on the broker portal (`/support/new`) and an admin agent dashboard. However:

1. **Desktop app has no ticket creation UI.** Users must leave the app and navigate to the web form manually. The current `contactSupport` IPC handler just opens a mailto link.
2. **No diagnostics are automatically captured.** When users report issues, agents must manually ask for version, OS, error logs, sync status, etc. -- a slow back-and-forth that delays resolution.
3. **Broker portal ticket form has no diagnostic capture.** Browser info, route context, and screenshots are not attached.

The requirements doc (Section 1) lists "In-app 'Contact support' that routes users to the web form" as a launch channel, and Section 9 specifies auto-acknowledgment on ticket creation. This feature upgrades the in-app redirect to a full in-app experience with diagnostics.

---

## Requirements

### Desktop App (Electron)

1. **Support Ticket Dialog** -- Modal dialog accessible from Settings or Help menu with:
   - Subject, description, priority, category fields (matching broker portal TicketForm)
   - Screenshot capture button (uses Electron `desktopCapturer` API)
   - Screenshot preview with remove option
   - File attachment support (reuse existing FileUpload patterns)

2. **Automatic Diagnostics Collection** -- Collected on dialog open, attached as JSON:
   - App version (`app.getVersion()`)
   - OS platform + version (`process.platform`, `os.release()`)
   - Electron version
   - Database status (initialized, encrypted, size)
   - Sync status (last sync time, sync errors if any)
   - Email connection status (Google/Microsoft connected?)
   - Recent error logs from SQLite `error_logs` table (last 10, sanitized of PII)
   - Device info (from existing `deviceService`)
   - Memory usage (`process.memoryUsage()`)

3. **Submission** -- POST to support ticket creation RPC via Supabase (same as broker portal), with:
   - `source_channel: 'in_app_redirect'` (matches existing schema)
   - Diagnostics attached as a structured JSON attachment
   - Screenshot attached as image file
   - Auto-fill requester name/email from logged-in user

### Broker Portal (Next.js)

4. **Enhanced Ticket Form** -- Extend existing `TicketForm.tsx` to:
   - Auto-capture browser info (userAgent, viewport, current URL)
   - Support screenshot paste from clipboard (Ctrl+V / Cmd+V)
   - Support screenshot drag-and-drop
   - Attach browser diagnostics as structured metadata
   - Show "Diagnostics will be attached" notice to user

---

## Acceptance Criteria

- [ ] Desktop app has a "Contact Support" button (Settings page + Help menu) that opens ticket dialog
- [ ] Desktop dialog captures screenshot via `desktopCapturer` with preview
- [ ] Desktop dialog collects diagnostics automatically on open
- [ ] Desktop ticket submission creates ticket in support system with diagnostics + screenshot attached
- [ ] Desktop dialog auto-fills user name and email
- [ ] Broker portal ticket form supports screenshot paste from clipboard
- [ ] Broker portal ticket form captures and attaches browser diagnostics
- [ ] All diagnostics are PII-safe (no tokens, passwords, full email content)
- [ ] Ticket appears in admin portal agent dashboard with attachments viewable
- [ ] `source_channel` correctly set to `in_app_redirect` for desktop submissions
- [ ] Graceful degradation: if diagnostics collection fails, ticket submission still works
- [ ] Type safety: all new IPC channels typed in preload bridge

---

## Architecture Decisions

### Desktop: Direct Supabase vs. API Route

Desktop app submits tickets directly via Supabase RPC (same as broker portal). This avoids:
- Standing up a new API endpoint
- CORS issues
- Extra network hop

The existing `support_create_ticket` RPC already supports this. Attachments go to Supabase Storage via the existing `support_upload_attachment` pattern.

### Screenshot: desktopCapturer vs. Clipboard

Use `desktopCapturer.getSources()` to capture the current screen, then let the user crop/confirm before attaching. This is more reliable than clipboard because it captures the full app state automatically.

### Diagnostics: Sanitization

All diagnostics pass through a sanitization function that strips:
- Auth tokens and session data
- Full email content (only "connected: yes/no" for email status)
- File paths with user home directory (replace with `~`)
- Any PII from error log messages

---

## Dependencies

- BACKLOG-938 (Support Platform Phase 1) -- must be shipped (it is, v2.9.5)
- BACKLOG-941 (Email Service) -- NOT a dependency; ticket creation works without email
- Support ticket creation RPC must be deployed (it is)
- Supabase Storage bucket for attachments must exist (it does)

## Estimated Effort

~80K tokens total (split across 2 tasks):
- TASK-2180: Desktop in-app ticket dialog + diagnostics (~50K)
- TASK-2181: Broker portal ticket form enhancements (~30K)
