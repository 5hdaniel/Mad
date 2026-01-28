/**
 * usePhoneTypeApi Tests
 *
 * TASK-1600: Tests for phone type selection with Supabase cloud storage.
 *
 * Test coverage:
 * - savePhoneType saves to Supabase first (cloud-first pattern)
 * - savePhoneType saves to local DB when initialized (offline support)
 * - savePhoneType dispatches ONBOARDING_STEP_COMPLETE
 * - Graceful degradation when Supabase fails
 * - Works when local DB is not initialized
 */

import { renderHook, act } from "@testing-library/react";
import { usePhoneTypeApi } from "../usePhoneTypeApi";

// ============================================
// MOCK SETUP
// ============================================

// Mock functions for window.api.user methods
const mockSetPhoneType = jest.fn();
const mockSetPhoneTypeCloud = jest.fn();
const mockGetPhoneType = jest.fn();
const mockGetPhoneTypeCloud = jest.fn();

// Mock state machine hook
const mockDispatch = jest.fn();
const mockMachineState = jest.fn();

// Default state machine state (onboarding with user and DB initialized)
const createMockState = (overrides: Record<string, unknown> = {}) => ({
  status: "onboarding",
  phase: "phone-type",
  user: {
    id: "user-123",
    email: "test@example.com",
  },
  platform: {
    isWindows: false,
    isMac: true,
    hasIPhone: false,
  },
  onboarding: {
    completedSteps: [],
  },
  database: {
    initialized: true,
  },
  ...overrides,
});

// Mock the machine module
jest.mock("../../machine", () => ({
  useOptionalMachineState: () => mockMachineState(),
  selectHasSelectedPhoneType: (state: Record<string, unknown>) => {
    const onboarding = state.onboarding as {
      completedSteps: string[];
      phoneType?: string;
    };
    return (
      onboarding.completedSteps.includes("phone-type") ||
      !!onboarding.phoneType
    );
  },
  selectPhoneType: (state: Record<string, unknown>) => {
    const onboarding = state.onboarding as { phoneType?: string };
    return onboarding.phoneType || null;
  },
  selectIsDatabaseInitialized: (state: Record<string, unknown>) => {
    const database = state.database as { initialized: boolean };
    return database.initialized;
  },
}));

// Setup window.api mock before tests
beforeAll(() => {
  Object.defineProperty(window, "api", {
    value: {
      user: {
        setPhoneType: mockSetPhoneType,
        setPhoneTypeCloud: mockSetPhoneTypeCloud,
        getPhoneType: mockGetPhoneType,
        getPhoneTypeCloud: mockGetPhoneTypeCloud,
      },
    },
    writable: true,
    configurable: true,
  });
});

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();

  // Default machine state
  mockMachineState.mockReturnValue({
    state: createMockState(),
    dispatch: mockDispatch,
  });

  // Default successful API responses
  mockSetPhoneTypeCloud.mockResolvedValue({ success: true });
  mockSetPhoneType.mockResolvedValue({ success: true });
});

// ============================================
// TESTS
// ============================================

describe("usePhoneTypeApi", () => {
  describe("savePhoneType", () => {
    it("should save to Supabase first, then local DB", async () => {
      const { result } = renderHook(() =>
        usePhoneTypeApi({ userId: "user-123", isWindows: false })
      );

      await act(async () => {
        const success = await result.current.savePhoneType("iphone");
        expect(success).toBe(true);
      });

      // Should call Supabase first
      expect(mockSetPhoneTypeCloud).toHaveBeenCalledWith("user-123", "iphone");
      expect(mockSetPhoneTypeCloud).toHaveBeenCalledTimes(1);

      // Should call local DB second (DB is initialized in default state)
      expect(mockSetPhoneType).toHaveBeenCalledWith("user-123", "iphone");
      expect(mockSetPhoneType).toHaveBeenCalledTimes(1);

      // Supabase should be called before local DB
      expect(mockSetPhoneTypeCloud.mock.invocationCallOrder[0]).toBeLessThan(
        mockSetPhoneType.mock.invocationCallOrder[0]
      );

      // Should dispatch step completion
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "ONBOARDING_STEP_COMPLETE",
        step: "phone-type",
        phoneType: "iphone",
      });
    });

    it("should save android phone type correctly", async () => {
      const { result } = renderHook(() =>
        usePhoneTypeApi({ userId: "user-123", isWindows: false })
      );

      await act(async () => {
        const success = await result.current.savePhoneType("android");
        expect(success).toBe(true);
      });

      expect(mockSetPhoneTypeCloud).toHaveBeenCalledWith("user-123", "android");
      expect(mockSetPhoneType).toHaveBeenCalledWith("user-123", "android");
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "ONBOARDING_STEP_COMPLETE",
        step: "phone-type",
        phoneType: "android",
      });
    });

    it("should continue even if Supabase save fails (graceful degradation)", async () => {
      // Simulate Supabase failure
      mockSetPhoneTypeCloud.mockResolvedValue({
        success: false,
        error: "Network error",
      });

      const consoleSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const { result } = renderHook(() =>
        usePhoneTypeApi({ userId: "user-123", isWindows: false })
      );

      await act(async () => {
        const success = await result.current.savePhoneType("iphone");
        // Should still succeed - graceful degradation
        expect(success).toBe(true);
      });

      // Supabase was attempted
      expect(mockSetPhoneTypeCloud).toHaveBeenCalledTimes(1);

      // Local DB was still called
      expect(mockSetPhoneType).toHaveBeenCalledTimes(1);

      // Warning was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to save to Supabase"),
        expect.any(String)
      );

      // Step completion was still dispatched
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "ONBOARDING_STEP_COMPLETE",
        step: "phone-type",
        phoneType: "iphone",
      });

      consoleSpy.mockRestore();
    });

    it("should skip local DB save when DB not initialized", async () => {
      // Set DB as not initialized
      mockMachineState.mockReturnValue({
        state: createMockState({
          database: { initialized: false },
        }),
        dispatch: mockDispatch,
      });

      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      const { result } = renderHook(() =>
        usePhoneTypeApi({ userId: "user-123", isWindows: false })
      );

      await act(async () => {
        const success = await result.current.savePhoneType("iphone");
        expect(success).toBe(true);
      });

      // Supabase should be called (always available after auth)
      expect(mockSetPhoneTypeCloud).toHaveBeenCalledWith("user-123", "iphone");
      expect(mockSetPhoneTypeCloud).toHaveBeenCalledTimes(1);

      // Local DB should NOT be called (not initialized)
      expect(mockSetPhoneType).not.toHaveBeenCalled();

      // Info log about DB not initialized
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Local DB not initialized")
      );

      // Step completion should still be dispatched
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "ONBOARDING_STEP_COMPLETE",
        step: "phone-type",
        phoneType: "iphone",
      });

      consoleSpy.mockRestore();
    });

    it("should return false if user ID is not available", async () => {
      // Set state without user
      mockMachineState.mockReturnValue({
        state: createMockState({
          status: "loading",
          user: null,
        }),
        dispatch: mockDispatch,
      });

      const { result } = renderHook(() =>
        usePhoneTypeApi({ userId: undefined, isWindows: false })
      );

      await act(async () => {
        const success = await result.current.savePhoneType("iphone");
        expect(success).toBe(false);
      });

      // No API calls should be made
      expect(mockSetPhoneTypeCloud).not.toHaveBeenCalled();
      expect(mockSetPhoneType).not.toHaveBeenCalled();
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it("should handle local DB save failure gracefully", async () => {
      // Supabase succeeds, local DB fails
      mockSetPhoneType.mockResolvedValue({
        success: false,
        error: "Database write error",
      });

      const consoleSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const { result } = renderHook(() =>
        usePhoneTypeApi({ userId: "user-123", isWindows: false })
      );

      await act(async () => {
        const success = await result.current.savePhoneType("iphone");
        // Should still succeed - Supabase is primary
        expect(success).toBe(true);
      });

      // Warning was logged for local DB failure
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to save to local DB"),
        expect.any(String)
      );

      // Step completion was still dispatched
      expect(mockDispatch).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle local DB exception gracefully", async () => {
      // Local DB throws an exception
      mockSetPhoneType.mockRejectedValue(new Error("DB connection lost"));

      const consoleSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const { result } = renderHook(() =>
        usePhoneTypeApi({ userId: "user-123", isWindows: false })
      );

      await act(async () => {
        const success = await result.current.savePhoneType("iphone");
        // Should still succeed - Supabase is primary
        expect(success).toBe(true);
      });

      // Warning was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error saving to local DB"),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should return false if Supabase throws an exception", async () => {
      // Supabase throws an exception (not just returns error)
      mockSetPhoneTypeCloud.mockRejectedValue(new Error("Network timeout"));

      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() =>
        usePhoneTypeApi({ userId: "user-123", isWindows: false })
      );

      await act(async () => {
        const success = await result.current.savePhoneType("iphone");
        expect(success).toBe(false);
      });

      // Error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error saving phone type"),
        expect.any(Error)
      );

      // No dispatch should happen on failure
      expect(mockDispatch).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("derived state", () => {
    it("should throw error if state machine is not available", () => {
      mockMachineState.mockReturnValue(null);

      expect(() =>
        renderHook(() =>
          usePhoneTypeApi({ userId: "user-123", isWindows: false })
        )
      ).toThrow("usePhoneTypeApi requires state machine to be enabled");
    });

    it("should derive hasSelectedPhoneType from state machine", () => {
      mockMachineState.mockReturnValue({
        state: createMockState({
          onboarding: {
            completedSteps: ["phone-type"],
            phoneType: "iphone",
          },
        }),
        dispatch: mockDispatch,
      });

      const { result } = renderHook(() =>
        usePhoneTypeApi({ userId: "user-123", isWindows: false })
      );

      expect(result.current.hasSelectedPhoneType).toBe(true);
    });

    it("should derive selectedPhoneType from state machine", () => {
      mockMachineState.mockReturnValue({
        state: createMockState({
          onboarding: {
            completedSteps: ["phone-type"],
            phoneType: "android",
          },
        }),
        dispatch: mockDispatch,
      });

      const { result } = renderHook(() =>
        usePhoneTypeApi({ userId: "user-123", isWindows: false })
      );

      expect(result.current.selectedPhoneType).toBe("android");
    });

    it("should derive needsDriverSetup for Windows + iPhone", () => {
      mockMachineState.mockReturnValue({
        state: createMockState({
          status: "onboarding",
          platform: {
            isWindows: true,
            isMac: false,
            hasIPhone: true,
          },
        }),
        dispatch: mockDispatch,
      });

      const { result } = renderHook(() =>
        usePhoneTypeApi({ userId: "user-123", isWindows: true })
      );

      expect(result.current.needsDriverSetup).toBe(true);
    });

    it("should show isLoadingPhoneType during loading phases", () => {
      mockMachineState.mockReturnValue({
        state: createMockState({
          status: "loading",
          phase: "loading-user-data",
        }),
        dispatch: mockDispatch,
      });

      const { result } = renderHook(() =>
        usePhoneTypeApi({ userId: "user-123", isWindows: false })
      );

      expect(result.current.isLoadingPhoneType).toBe(true);
    });
  });

  describe("no-op setters", () => {
    it("setHasSelectedPhoneType should be a no-op", () => {
      const { result } = renderHook(() =>
        usePhoneTypeApi({ userId: "user-123", isWindows: false })
      );

      // Should not throw
      result.current.setHasSelectedPhoneType(true);
      result.current.setHasSelectedPhoneType(false);

      // No dispatch should happen
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it("setSelectedPhoneType should be a no-op", () => {
      const { result } = renderHook(() =>
        usePhoneTypeApi({ userId: "user-123", isWindows: false })
      );

      // Should not throw
      result.current.setSelectedPhoneType("iphone");
      result.current.setSelectedPhoneType("android");

      // No dispatch should happen
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it("setNeedsDriverSetup should be a no-op", () => {
      const { result } = renderHook(() =>
        usePhoneTypeApi({ userId: "user-123", isWindows: false })
      );

      // Should not throw
      result.current.setNeedsDriverSetup(true);
      result.current.setNeedsDriverSetup(false);

      // No dispatch should happen
      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });
});
