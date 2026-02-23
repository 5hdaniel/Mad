/**
 * TASK-2060: Tests for email sync helper functions
 *
 * Tests the date-range computation logic that replaces the hardcoded
 * maxResults:200 cap with transaction-aware date filtering.
 *
 * TASK-2068: computeEmailFetchSinceDate is now a re-export from
 * electron/utils/emailDateRange.ts. Canonical tests live in
 * electron/utils/__tests__/emailDateRange.test.ts.
 * This file verifies the re-export still works from emailSyncHandlers.
 *
 * TASK-2066: Constants moved to electron/services/emailSyncService.ts.
 * Re-exported from emailSyncHandlers for backwards compatibility.
 */

import {
  computeEmailFetchSinceDate,
  EMAIL_FETCH_SAFETY_CAP,
  SENT_ITEMS_SAFETY_CAP,
} from "../emailSyncHandlers";

describe("computeEmailFetchSinceDate", () => {
  it("should use started_at when available", () => {
    const started = new Date("2024-03-15T00:00:00Z");
    const result = computeEmailFetchSinceDate({
      started_at: started,
      created_at: new Date("2024-06-01T00:00:00Z"),
    });
    expect(result.getTime()).toBe(started.getTime());
  });

  it("should use started_at as ISO string", () => {
    const result = computeEmailFetchSinceDate({
      started_at: "2024-03-15T00:00:00Z",
      created_at: "2024-06-01T00:00:00Z",
    });
    expect(result.toISOString()).toBe("2024-03-15T00:00:00.000Z");
  });

  it("should fall back to created_at when started_at is missing", () => {
    const created = new Date("2024-06-01T00:00:00Z");
    const result = computeEmailFetchSinceDate({
      created_at: created,
    });
    expect(result.getTime()).toBe(created.getTime());
  });

  it("should fall back to created_at when started_at is undefined", () => {
    const result = computeEmailFetchSinceDate({
      started_at: undefined,
      created_at: "2024-01-20T12:00:00Z",
    });
    expect(result.toISOString()).toBe("2024-01-20T12:00:00.000Z");
  });

  it("should fall back to 2 years ago when no dates available", () => {
    const before = new Date();
    const result = computeEmailFetchSinceDate({});
    const after = new Date();

    // Should be approximately 2 years ago (within a few seconds tolerance)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const diffMs = Math.abs(result.getTime() - twoYearsAgo.getTime());
    expect(diffMs).toBeLessThan(5000); // Within 5 seconds
  });

  it("should handle invalid started_at by falling back to created_at", () => {
    const result = computeEmailFetchSinceDate({
      started_at: "invalid-date",
      created_at: "2024-06-01T00:00:00Z",
    });
    expect(result.toISOString()).toBe("2024-06-01T00:00:00.000Z");
  });

  it("should handle both dates invalid by using 2-year fallback", () => {
    const result = computeEmailFetchSinceDate({
      started_at: "invalid",
      created_at: "also-invalid",
    });

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const diffMs = Math.abs(result.getTime() - twoYearsAgo.getTime());
    expect(diffMs).toBeLessThan(5000);
  });
});

describe("Safety cap constants", () => {
  it("should have EMAIL_FETCH_SAFETY_CAP set to 2000", () => {
    expect(EMAIL_FETCH_SAFETY_CAP).toBe(2000);
  });

  it("should have SENT_ITEMS_SAFETY_CAP set to 200", () => {
    expect(SENT_ITEMS_SAFETY_CAP).toBe(200);
  });

  it("should have safety caps much higher than the old 200 limit", () => {
    // The old hardcoded maxResults was 200, which dropped older emails
    expect(EMAIL_FETCH_SAFETY_CAP).toBeGreaterThan(200);
  });
});
