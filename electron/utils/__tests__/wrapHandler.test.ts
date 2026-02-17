/**
 * Tests for wrapHandler() higher-order function.
 *
 * Verifies that the wrapper produces identical error response shapes
 * to the existing handler pattern:
 *   - ValidationError -> { success: false, error: "Validation error: message" }
 *   - Error -> { success: false, error: "error.message" }
 *   - Non-Error throw -> { success: false, error: "Unknown error" }
 */

import { wrapHandler } from "../wrapHandler";
import { ValidationError } from "../validation";
import logService from "../../services/logService";
import type { IpcMainInvokeEvent } from "electron";

// Mock logService
jest.mock("../../services/logService", () => ({
  __esModule: true,
  default: {
    error: jest.fn().mockResolvedValue(undefined),
    warn: jest.fn().mockResolvedValue(undefined),
    info: jest.fn().mockResolvedValue(undefined),
    debug: jest.fn().mockResolvedValue(undefined),
  },
}));

// Minimal mock for IpcMainInvokeEvent
const mockEvent = {} as IpcMainInvokeEvent;

describe("wrapHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes through successful handler response unchanged", async () => {
    const successResponse = { success: true, data: { id: "123", name: "Test" } };
    const handler = jest.fn().mockResolvedValue(successResponse);

    const wrapped = wrapHandler(handler);
    const result = await wrapped(mockEvent, "arg1", "arg2");

    expect(result).toEqual(successResponse);
    expect(handler).toHaveBeenCalledWith(mockEvent, "arg1", "arg2");
  });

  it("catches ValidationError and returns { success: false, error: 'Validation error: message' }", async () => {
    const handler = jest.fn().mockRejectedValue(
      new ValidationError("User ID is required", "userId"),
    );

    const wrapped = wrapHandler(handler);
    const result = await wrapped(mockEvent);

    expect(result).toEqual({
      success: false,
      error: "Validation error: User ID is required",
    });
  });

  it("catches Error and returns { success: false, error: message }", async () => {
    const handler = jest.fn().mockRejectedValue(
      new Error("Database connection failed"),
    );

    const wrapped = wrapHandler(handler);
    const result = await wrapped(mockEvent);

    expect(result).toEqual({
      success: false,
      error: "Database connection failed",
    });
  });

  it("catches non-Error throw and returns { success: false, error: 'Unknown error' }", async () => {
    const handler = jest.fn().mockRejectedValue("string error");

    const wrapped = wrapHandler(handler);
    const result = await wrapped(mockEvent);

    expect(result).toEqual({
      success: false,
      error: "Unknown error",
    });
  });

  it("catches non-Error throw (number) and returns { success: false, error: 'Unknown error' }", async () => {
    const handler = jest.fn().mockRejectedValue(42);

    const wrapped = wrapHandler(handler);
    const result = await wrapped(mockEvent);

    expect(result).toEqual({
      success: false,
      error: "Unknown error",
    });
  });

  it("logs errors via logService.error for Error instances", async () => {
    const handler = jest.fn().mockRejectedValue(
      new Error("Something broke"),
    );

    const wrapped = wrapHandler(handler);
    await wrapped(mockEvent);

    expect(logService.error).toHaveBeenCalledWith(
      "Handler error: Something broke",
      "IPC",
      { error: expect.any(Error) },
    );
  });

  it("does not log ValidationError via logService.error", async () => {
    const handler = jest.fn().mockRejectedValue(
      new ValidationError("Invalid input"),
    );

    const wrapped = wrapHandler(handler);
    await wrapped(mockEvent);

    expect(logService.error).not.toHaveBeenCalled();
  });

  it("uses custom module name when provided", async () => {
    const handler = jest.fn().mockRejectedValue(
      new Error("Sync failed"),
    );

    const wrapped = wrapHandler(handler, { module: "EmailSync" });
    await wrapped(mockEvent);

    expect(logService.error).toHaveBeenCalledWith(
      "Handler error: Sync failed",
      "EmailSync",
      { error: expect.any(Error) },
    );
  });

  it("uses default module name 'IPC' when no module provided", async () => {
    const handler = jest.fn().mockRejectedValue(
      new Error("Failed"),
    );

    const wrapped = wrapHandler(handler);
    await wrapped(mockEvent);

    expect(logService.error).toHaveBeenCalledWith(
      "Handler error: Failed",
      "IPC",
      { error: expect.any(Error) },
    );
  });

  it("preserves handler arguments", async () => {
    const handler = jest.fn().mockResolvedValue({ success: true });

    const wrapped = wrapHandler(handler);
    await wrapped(mockEvent, "userId-123", "transactionId-456", { page: 1 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      mockEvent,
      "userId-123",
      "transactionId-456",
      { page: 1 },
    );
  });

  it("handles handler that returns non-object value", async () => {
    const handler = jest.fn().mockResolvedValue("raw string response");

    const wrapped = wrapHandler(handler);
    const result = await wrapped(mockEvent);

    expect(result).toBe("raw string response");
  });

  it("handles handler that returns undefined", async () => {
    const handler = jest.fn().mockResolvedValue(undefined);

    const wrapped = wrapHandler(handler);
    const result = await wrapped(mockEvent);

    expect(result).toBeUndefined();
  });

  it("logs non-Error throws via logService.error with 'Unknown error' message", async () => {
    const handler = jest.fn().mockRejectedValue(null);

    const wrapped = wrapHandler(handler);
    await wrapped(mockEvent);

    expect(logService.error).toHaveBeenCalledWith(
      "Handler error: Unknown error",
      "IPC",
      { error: null },
    );
  });
});
