/**
 * macOS Messages Import Module
 * Re-exports the service singleton and types for backward compatibility.
 * Consumers can continue importing from "services/macOSMessagesImportService".
 */

export { default, macOSMessagesImportService } from "./macOSMessagesImportService";
export type {
  MessageImportFilters,
  MacOSImportResult,
  ImportProgressCallback,
  MessageAttachment,
} from "./types";
