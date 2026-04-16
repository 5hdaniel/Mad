/**
 * Tests for clearCorruptedSession utility (BACKLOG-1632)
 */

import { clearCorruptedSession } from "../clearCorruptedSession";

// Mock localStorage
const mockStorage: Record<string, string> = {};

const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  key: jest.fn(),
  get length() {
    return Object.keys(mockStorage).length;
  },
  clear: jest.fn(),
};

beforeEach(() => {
  // Clear mock storage
  for (const key of Object.keys(mockStorage)) {
    delete mockStorage[key];
  }
  jest.clearAllMocks();
  // Restore default mock implementations after clearAllMocks
  mockLocalStorage.getItem.mockImplementation(
    (key: string) => mockStorage[key] ?? null
  );
  mockLocalStorage.key.mockImplementation(
    (index: number) => Object.keys(mockStorage)[index] ?? null
  );
  mockLocalStorage.removeItem.mockImplementation((key: string) => {
    delete mockStorage[key];
  });
  mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
    mockStorage[key] = value;
  });
  Object.defineProperty(window, "localStorage", {
    value: mockLocalStorage,
    writable: true,
  });
});

describe("clearCorruptedSession", () => {
  it("should return empty array when no supabase keys exist", () => {
    mockStorage["unrelated-key"] = "some value";
    const result = clearCorruptedSession();
    expect(result).toEqual([]);
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
  });

  it("should not remove valid supabase session data", () => {
    mockStorage["sb-xyz-auth-token"] = JSON.stringify({
      access_token: "abc",
      refresh_token: "def",
    });
    mockStorage["supabase.auth.token"] = JSON.stringify({
      currentSession: { user: { id: "123" } },
    });

    const result = clearCorruptedSession();
    expect(result).toEqual([]);
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    // Data should still be present
    expect(mockStorage["sb-xyz-auth-token"]).toBeDefined();
    expect(mockStorage["supabase.auth.token"]).toBeDefined();
  });

  it("should remove corrupted supabase entries and return their keys", () => {
    mockStorage["sb-xyz-auth-token"] = "invalid{json\\x00\\xff";
    mockStorage["supabase.auth.token"] = "also corrupted \xff\xfe";
    mockStorage["unrelated-key"] = "not touched";

    // Mock getItem to throw for corrupted values when JSON.parse is called
    mockLocalStorage.getItem.mockImplementation((key: string) => mockStorage[key] ?? null);

    const result = clearCorruptedSession();
    expect(result).toContain("sb-xyz-auth-token");
    expect(result).toContain("supabase.auth.token");
    expect(result).toHaveLength(2);
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("sb-xyz-auth-token");
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("supabase.auth.token");
    // Unrelated key should not be touched
    expect(mockStorage["unrelated-key"]).toBe("not touched");
  });

  it("should only remove entries with supabase/sb- prefix", () => {
    mockStorage["sb-auth"] = "not json";
    mockStorage["supabase-session"] = "not json";
    mockStorage["other-key"] = "not json";

    const result = clearCorruptedSession();
    // "other-key" should not be in the results even though it's also invalid JSON
    expect(result).toContain("sb-auth");
    expect(result).toContain("supabase-session");
    expect(result).not.toContain("other-key");
  });

  it("should handle empty localStorage gracefully", () => {
    const result = clearCorruptedSession();
    expect(result).toEqual([]);
  });

  it("should handle null values without removing the key", () => {
    // Add a supabase key that returns null from getItem
    mockStorage["sb-null-value"] = "";
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === "sb-null-value") return null;
      return mockStorage[key] ?? null;
    });

    const result = clearCorruptedSession();
    expect(result).toEqual([]);
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
  });

  it("should log a warning when corrupted entries are cleared", () => {
    // console.warn is globally mocked in tests/setup.js
    (console.warn as jest.Mock).mockClear();
    mockStorage["sb-corrupted"] = "{invalid";

    clearCorruptedSession();

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("[BACKLOG-1632]")
    );
  });

  it("should not log when no entries are corrupted", () => {
    (console.warn as jest.Mock).mockClear();
    mockStorage["sb-valid"] = JSON.stringify({ valid: true });

    clearCorruptedSession();

    expect(console.warn).not.toHaveBeenCalled();
  });
});
