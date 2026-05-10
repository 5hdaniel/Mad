/**
 * @jest-environment node
 *
 * BACKLOG-1550: searchLocalEmailCache must search recipients/cc/bcc in
 * addition to subject/sender/body_plain so to/cc/bcc-only matches surface
 * when provider $search fails.
 */

import { jest } from "@jest/globals";

const mockAll = jest.fn().mockReturnValue([]);
const mockPrepare = jest.fn(() => ({ all: mockAll }));
const mockEnsureDb = jest.fn(() => ({ prepare: mockPrepare }));

jest.mock("../core/dbConnection", () => ({
  ensureDb: (...args: unknown[]) => mockEnsureDb(...args),
  dbAll: jest.fn(),
  dbGet: jest.fn(),
  dbRun: jest.fn(),
}));

import { searchLocalEmailCache } from "../messageDbService";

describe("messageDbService.searchLocalEmailCache — BACKLOG-1550", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAll.mockReturnValue([]);
  });

  it("matches recipients, cc, and bcc in addition to subject/sender/body", () => {
    searchLocalEmailCache("user-1", "smith");

    expect(mockPrepare).toHaveBeenCalledTimes(1);
    const sql = mockPrepare.mock.calls[0][0] as string;

    expect(sql).toContain("LOWER(e.subject) LIKE LOWER(?)");
    expect(sql).toContain("LOWER(e.sender) LIKE LOWER(?)");
    expect(sql).toContain("LOWER(e.body_plain) LIKE LOWER(?)");
    expect(sql).toContain("LOWER(e.recipients) LIKE LOWER(?)");
    expect(sql).toContain("LOWER(e.cc) LIKE LOWER(?)");
    expect(sql).toContain("LOWER(e.bcc) LIKE LOWER(?)");
  });

  it("passes the same pattern for each field plus userId and limit", () => {
    searchLocalEmailCache("user-1", "smith", 250);

    // Expected layout: [userId, p, p, p, p, p, p, limit] = 8 args total
    expect(mockAll).toHaveBeenCalledWith(
      "user-1",
      "%smith%",
      "%smith%",
      "%smith%",
      "%smith%",
      "%smith%",
      "%smith%",
      250
    );
  });
});
