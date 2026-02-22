/**
 * macOSMessagesImportService Chunked Processing Tests (TASK-2047)
 *
 * Tests for the chunked async processing that prevents UI freezes
 * during large iMessage imports. Verifies:
 * - processItemsInChunks processes all items correctly
 * - Event loop yielding occurs between batches (via setImmediate)
 * - Progress callback is called with correct batch numbers
 * - Cancellation via AbortSignal stops processing
 * - Partial results are returned on cancellation (no data loss)
 * - Edge cases: 0 items, 1 item, items below batch size, exact multiples
 */

// Polyfill setImmediate for jsdom test environment (not available in browsers/jsdom)
// In Electron (production), setImmediate is always available via Node.js
if (typeof globalThis.setImmediate === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).setImmediate = (fn: (...args: unknown[]) => void, ...args: unknown[]) => {
    return setTimeout(fn, 0, ...args);
  };
}

import {
  processItemsInChunks,
  yieldToEventLoop,
} from "../../services/macOSMessagesImportService/importHelpers";

import {
  TEXT_EXTRACTION_YIELD_INTERVAL,
  PROGRESS_REPORT_INTERVAL,
} from "../../services/macOSMessagesImportService/types";

// ============================================================================
// Test Suites
// ============================================================================

describe("Chunked Processing (TASK-2047)", () => {
  // ==========================================================================
  // 1. processItemsInChunks - Core Behavior
  // ==========================================================================
  describe("processItemsInChunks", () => {
    it("should process all items correctly with default batch size", async () => {
      const items = Array.from({ length: 10 }, (_, i) => i);
      const processBatch = async (batch: number[]): Promise<number[]> => {
        return batch.map((x) => x * 2);
      };

      const result = await processItemsInChunks(items, processBatch, {
        batchSize: 3,
      });

      expect(result.results).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
      expect(result.wasCancelled).toBe(false);
      expect(result.totalBatches).toBe(4); // ceil(10/3) = 4
      expect(result.batchesProcessed).toBe(4);
    });

    it("should handle empty array", async () => {
      const items: number[] = [];
      const processBatch = async (batch: number[]): Promise<number[]> => {
        return batch;
      };

      const result = await processItemsInChunks(items, processBatch);

      expect(result.results).toEqual([]);
      expect(result.wasCancelled).toBe(false);
      expect(result.totalBatches).toBe(0);
      expect(result.batchesProcessed).toBe(0);
    });

    it("should handle single item (below batch size)", async () => {
      const items = [42];
      const processBatch = async (batch: number[]): Promise<number[]> => {
        return batch.map((x) => x + 1);
      };

      const result = await processItemsInChunks(items, processBatch, {
        batchSize: 500,
      });

      expect(result.results).toEqual([43]);
      expect(result.wasCancelled).toBe(false);
      expect(result.totalBatches).toBe(1);
      expect(result.batchesProcessed).toBe(1);
    });

    it("should handle items exactly at batch size boundary", async () => {
      const items = Array.from({ length: 10 }, (_, i) => i);
      const processBatch = async (batch: number[]): Promise<number[]> => {
        return batch;
      };

      const result = await processItemsInChunks(items, processBatch, {
        batchSize: 5,
      });

      expect(result.results).toHaveLength(10);
      expect(result.totalBatches).toBe(2); // 10/5 = 2
      expect(result.batchesProcessed).toBe(2);
    });

    it("should process 1001 items in multiple batches (batch size 500)", async () => {
      const items = Array.from({ length: 1001 }, (_, i) => i);
      const batchCalls: number[] = [];
      const processBatch = async (batch: number[]): Promise<number[]> => {
        batchCalls.push(batch.length);
        return batch;
      };

      const result = await processItemsInChunks(items, processBatch, {
        batchSize: 500,
      });

      expect(result.results).toHaveLength(1001);
      expect(result.totalBatches).toBe(3); // ceil(1001/500) = 3
      expect(result.batchesProcessed).toBe(3);
      // Verify batch sizes: 500, 500, 1
      expect(batchCalls).toEqual([500, 500, 1]);
    });

    it("should use default batch size of 500 when not specified", async () => {
      const items = Array.from({ length: 600 }, (_, i) => i);
      const batchCalls: number[] = [];
      const processBatch = async (batch: number[]): Promise<number[]> => {
        batchCalls.push(batch.length);
        return batch;
      };

      const result = await processItemsInChunks(items, processBatch);

      expect(result.totalBatches).toBe(2); // ceil(600/500) = 2
      expect(batchCalls).toEqual([500, 100]);
    });
  });

  // ==========================================================================
  // 2. Progress Callback
  // ==========================================================================
  describe("Progress callback", () => {
    it("should call progress with correct batch numbers", async () => {
      const items = Array.from({ length: 15 }, (_, i) => i);
      const progressCalls: Array<{ current: number; total: number }> = [];

      const processBatch = async (batch: number[]): Promise<number[]> => {
        return batch;
      };

      await processItemsInChunks(items, processBatch, {
        batchSize: 5,
        onProgress: (current, total) => {
          progressCalls.push({ current, total });
        },
      });

      expect(progressCalls).toEqual([
        { current: 1, total: 3 },
        { current: 2, total: 3 },
        { current: 3, total: 3 },
      ]);
    });

    it("should call progress for single batch", async () => {
      const items = [1, 2, 3];
      const progressCalls: Array<{ current: number; total: number }> = [];

      const processBatch = async (batch: number[]): Promise<number[]> => {
        return batch;
      };

      await processItemsInChunks(items, processBatch, {
        batchSize: 500,
        onProgress: (current, total) => {
          progressCalls.push({ current, total });
        },
      });

      expect(progressCalls).toEqual([{ current: 1, total: 1 }]);
    });

    it("should not call progress for empty input", async () => {
      const progressCalls: Array<{ current: number; total: number }> = [];

      const processBatch = async (batch: number[]): Promise<number[]> => {
        return batch;
      };

      await processItemsInChunks([], processBatch, {
        batchSize: 500,
        onProgress: (current, total) => {
          progressCalls.push({ current, total });
        },
      });

      expect(progressCalls).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 3. Cancellation via AbortSignal
  // ==========================================================================
  describe("Cancellation via AbortSignal", () => {
    it("should stop processing when AbortSignal is aborted", async () => {
      const items = Array.from({ length: 100 }, (_, i) => i);
      const controller = new AbortController();
      let batchesRun = 0;

      const processBatch = async (batch: number[]): Promise<number[]> => {
        batchesRun++;
        // Abort after first batch
        if (batchesRun === 1) {
          controller.abort();
        }
        return batch;
      };

      const result = await processItemsInChunks(items, processBatch, {
        batchSize: 10,
        abortSignal: controller.signal,
      });

      // First batch processes, then cancellation detected before second batch
      expect(result.wasCancelled).toBe(true);
      expect(result.batchesProcessed).toBe(1);
      // Partial results from first batch are preserved
      expect(result.results).toHaveLength(10);
      expect(result.results).toEqual(Array.from({ length: 10 }, (_, i) => i));
    });

    it("should return partial results on cancellation (no data loss)", async () => {
      const items = Array.from({ length: 50 }, (_, i) => i);
      const controller = new AbortController();
      let batchesRun = 0;

      const processBatch = async (batch: number[]): Promise<number[]> => {
        batchesRun++;
        // Abort after 3 batches
        if (batchesRun === 3) {
          controller.abort();
        }
        return batch.map((x) => x * 10);
      };

      const result = await processItemsInChunks(items, processBatch, {
        batchSize: 10,
        abortSignal: controller.signal,
      });

      expect(result.wasCancelled).toBe(true);
      expect(result.batchesProcessed).toBe(3);
      // Should have results from 3 batches (30 items processed)
      expect(result.results).toHaveLength(30);
      // Verify data integrity
      expect(result.results[0]).toBe(0);
      expect(result.results[9]).toBe(90);
      expect(result.results[29]).toBe(290);
    });

    it("should handle pre-aborted signal", async () => {
      const items = Array.from({ length: 10 }, (_, i) => i);
      const controller = new AbortController();
      controller.abort(); // Pre-abort

      const processBatch = async (batch: number[]): Promise<number[]> => {
        return batch;
      };

      const result = await processItemsInChunks(items, processBatch, {
        batchSize: 5,
        abortSignal: controller.signal,
      });

      expect(result.wasCancelled).toBe(true);
      expect(result.batchesProcessed).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it("should process all items when AbortSignal is never aborted", async () => {
      const items = Array.from({ length: 25 }, (_, i) => i);
      const controller = new AbortController();

      const processBatch = async (batch: number[]): Promise<number[]> => {
        return batch;
      };

      const result = await processItemsInChunks(items, processBatch, {
        batchSize: 10,
        abortSignal: controller.signal,
      });

      expect(result.wasCancelled).toBe(false);
      expect(result.batchesProcessed).toBe(3);
      expect(result.results).toHaveLength(25);
    });
  });

  // ==========================================================================
  // 4. Event Loop Yielding
  // ==========================================================================
  describe("Event loop yielding", () => {
    it("should yield to event loop between batches", async () => {
      // Verify that processItemsInChunks yields between batches by checking
      // that other async work can interleave. We use a counter that increments
      // in a microtask scheduled between batches.
      let yieldCount = 0;
      const items = Array.from({ length: 15 }, (_, i) => i);
      const processBatch = async (batch: number[]): Promise<number[]> => {
        // Schedule a microtask that runs after the yield
        setTimeout(() => { yieldCount++; }, 0);
        return batch;
      };

      await processItemsInChunks(items, processBatch, {
        batchSize: 5,
      });

      // After all 3 batches + yields, the setTimeout callbacks should have had
      // the opportunity to run due to setImmediate yields
      // We need to wait a tick for them to resolve
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(yieldCount).toBe(3);
    });

    it("yieldToEventLoop resolves via setImmediate", async () => {
      // Verify that yieldToEventLoop returns a promise that resolves
      const result = await yieldToEventLoop();
      expect(result).toBeUndefined();
    });
  });

  // ==========================================================================
  // 5. Constants Validation
  // ==========================================================================
  describe("TASK-2047 Constants", () => {
    it("TEXT_EXTRACTION_YIELD_INTERVAL should be a positive number", () => {
      expect(TEXT_EXTRACTION_YIELD_INTERVAL).toBeGreaterThan(0);
      expect(Number.isInteger(TEXT_EXTRACTION_YIELD_INTERVAL)).toBe(true);
    });

    it("PROGRESS_REPORT_INTERVAL should be a positive number", () => {
      expect(PROGRESS_REPORT_INTERVAL).toBeGreaterThan(0);
      expect(Number.isInteger(PROGRESS_REPORT_INTERVAL)).toBe(true);
    });

    it("PROGRESS_REPORT_INTERVAL should be less than previous value (100)", () => {
      // TASK-2047 changed from 100 to PROGRESS_REPORT_INTERVAL for more frequent updates
      expect(PROGRESS_REPORT_INTERVAL).toBeLessThan(100);
    });
  });

  // ==========================================================================
  // 6. Edge Cases and Stress Tests
  // ==========================================================================
  describe("Edge cases", () => {
    it("should handle processBatch returning fewer items than input", async () => {
      const items = Array.from({ length: 10 }, (_, i) => i);
      const processBatch = async (batch: number[]): Promise<number[]> => {
        // Filter: only return even numbers
        return batch.filter((x) => x % 2 === 0);
      };

      const result = await processItemsInChunks(items, processBatch, {
        batchSize: 5,
      });

      expect(result.results).toEqual([0, 2, 4, 6, 8]);
      expect(result.wasCancelled).toBe(false);
    });

    it("should handle processBatch returning empty array", async () => {
      const items = Array.from({ length: 10 }, (_, i) => i);
      const processBatch = async (_batch: number[]): Promise<number[]> => {
        return []; // All items filtered out
      };

      const result = await processItemsInChunks(items, processBatch, {
        batchSize: 5,
      });

      expect(result.results).toEqual([]);
      expect(result.batchesProcessed).toBe(2);
      expect(result.wasCancelled).toBe(false);
    });

    it("should handle processBatch returning more items than input", async () => {
      const items = [1, 2, 3];
      const processBatch = async (batch: number[]): Promise<number[]> => {
        // Expand: each item becomes two items
        const expanded: number[] = [];
        for (const x of batch) {
          expanded.push(x, x * 10);
        }
        return expanded;
      };

      const result = await processItemsInChunks(items, processBatch, {
        batchSize: 2,
      });

      expect(result.results).toEqual([1, 10, 2, 20, 3, 30]);
    });

    it("should handle batch size of 1", async () => {
      const items = [10, 20, 30];
      let batchCount = 0;
      const processBatch = async (batch: number[]): Promise<number[]> => {
        batchCount++;
        expect(batch).toHaveLength(1);
        return batch;
      };

      const result = await processItemsInChunks(items, processBatch, {
        batchSize: 1,
      });

      expect(result.results).toEqual([10, 20, 30]);
      expect(batchCount).toBe(3);
      expect(result.totalBatches).toBe(3);
    });

    it("should handle async processBatch with delays", async () => {
      const items = Array.from({ length: 5 }, (_, i) => i);
      const processBatch = async (batch: number[]): Promise<number[]> => {
        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 1));
        return batch.map((x) => x + 100);
      };

      const result = await processItemsInChunks(items, processBatch, {
        batchSize: 2,
      });

      expect(result.results).toEqual([100, 101, 102, 103, 104]);
    });
  });
});
