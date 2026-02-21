/**
 * Folder Export Module
 * Re-exports the FolderExportService singleton and types for backward compatibility.
 * Consumers can continue importing from "services/folderExportService".
 */

export { default } from "./folderExportService";
export type { FolderExportOptions, FolderExportProgress } from "./folderExportService";
