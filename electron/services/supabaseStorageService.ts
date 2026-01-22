/**
 * Supabase Storage Service (BACKLOG-393)
 *
 * Handles file uploads to Supabase Storage for B2B broker portal.
 * Used when submitting transactions for broker review.
 *
 * Storage Bucket: submission-attachments
 * Path Convention: {org_id}/{submission_id}/{filename}
 *
 * @see supabase/migrations/20260122_b2b_broker_portal.sql for bucket setup
 */

import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import mime from "mime-types";
import supabaseService from "./supabaseService";
import logService from "./logService";
import { sanitizeFilenamePreserveCase } from "../utils/fileUtils";

// ============================================
// TYPES & INTERFACES
// ============================================

/** Upload progress for a single file */
export interface UploadProgress {
  filename: string;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  status: "pending" | "uploading" | "complete" | "failed";
  error?: string;
}

/** Result of uploading a single attachment */
export interface AttachmentUploadResult {
  localId: string;
  storagePath: string;
  publicUrl?: string;
  success: boolean;
  error?: string;
  mimeType?: string;
  fileSizeBytes?: number;
}

/** Local attachment info (from database) */
export interface LocalAttachment {
  id: string;
  localPath: string;
  filename: string;
}

/** Batch upload result */
export interface BatchUploadResult {
  totalCount: number;
  successCount: number;
  failedCount: number;
  results: AttachmentUploadResult[];
}

// ============================================
// CONSTANTS
// ============================================

const STORAGE_BUCKET = "submission-attachments";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get MIME type from filename
 */
function getMimeType(filename: string): string {
  return mime.lookup(filename) || "application/octet-stream";
}

/**
 * Resolve attachment path - handles different attachment sources
 * - Email attachments: stored absolute path
 * - iMessage: ~/Library/Messages/Attachments/...
 * - Manual files: user's document paths
 */
function resolveAttachmentPath(localPath: string): string {
  // Expand ~ to home directory
  if (localPath.startsWith("~")) {
    const home = app.getPath("home");
    return path.join(home, localPath.slice(1));
  }

  // Already absolute
  if (path.isAbsolute(localPath)) {
    return localPath;
  }

  // Relative to app data
  const userData = app.getPath("userData");
  return path.join(userData, "attachments", localPath);
}

/**
 * Sanitize filename for storage (URL-safe)
 */
function sanitizeStorageFilename(filename: string): string {
  // Preserve extension
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);

  // Use existing utility, collapse multiple underscores
  const sanitizedBase = sanitizeFilenamePreserveCase(base, false)
    .replace(/__+/g, "_")
    .substring(0, 200); // Leave room for extension

  return `${sanitizedBase}${ext.toLowerCase()}`;
}

// ============================================
// SERVICE CLASS
// ============================================

class SupabaseStorageService {
  /**
   * Upload a single attachment to Supabase Storage
   *
   * @param orgId - Organization ID for path organization
   * @param submissionId - Submission ID for path organization
   * @param localPath - Local filesystem path to the file
   * @param filename - Original filename
   * @param onProgress - Optional progress callback
   * @returns Upload result with storage path
   */
  async uploadAttachment(
    orgId: string,
    submissionId: string,
    localPath: string,
    filename: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<AttachmentUploadResult> {
    const sanitizedFilename = sanitizeStorageFilename(filename);
    const storagePath = `${orgId}/${submissionId}/${sanitizedFilename}`;

    try {
      // Resolve and check local file
      const absolutePath = resolveAttachmentPath(localPath);

      if (!fs.existsSync(absolutePath)) {
        const error = `File not found: ${absolutePath}`;
        logService.warn(
          `[Storage] ${error}`,
          "SupabaseStorageService"
        );
        onProgress?.({
          filename,
          bytesUploaded: 0,
          totalBytes: 0,
          percentage: 0,
          status: "failed",
          error,
        });
        return {
          localId: localPath,
          storagePath: "",
          success: false,
          error,
        };
      }

      // Get file stats
      const stats = fs.statSync(absolutePath);
      const fileSizeBytes = stats.size;

      // Check file size
      if (fileSizeBytes > MAX_FILE_SIZE) {
        const error = `File too large: ${(fileSizeBytes / 1024 / 1024).toFixed(2)}MB (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`;
        logService.warn(`[Storage] ${error}`, "SupabaseStorageService");
        onProgress?.({
          filename,
          bytesUploaded: 0,
          totalBytes: fileSizeBytes,
          percentage: 0,
          status: "failed",
          error,
        });
        return {
          localId: localPath,
          storagePath: "",
          success: false,
          error,
          fileSizeBytes,
        };
      }

      // Report uploading status
      onProgress?.({
        filename,
        bytesUploaded: 0,
        totalBytes: fileSizeBytes,
        percentage: 0,
        status: "uploading",
      });

      // Read file into buffer
      const fileBuffer = await fs.promises.readFile(absolutePath);
      const mimeType = getMimeType(filename);

      logService.debug(
        `[Storage] Uploading ${filename} (${(fileSizeBytes / 1024).toFixed(1)}KB) to ${storagePath}`,
        "SupabaseStorageService"
      );

      // Get Supabase client
      const client = supabaseService.getClient();

      // Upload to Supabase Storage
      const { data, error } = await client.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: false, // Don't overwrite existing
        });

      if (error) {
        // Check if it's a duplicate file (already exists)
        if (error.message?.includes("already exists")) {
          logService.info(
            `[Storage] File already exists: ${storagePath}`,
            "SupabaseStorageService"
          );
          onProgress?.({
            filename,
            bytesUploaded: fileSizeBytes,
            totalBytes: fileSizeBytes,
            percentage: 100,
            status: "complete",
          });
          return {
            localId: localPath,
            storagePath,
            success: true,
            mimeType,
            fileSizeBytes,
          };
        }
        throw error;
      }

      // Report complete
      onProgress?.({
        filename,
        bytesUploaded: fileSizeBytes,
        totalBytes: fileSizeBytes,
        percentage: 100,
        status: "complete",
      });

      logService.info(
        `[Storage] Uploaded ${filename} successfully`,
        "SupabaseStorageService"
      );

      return {
        localId: localPath,
        storagePath: data.path,
        success: true,
        mimeType,
        fileSizeBytes,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logService.error(
        `[Storage] Upload failed for ${filename}: ${errorMessage}`,
        "SupabaseStorageService"
      );

      onProgress?.({
        filename,
        bytesUploaded: 0,
        totalBytes: 0,
        percentage: 0,
        status: "failed",
        error: errorMessage,
      });

      return {
        localId: localPath,
        storagePath: "",
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Upload a single attachment with retry logic
   */
  async uploadAttachmentWithRetry(
    orgId: string,
    submissionId: string,
    localPath: string,
    filename: string,
    onProgress?: (progress: UploadProgress) => void,
    maxRetries: number = MAX_RETRIES
  ): Promise<AttachmentUploadResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.uploadAttachment(
          orgId,
          submissionId,
          localPath,
          filename,
          onProgress
        );

        // If successful or non-retryable error (like file not found), return
        if (result.success || result.error?.includes("File not found")) {
          return result;
        }

        // Retry on failure
        lastError = new Error(result.error || "Upload failed");

        if (attempt < maxRetries) {
          const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
          logService.info(
            `[Storage] Retrying ${filename} in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
            "SupabaseStorageService"
          );
          await sleep(delay);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");
        if (attempt < maxRetries) {
          const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
          await sleep(delay);
        }
      }
    }

    return {
      localId: localPath,
      storagePath: "",
      success: false,
      error: lastError?.message || "Upload failed after retries",
    };
  }

  /**
   * Upload multiple attachments for a submission
   *
   * @param orgId - Organization ID
   * @param submissionId - Submission ID
   * @param attachments - Array of local attachment info
   * @param onProgress - Overall progress callback
   * @returns Batch upload result
   */
  async uploadAttachments(
    orgId: string,
    submissionId: string,
    attachments: LocalAttachment[],
    onProgress?: (overallPercent: number, current: UploadProgress) => void
  ): Promise<BatchUploadResult> {
    const results: AttachmentUploadResult[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < attachments.length; i++) {
      const attachment = attachments[i];
      const overallBase = (i / attachments.length) * 100;
      const overallIncrement = 100 / attachments.length;

      const result = await this.uploadAttachmentWithRetry(
        orgId,
        submissionId,
        attachment.localPath,
        attachment.filename,
        (progress) => {
          const overallPercent =
            overallBase + (progress.percentage / 100) * overallIncrement;
          onProgress?.(overallPercent, progress);
        }
      );

      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }
    }

    logService.info(
      `[Storage] Batch upload complete: ${successCount}/${attachments.length} succeeded`,
      "SupabaseStorageService"
    );

    return {
      totalCount: attachments.length,
      successCount,
      failedCount,
      results,
    };
  }

  /**
   * Get a signed URL for viewing a file (for broker portal)
   *
   * @param storagePath - Path in Supabase Storage
   * @param expiresIn - URL expiration in seconds (default: 1 hour)
   * @returns Signed URL
   */
  async getSignedUrl(
    storagePath: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const client = supabaseService.getClient();
      const { data, error } = await client.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, expiresIn);

      if (error) {
        throw error;
      }

      return data.signedUrl;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logService.error(
        `[Storage] Failed to create signed URL for ${storagePath}: ${errorMessage}`,
        "SupabaseStorageService"
      );
      throw error;
    }
  }

  /**
   * Delete an attachment from storage (cleanup on failure)
   *
   * @param storagePath - Path in Supabase Storage
   */
  async deleteAttachment(storagePath: string): Promise<void> {
    try {
      const client = supabaseService.getClient();
      const { error } = await client.storage
        .from(STORAGE_BUCKET)
        .remove([storagePath]);

      if (error) {
        throw error;
      }

      logService.info(
        `[Storage] Deleted ${storagePath}`,
        "SupabaseStorageService"
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logService.error(
        `[Storage] Failed to delete ${storagePath}: ${errorMessage}`,
        "SupabaseStorageService"
      );
      throw error;
    }
  }

  /**
   * Delete all attachments for a submission (cleanup)
   *
   * @param orgId - Organization ID
   * @param submissionId - Submission ID
   */
  async deleteSubmissionAttachments(
    orgId: string,
    submissionId: string
  ): Promise<void> {
    try {
      const client = supabaseService.getClient();
      const prefix = `${orgId}/${submissionId}/`;

      // List all files in the submission folder
      const { data: files, error: listError } = await client.storage
        .from(STORAGE_BUCKET)
        .list(prefix);

      if (listError) {
        throw listError;
      }

      if (!files || files.length === 0) {
        logService.debug(
          `[Storage] No files to delete for ${prefix}`,
          "SupabaseStorageService"
        );
        return;
      }

      // Delete all files
      const paths = files.map((f) => `${prefix}${f.name}`);
      const { error: deleteError } = await client.storage
        .from(STORAGE_BUCKET)
        .remove(paths);

      if (deleteError) {
        throw deleteError;
      }

      logService.info(
        `[Storage] Deleted ${paths.length} files for submission ${submissionId}`,
        "SupabaseStorageService"
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logService.error(
        `[Storage] Failed to delete submission attachments: ${errorMessage}`,
        "SupabaseStorageService"
      );
      throw error;
    }
  }

  /**
   * Check if file exists in storage
   *
   * @param storagePath - Path in Supabase Storage
   * @returns true if file exists
   */
  async fileExists(storagePath: string): Promise<boolean> {
    try {
      const client = supabaseService.getClient();

      // Parse the path to get folder and filename
      const parts = storagePath.split("/");
      const filename = parts.pop()!;
      const folder = parts.join("/");

      const { data, error } = await client.storage
        .from(STORAGE_BUCKET)
        .list(folder, {
          search: filename,
        });

      if (error) {
        return false;
      }

      return data.some((f) => f.name === filename);
    } catch {
      return false;
    }
  }
}

// Export singleton
export const supabaseStorageService = new SupabaseStorageService();
export default supabaseStorageService;
