/**
 * Unit tests for useIPhoneSync hook
 * Tests iPhone device detection, sync functionality, and error handling
 */

import { renderHook } from "@testing-library/react";
import { useIPhoneSync } from "../useIPhoneSync";

describe("useIPhoneSync", () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    // Setup console spies
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

    // Setup basic window.api mock
    (window as any).api = {
      device: {
        startDetection: jest.fn(),
        stopDetection: jest.fn(),
        onConnected: jest.fn(() => jest.fn()),
        onDisconnected: jest.fn(() => jest.fn()),
      },
      backup: {
        start: jest.fn(),
        startWithPassword: jest.fn(),
        cancel: jest.fn(),
        onProgress: jest.fn(() => jest.fn()),
        onError: jest.fn(() => jest.fn()),
      },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe("initialization", () => {
    it("should start with default state", () => {
      const { result } = renderHook(() => useIPhoneSync());

      expect(result.current.isConnected).toBe(false);
      expect(result.current.device).toBeNull();
      expect(result.current.syncStatus).toBe("idle");
      expect(result.current.progress).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.needsPassword).toBe(false);
    });

    it("should provide all required hook methods", () => {
      const { result } = renderHook(() => useIPhoneSync());

      expect(typeof result.current.startSync).toBe("function");
      expect(typeof result.current.submitPassword).toBe("function");
      expect(typeof result.current.cancelSync).toBe("function");
    });

    it("should start device detection on mount", () => {
      renderHook(() => useIPhoneSync());

      expect(window.api.device.startDetection as jest.Mock).toHaveBeenCalled();
    });

    it("should stop detection on unmount", () => {
      const { unmount } = renderHook(() => useIPhoneSync());

      unmount();

      expect(window.api.device.stopDetection as jest.Mock).toHaveBeenCalled();
    });
  });

  describe("API unavailable scenarios", () => {
    it("should handle missing device API gracefully", () => {
      (window as any).api = {};

      const { result } = renderHook(() => useIPhoneSync());

      expect(result.current.isConnected).toBe(false);
      expect(result.current.device).toBeNull();
    });

    it("should handle missing backup API gracefully", () => {
      (window as any).api = {
        device: {
          startDetection: jest.fn(),
          stopDetection: jest.fn(),
          onConnected: jest.fn(() => jest.fn()),
          onDisconnected: jest.fn(() => jest.fn()),
        },
      };

      const { result } = renderHook(() => useIPhoneSync());

      expect(result.current).toBeDefined();
      expect(typeof result.current.startSync).toBe("function");
    });

    it("should handle completely missing window.api", () => {
      delete (window as any).api;

      const { result } = renderHook(() => useIPhoneSync());

      expect(result.current.isConnected).toBe(false);
      expect(result.current.device).toBeNull();
    });
  });

  describe("error logging", () => {
    it("should log error when starting sync without device", async () => {
      const { result } = renderHook(() => useIPhoneSync());

      await result.current.startSync();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[useIPhoneSync] Cannot start sync: No device connected",
      );
    });

    it("should log error when submitting password without device", async () => {
      const { result } = renderHook(() => useIPhoneSync());

      await result.current.submitPassword("test-password");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[useIPhoneSync] Cannot submit password: No device connected",
      );
    });
  });
});
