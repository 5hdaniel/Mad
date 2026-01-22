# BACKLOG-333: Gray Out Unimplemented Export Options with Coming Soon Label

## Summary

Gray out unimplemented export format options and add a "Coming Soon" label to indicate they are not yet available.

## Options to Gray Out

- CSV
- TXT+EML
- JSON
- Excel

## Requirements

1. Gray out these options in the export format selector
2. Add "Coming Soon" label/badge next to each
3. Make them non-selectable/disabled
4. Keep them visible so users know they're planned

## Design

```
Export Format:
○ PDF                    [Selected]
○ Audit Package
○ CSV          (Coming Soon)
○ TXT+EML      (Coming Soon)
○ JSON         (Coming Soon)
○ Excel        (Coming Soon)
```

## Files Likely Affected

- Export modal/dialog component (needs investigation)

## Priority

Low - UX polish, not blocking functionality

## Created

2026-01-19
