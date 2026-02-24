/**
 * macOS Messages Import Service - Helper Functions
 * Standalone utility functions used by the import service.
 * Extracted from macOSMessagesImportService.ts for maintainability.
 */

import crypto from "crypto";
import path from "path";
import fs from "fs";
import cliProgress from "cli-progress";

import type {
  ChunkedProcessingOptions,
  ChunkedProcessingResult,
} from "./types";

import {
  MAX_GUID_LENGTH,
  ALL_SUPPORTED_EXTENSIONS,
  SUPPORTED_IMAGE_EXTENSIONS,
  MIN_QUERY_BATCH_SIZE,
} from "./types";

/**
 * Create a tqdm-style progress bar for console output
 */
export function createProgressBar(label: string): cliProgress.SingleBar {
  return new cliProgress.SingleBar({
    format: `${label} |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s`,
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
    clearOnComplete: true,
  }, cliProgress.Presets.shades_classic);
}

/**
 * Calculate dynamic query batch size based on total message count.
 * Larger imports use larger batches to reduce overhead from yielding/progress updates.
 *
 * - Under 100K messages: 10% of total (min 10K)
 * - 100K - 200K messages: 15% of total
 * - Over 200K messages: 20% of total
 */
export function calculateQueryBatchSize(totalMessages: number): number {
  let percentage: number;
  if (totalMessages < 100000) {
    percentage = 0.10; // 10%
  } else if (totalMessages <= 200000) {
    percentage = 0.15; // 15%
  } else {
    percentage = 0.20; // 20%
  }

  const calculated = Math.floor(totalMessages * percentage);
  return Math.max(calculated, MIN_QUERY_BATCH_SIZE);
}

/**
 * Yield to event loop - allows UI to remain responsive
 */
export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Sanitize and validate a string field
 */
export function sanitizeString(
  value: string | null | undefined,
  maxLength: number,
  defaultValue = ""
): string {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  const str = String(value);
  return str.length > maxLength ? str.substring(0, maxLength) : str;
}

/**
 * Validate a GUID/external ID format
 */
export function isValidGuid(guid: string | null | undefined): boolean {
  if (!guid || typeof guid !== "string") return false;
  // Allow alphanumeric, hyphens, underscores, colons, and dots
  // macOS message GUIDs can be various formats
  return (
    guid.length > 0 && guid.length <= MAX_GUID_LENGTH && /^[\w\-:.]+$/.test(guid)
  );
}

/**
 * Check if a file extension is a supported media type
 * TASK-1122: Expanded to include videos, audio, and documents
 */
export function isSupportedMediaType(filename: string | null): boolean {
  if (!filename) return false;
  const ext = path.extname(filename).toLowerCase();
  return ALL_SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Check if a file extension is a supported image type (for inline display)
 */
export function isSupportedImageType(filename: string | null): boolean {
  if (!filename) return false;
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Get MIME type from filename
 * TASK-1122: Expanded to support videos, audio, and documents
 */
export function getMimeTypeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    // Images
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".heic": "image/heic",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    // Videos
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
    // Audio
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".wav": "audio/wav",
    ".caf": "audio/x-caf",
    // Documents
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".rtf": "application/rtf",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Generate a content hash for deduplication (async to avoid blocking)
 */
export async function generateContentHash(filePath: string): Promise<string> {
  const fileBuffer = await fs.promises.readFile(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

/**
 * Process items in chunks, yielding to the event loop between batches
 * so the UI thread stays responsive during large imports. (TASK-2047)
 *
 * This is the core non-blocking processing primitive. It takes an array of items,
 * processes them in configurable batch sizes, and yields to the event loop between
 * each batch via setImmediate. This prevents the main Electron thread from freezing
 * during imports of 10K+ messages.
 *
 * @param items - Array of items to process
 * @param processBatch - Async function to process a batch of items, returns results
 * @param options - Chunked processing options (batchSize, onProgress, abortSignal)
 * @returns ChunkedProcessingResult with all results and cancellation status
 */
export async function processItemsInChunks<TInput, TOutput>(
  items: TInput[],
  processBatch: (batch: TInput[]) => Promise<TOutput[]>,
  options: ChunkedProcessingOptions = {},
): Promise<ChunkedProcessingResult<TOutput>> {
  const batchSize = options.batchSize ?? 500;
  const results: TOutput[] = [];
  const totalBatches = Math.ceil(items.length / batchSize);
  let batchesProcessed = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    // Check for cancellation via AbortSignal
    if (options.abortSignal?.aborted) {
      return {
        results,
        wasCancelled: true,
        batchesProcessed,
        totalBatches,
      };
    }

    const batch = items.slice(i, i + batchSize);
    const processed = await processBatch(batch);

    // Use push loop instead of spread to avoid stack overflow with large result sets
    for (let j = 0; j < processed.length; j++) {
      results.push(processed[j]);
    }

    batchesProcessed++;

    // Yield to event loop -- allows UI to update and prevents freeze
    await yieldToEventLoop();

    // Emit progress
    options.onProgress?.(batchesProcessed, totalBatches);
  }

  return {
    results,
    wasCancelled: false,
    batchesProcessed,
    totalBatches,
  };
}
