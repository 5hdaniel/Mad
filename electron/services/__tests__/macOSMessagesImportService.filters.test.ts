/**
 * macOSMessagesImportService Filter Tests (TASK-1952)
 *
 * Tests for message import filter functionality including:
 * - Apple epoch date conversion for lookback filters
 * - Count cap calculation
 * - Filter parameter validation
 * - Combined filter behavior (date + count)
 * - Backward compatibility (no filters = all messages)
 */

import { MAC_EPOCH } from "../../constants";

// ============================================================================
// Test Utilities - Replicate filter logic for unit testing
// ============================================================================

/**
 * Message import filter interface (mirrors service definition)
 */
interface MessageImportFilters {
  lookbackMonths?: number | null;
  maxMessages?: number | null;
}

/**
 * Calculate Apple epoch nanosecond cutoff from lookback months.
 * macOS Messages stores dates as nanoseconds since 2001-01-01 (Apple epoch).
 * This replicates the logic used in macOSMessagesImportService.doImport().
 */
function calculateAppleDateCutoff(lookbackMonths: number): number {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - lookbackMonths);
  const cutoffMs = cutoffDate.getTime() - MAC_EPOCH;
  return cutoffMs * 1000000; // Convert ms to nanoseconds
}

/**
 * Calculate effective message count with filters applied
 */
function calculateFilteredCount(
  totalCount: number,
  dateFilteredCount: number,
  filters: MessageImportFilters
): number {
  let count = filters.lookbackMonths ? dateFilteredCount : totalCount;
  if (filters.maxMessages && filters.maxMessages > 0) {
    count = Math.min(count, filters.maxMessages);
  }
  return count;
}

/**
 * Build SQL date filter clause from Apple epoch nanosecond cutoff
 */
function buildDateFilterClause(appleDateCutoffNano: number | null): string {
  return appleDateCutoffNano !== null
    ? `AND message.date > ${appleDateCutoffNano}`
    : "";
}

// ============================================================================
// Test Suites
// ============================================================================

describe("macOSMessagesImportService Filter Functions (TASK-1952)", () => {
  // ==========================================================================
  // 1. Apple Epoch Date Conversion Tests
  // ==========================================================================
  describe("Apple Epoch Date Conversion", () => {
    it("should calculate a positive nanosecond value for recent lookback", () => {
      const cutoff = calculateAppleDateCutoff(6);
      expect(cutoff).toBeGreaterThan(0);
    });

    it("should produce a larger cutoff for shorter lookback", () => {
      // 3 months ago is more recent than 12 months ago
      const threeMonths = calculateAppleDateCutoff(3);
      const twelveMonths = calculateAppleDateCutoff(12);
      expect(threeMonths).toBeGreaterThan(twelveMonths);
    });

    it("should produce a smaller cutoff for longer lookback", () => {
      const sixMonths = calculateAppleDateCutoff(6);
      const twentyFourMonths = calculateAppleDateCutoff(24);
      expect(twentyFourMonths).toBeLessThan(sixMonths);
    });

    it("should convert known date correctly to Apple epoch nanoseconds", () => {
      // Manually calculate: MAC_EPOCH is 2001-01-01 in milliseconds
      // A date 12 months ago from "now" should produce a predictable range
      const cutoff = calculateAppleDateCutoff(12);

      // The cutoff should correspond to roughly 12 months before now
      // Convert back to verify
      const cutoffMs = cutoff / 1000000; // nanoseconds -> milliseconds
      const cutoffDate = new Date(MAC_EPOCH + cutoffMs);
      const now = new Date();

      // The cutoff date should be roughly 12 months ago (within a few days)
      const expectedMonthsAgo = 12;
      const actualMonthsDiff =
        (now.getFullYear() - cutoffDate.getFullYear()) * 12 +
        (now.getMonth() - cutoffDate.getMonth());
      expect(actualMonthsDiff).toBeGreaterThanOrEqual(expectedMonthsAgo - 1);
      expect(actualMonthsDiff).toBeLessThanOrEqual(expectedMonthsAgo + 1);
    });

    it("should handle 3 month lookback", () => {
      const cutoff = calculateAppleDateCutoff(3);
      const cutoffMs = cutoff / 1000000;
      const cutoffDate = new Date(MAC_EPOCH + cutoffMs);
      const now = new Date();

      // Should be roughly 3 months ago
      const monthsDiff =
        (now.getFullYear() - cutoffDate.getFullYear()) * 12 +
        (now.getMonth() - cutoffDate.getMonth());
      expect(monthsDiff).toBeGreaterThanOrEqual(2);
      expect(monthsDiff).toBeLessThanOrEqual(4);
    });

    it("should handle 24 month lookback", () => {
      const cutoff = calculateAppleDateCutoff(24);
      const cutoffMs = cutoff / 1000000;
      const cutoffDate = new Date(MAC_EPOCH + cutoffMs);
      const now = new Date();

      // Should be roughly 24 months ago
      const monthsDiff =
        (now.getFullYear() - cutoffDate.getFullYear()) * 12 +
        (now.getMonth() - cutoffDate.getMonth());
      expect(monthsDiff).toBeGreaterThanOrEqual(23);
      expect(monthsDiff).toBeLessThanOrEqual(25);
    });

    it("should produce nanosecond-scale values (not milliseconds)", () => {
      const cutoff = calculateAppleDateCutoff(6);
      // Nanosecond values for dates after 2001 should be very large numbers
      // At minimum in the hundreds of trillions range
      expect(cutoff).toBeGreaterThan(1e14);
    });
  });

  // ==========================================================================
  // 2. SQL Date Filter Clause Tests
  // ==========================================================================
  describe("SQL Date Filter Clause", () => {
    it("should return empty string when cutoff is null", () => {
      const clause = buildDateFilterClause(null);
      expect(clause).toBe("");
    });

    it("should return AND clause when cutoff is provided", () => {
      const cutoff = 725846400000000000;
      const clause = buildDateFilterClause(cutoff);
      expect(clause).toBe(`AND message.date > ${cutoff}`);
    });

    it("should include the exact nanosecond value", () => {
      const cutoff = calculateAppleDateCutoff(6);
      const clause = buildDateFilterClause(cutoff);
      expect(clause).toContain(cutoff.toString());
    });
  });

  // ==========================================================================
  // 3. Count Cap Filter Tests
  // ==========================================================================
  describe("Count Cap Filter", () => {
    it("should return total count when no cap is set", () => {
      const result = calculateFilteredCount(100000, 100000, {});
      expect(result).toBe(100000);
    });

    it("should return total count when maxMessages is null", () => {
      const result = calculateFilteredCount(100000, 100000, {
        maxMessages: null,
      });
      expect(result).toBe(100000);
    });

    it("should cap count when maxMessages is less than total", () => {
      const result = calculateFilteredCount(100000, 100000, {
        maxMessages: 50000,
      });
      expect(result).toBe(50000);
    });

    it("should return total when maxMessages exceeds total", () => {
      const result = calculateFilteredCount(30000, 30000, {
        maxMessages: 100000,
      });
      expect(result).toBe(30000);
    });

    it("should handle maxMessages of 10000", () => {
      const result = calculateFilteredCount(500000, 500000, {
        maxMessages: 10000,
      });
      expect(result).toBe(10000);
    });

    it("should handle maxMessages of 250000", () => {
      const result = calculateFilteredCount(500000, 500000, {
        maxMessages: 250000,
      });
      expect(result).toBe(250000);
    });

    it("should handle maxMessages of 500000", () => {
      const result = calculateFilteredCount(600000, 600000, {
        maxMessages: 500000,
      });
      expect(result).toBe(500000);
    });
  });

  // ==========================================================================
  // 4. Combined Filter Tests (Date + Count)
  // ==========================================================================
  describe("Combined Filters (Date + Count)", () => {
    it("should apply count cap after date filter", () => {
      // 200K messages after date filter, cap at 50K
      const result = calculateFilteredCount(500000, 200000, {
        lookbackMonths: 6,
        maxMessages: 50000,
      });
      expect(result).toBe(50000);
    });

    it("should use date-filtered count when cap exceeds it", () => {
      // 30K messages after date filter, cap at 100K
      const result = calculateFilteredCount(500000, 30000, {
        lookbackMonths: 3,
        maxMessages: 100000,
      });
      expect(result).toBe(30000);
    });

    it("should handle both filters being null (backward compatible)", () => {
      const result = calculateFilteredCount(500000, 500000, {
        lookbackMonths: null,
        maxMessages: null,
      });
      expect(result).toBe(500000);
    });

    it("should handle only date filter active", () => {
      const result = calculateFilteredCount(500000, 150000, {
        lookbackMonths: 12,
        maxMessages: null,
      });
      expect(result).toBe(150000);
    });

    it("should handle only count cap active", () => {
      const result = calculateFilteredCount(500000, 500000, {
        lookbackMonths: null,
        maxMessages: 100000,
      });
      expect(result).toBe(100000);
    });
  });

  // ==========================================================================
  // 5. Filter Parameter Validation Tests
  // ==========================================================================
  describe("Filter Parameter Validation", () => {
    it("should treat undefined filters as no filtering", () => {
      const filters: MessageImportFilters | undefined = undefined;
      const lookbackMonths = filters?.lookbackMonths ?? null;
      const maxMessages = filters?.maxMessages ?? null;
      expect(lookbackMonths).toBeNull();
      expect(maxMessages).toBeNull();
    });

    it("should treat empty object as no filtering", () => {
      const filters: MessageImportFilters = {};
      const lookbackMonths = filters.lookbackMonths ?? null;
      const maxMessages = filters.maxMessages ?? null;
      expect(lookbackMonths).toBeNull();
      expect(maxMessages).toBeNull();
    });

    it("should extract valid lookbackMonths", () => {
      const filters: MessageImportFilters = { lookbackMonths: 6 };
      expect(filters.lookbackMonths).toBe(6);
    });

    it("should extract valid maxMessages", () => {
      const filters: MessageImportFilters = { maxMessages: 50000 };
      expect(filters.maxMessages).toBe(50000);
    });

    it("should handle lookbackMonths of 0 as no filter", () => {
      const filters: MessageImportFilters = { lookbackMonths: 0 };
      // 0 should be treated as falsy (no filter)
      const shouldFilter = filters.lookbackMonths && filters.lookbackMonths > 0;
      expect(shouldFilter).toBeFalsy();
    });

    it("should handle maxMessages of 0 as no filter", () => {
      const filters: MessageImportFilters = { maxMessages: 0 };
      const shouldCap = filters.maxMessages && filters.maxMessages > 0;
      expect(shouldCap).toBeFalsy();
    });

    it("should handle all valid lookback options", () => {
      const validOptions = [3, 6, 9, 12, 18, 24];
      for (const months of validOptions) {
        const cutoff = calculateAppleDateCutoff(months);
        expect(cutoff).toBeGreaterThan(0);
      }
    });

    it("should handle all valid max message options", () => {
      const validOptions = [10000, 50000, 100000, 250000, 500000];
      for (const maxMsg of validOptions) {
        const result = calculateFilteredCount(600000, 600000, {
          maxMessages: maxMsg,
        });
        expect(result).toBe(maxMsg);
      }
    });
  });

  // ==========================================================================
  // 6. Backward Compatibility Tests
  // ==========================================================================
  describe("Backward Compatibility", () => {
    it("should import all messages when no filters are provided", () => {
      const totalCount = 678070;
      const filters: MessageImportFilters = {};
      const result = calculateFilteredCount(totalCount, totalCount, filters);
      expect(result).toBe(totalCount);
    });

    it("should import all messages when filters are null", () => {
      const totalCount = 678070;
      const filters: MessageImportFilters = {
        lookbackMonths: null,
        maxMessages: null,
      };
      const result = calculateFilteredCount(totalCount, totalCount, filters);
      expect(result).toBe(totalCount);
    });

    it("should generate empty date filter clause for null lookback", () => {
      const clause = buildDateFilterClause(null);
      expect(clause).toBe("");
    });
  });

  // ==========================================================================
  // 7. Preference Structure Tests
  // ==========================================================================
  describe("Preference Structure", () => {
    it("should match expected messageImport.filters schema", () => {
      const prefs = {
        messageImport: {
          filters: {
            lookbackMonths: 6 as number | null,
            maxMessages: 50000 as number | null,
          },
        },
      };

      expect(prefs.messageImport.filters.lookbackMonths).toBe(6);
      expect(prefs.messageImport.filters.maxMessages).toBe(50000);
    });

    it("should handle missing filters key in preferences", () => {
      const prefs: Record<string, unknown> = {};
      const messageImport = prefs.messageImport as
        | { filters?: { lookbackMonths?: number | null; maxMessages?: number | null } }
        | undefined;
      expect(messageImport?.filters?.lookbackMonths ?? null).toBeNull();
      expect(messageImport?.filters?.maxMessages ?? null).toBeNull();
    });

    it("should handle partial filter preferences", () => {
      const prefs = {
        messageImport: {
          filters: {
            lookbackMonths: 12,
            // maxMessages not set
          },
        },
      };

      expect(prefs.messageImport.filters.lookbackMonths).toBe(12);
      expect(
        (prefs.messageImport.filters as Record<string, unknown>).maxMessages ??
          null
      ).toBeNull();
    });
  });
});
