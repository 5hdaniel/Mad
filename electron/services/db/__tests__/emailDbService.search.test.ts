/**
 * @jest-environment node
 *
 * BACKLOG-1550: getCachedEmails must search cc/bcc fields in addition to
 * subject/sender/recipients so contacts who appear only on cc/bcc lines
 * surface in the Attach Emails modal cache lookup.
 */

import { jest } from "@jest/globals";

const mockDbAll = jest.fn();

jest.mock("../core/dbConnection", () => ({
  dbAll: (...args: unknown[]) => mockDbAll(...args),
  dbGet: jest.fn(),
  dbRun: jest.fn(),
  ensureDb: jest.fn(),
}));

import { getCachedEmails } from "../emailDbService";

describe("emailDbService.getCachedEmails — BACKLOG-1550", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDbAll.mockReturnValue([]);
  });

  it("includes cc and bcc in the LIKE clause when a query is provided", async () => {
    await getCachedEmails("user-1", { query: "smith" });

    expect(mockDbAll).toHaveBeenCalledTimes(1);
    const [sql, params] = mockDbAll.mock.calls[0] as [string, unknown[]];

    expect(sql).toContain("subject LIKE ?");
    expect(sql).toContain("sender LIKE ?");
    expect(sql).toContain("recipients LIKE ?");
    expect(sql).toContain("cc LIKE ?");
    expect(sql).toContain("bcc LIKE ?");

    // Params: [userId, q, q, q, q, q, limit]
    expect(params[0]).toBe("user-1");
    expect(params.slice(1, 6)).toEqual([
      "%smith%",
      "%smith%",
      "%smith%",
      "%smith%",
      "%smith%",
    ]);
  });

  it("does not add a query clause when no query is provided", async () => {
    await getCachedEmails("user-1", {});

    const [sql, params] = mockDbAll.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain("subject LIKE ?");
    // Params: [userId, limit]
    expect(params).toEqual(["user-1", 500]);
  });
});
