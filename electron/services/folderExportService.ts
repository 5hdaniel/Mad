/**
 * Folder Export Service - Backward Compatibility Re-export
 *
 * This file preserves the original import path. The implementation has been
 * split into focused sub-modules under ./folderExport/ for maintainability.
 *
 * Sub-modules:
 * - folderExportService.ts: Main orchestrator class
 * - emailExportHelpers.ts: Email HTML generation and quoted content stripping
 * - textExportHelpers.ts: Text/SMS thread HTML generation
 * - summaryHelpers.ts: Summary report HTML generation
 * - attachmentHelpers.ts: Attachment querying and file management
 */

export { default } from "./folderExport";
export type { FolderExportOptions, FolderExportProgress } from "./folderExport";
