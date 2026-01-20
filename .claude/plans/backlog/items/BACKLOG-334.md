# BACKLOG-334: Export Settings - Persist Default Export Options and Format

## Summary

Add settings to configure default export preferences so users don't have to re-select options each time they export.

## Requirements

### Settings to Add

1. **Default Export Options** (what content to include)
   - Emails only
   - Text messages only
   - Both (DEFAULT)

2. **Default Export Format**
   - Full PDF (DEFAULT)
   - Summary PDF
   - Audit Package
   - (Future: CSV, JSON, Excel, TXT+EML)

### Behavior

- Settings should persist across app sessions
- Export dialog should pre-select the user's default preferences
- User can still change options per-export in the dialog
- Software defaults: "Full PDF" format + "Both" content

## UI Location

Settings page → Export section (or new "Export" tab)

```
Export Defaults
─────────────────
Default Content:    [Both ▼]
                    • Emails only
                    • Text messages only  
                    • Both ✓

Default Format:     [Full PDF ▼]
                    • Full PDF ✓
                    • Summary PDF
                    • Audit Package
```

## Files Likely Affected

- Settings page component
- Settings store/state
- Export dialog (read defaults)
- Electron settings persistence

## Priority

Medium - UX improvement for frequent exporters

## Created

2026-01-19
