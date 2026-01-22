# BACKLOG-339: Export Progress Indicator with Time Estimate

## Summary

Add time estimate or detailed progress bar to export process instead of just a spinning loader.

## Problem

Currently the PDF export shows only a spinning loader with no indication of:
- How long the export will take
- What percentage is complete
- What step the export is on

Note: Audit Package export already has a progress bar showing current/total items.

## Desired Behavior

For PDF export:
- Show estimated time remaining (e.g., "~30 seconds remaining")
- Or show a progress bar with percentage
- Or show current step (e.g., "Generating page 3 of 15...")

## Implementation Ideas

1. **Time-based estimate**: Track average export time per message, estimate based on message count
2. **Step-based progress**: Report progress from pdfExportService as it processes each communication
3. **Indeterminate with steps**: Show what's happening ("Loading communications...", "Rendering PDF...", "Saving file...")

## Current Implementation

PDF export in ExportModal.tsx (step 3):
```tsx
{step === 3 && (
  <div className="py-8 text-center">
    <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
    <h4>Exporting...</h4>
    <p>Creating your compliance audit export. This may take a moment.</p>
  </div>
)}
```

Audit Package already has progress:
```tsx
{exportProgress && exportFormat === "folder" && (
  <div className="mt-4 max-w-xs mx-auto">
    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
      <div className="h-full bg-purple-600" style={{ width: `${percent}%` }} />
    </div>
    <p>{exportProgress.current} / {exportProgress.total}</p>
  </div>
)}
```

## Files Likely Affected

- `src/components/ExportModal.tsx` - UI changes
- `electron/services/pdfExportService.ts` - Add progress callback
- `electron/services/enhancedExportService.ts` - Pass progress to PDF service

## Priority

LOW - UX improvement, not blocking functionality

## Category

UI
