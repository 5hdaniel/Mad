/**
 * Diagnostics barrel export (TASK-2270)
 */
export {
  checkDiskSpaceForOperation,
  DISK_SPACE_THRESHOLDS,
} from "./diskSpaceDiagnostics";
export type {
  DiskOperation,
  DiskSpaceCheckResult,
} from "./diskSpaceDiagnostics";
