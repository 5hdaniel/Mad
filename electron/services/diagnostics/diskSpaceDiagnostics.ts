/**
 * Disk Space Diagnostic Utility (TASK-2270)
 *
 * Checks available disk space before critical operations and reports
 * low-space conditions to Sentry with rich context. Returns structured
 * results so callers can build user-facing messages.
 *
 * Usage:
 *   import { checkDiskSpaceForOperation } from "./diagnostics";
 *   const result = await checkDiskSpaceForOperation("sync");
 *   if (!result.sufficient) { // show warning to user }
 */

import * as Sentry from "@sentry/electron/main";
import checkDiskSpace from "check-disk-space";
import { app } from "electron";
import log from "electron-log";

/** Minimum disk space thresholds per operation (in MB) */
export const DISK_SPACE_THRESHOLDS = {
  sync: 2048, // 2GB -- iPhone backups can be very large
  update: 1024, // 1GB -- app update download + install
  emailImport: 512, // 500MB -- 3-month email archive
  general: 100, // 100MB -- minimum for app operation
} as const;

export type DiskOperation = keyof typeof DISK_SPACE_THRESHOLDS;

export interface DiskSpaceCheckResult {
  sufficient: boolean;
  availableMB: number;
  requiredMB: number;
  path: string;
  warning: boolean; // true if < 1GB but above minimum
}

/**
 * Check disk space before a critical operation.
 *
 * Always adds a Sentry breadcrumb for audit trail.
 * Reports captureMessage (warning/error) when space is insufficient.
 * On check failure, returns sufficient=true so operations are not blocked.
 */
export async function checkDiskSpaceForOperation(
  operation: DiskOperation,
  customMinMB?: number
): Promise<DiskSpaceCheckResult> {
  const requiredMB = customMinMB ?? DISK_SPACE_THRESHOLDS[operation];
  const targetPath = app.getPath("userData");

  try {
    const { free } = await checkDiskSpace(targetPath);
    const availableMB = Math.round(free / (1024 * 1024));
    const sufficient = availableMB >= requiredMB;
    const warning = availableMB < 1024 && sufficient; // < 1GB but still enough

    // Always add breadcrumb for audit trail
    Sentry.addBreadcrumb({
      category: "diagnostics.disk",
      message: `Disk check for ${operation}: ${availableMB}MB available, ${requiredMB}MB required`,
      level: sufficient ? "info" : "warning",
      data: { operation, availableMB, requiredMB, sufficient },
    });

    if (!sufficient) {
      Sentry.captureMessage(`Insufficient disk space for ${operation}`, {
        level: availableMB < 100 ? "error" : "warning",
        tags: {
          operation,
          platform: process.platform,
        },
        extra: {
          availableMB,
          requiredMB,
          path: targetPath,
        },
      });
      log.warn(
        `[DiskDiagnostics] Insufficient space for ${operation}: ${availableMB}MB < ${requiredMB}MB`
      );
    }

    return { sufficient, availableMB, requiredMB, path: targetPath, warning };
  } catch (error) {
    // Graceful degradation: if check fails, allow operation but log
    log.error("[DiskDiagnostics] Failed to check disk space:", error);
    Sentry.captureException(error, {
      tags: { operation, check: "disk_space" },
    });
    return {
      sufficient: true, // Assume sufficient if check fails
      availableMB: -1,
      requiredMB,
      path: targetPath,
      warning: true,
    };
  }
}
