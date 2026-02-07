# BACKLOG-633: Download Page with OS Auto-Detection

**Status:** Pending
**Priority:** Medium
**Category:** feature
**Effort:** ~15K tokens
**Created:** 2026-02-06

## Overview

Full-featured download page at `/download` that auto-detects the user's OS and presents the appropriate download button. Includes a secondary dropdown for other OS options. Auto-starts the download when possible.

## Requirements

1. Auto-detect OS (macOS, Windows) via `navigator.userAgent` or `navigator.userAgentData`
2. Large primary download button for detected OS (e.g., "Download for macOS")
3. Small dropdown/split button beside it for other OS options
4. Auto-start download on page load (with a "download didn't start?" fallback link)
5. Show app version number
6. System requirements section (macOS 12+, Windows 10+, etc.)
7. Links to release notes

## Acceptance Criteria

- [ ] OS auto-detected correctly for macOS and Windows
- [ ] Primary button shows correct OS download
- [ ] Dropdown shows alternative OS options
- [ ] Download auto-starts on page load
- [ ] Fallback link if auto-start blocked
- [ ] Works for both agent invite redirect and direct navigation

## Technical Considerations

- Download URLs will point to GitHub Releases or S3 bucket (TBD)
- Page should work without authentication (public page)
- Currently `/download` exists as a simple placeholder — enhance it

## References

- Current simple `/download` page (placeholder)
- Electron build artifacts from CI
