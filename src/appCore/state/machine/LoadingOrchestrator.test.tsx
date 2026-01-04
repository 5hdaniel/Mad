/**
 * Loading Orchestrator Tests
 *
 * Tests for the LoadingOrchestrator component that coordinates
 * the app initialization sequence.
 *
 * @module appCore/state/machine/LoadingOrchestrator.test
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { LoadingOrchestrator } from "./LoadingOrchestrator";
import { AppStateProvider } from "./AppStateContext";
import { useAppState } from "./useAppState";
import type { LoadingState, AppState } from "./types";

// ============================================
// MOCK SETUP
// ============================================

const mockApi = {
  auth: {
    getCurrentUser: jest.fn(),
  },
  system: {
    hasEncryptionKeyStore: jest.fn(),
    initializeSecureStorage: jest.fn(),
  },
};

// Setup global window.api mock
beforeAll(() => {
  (window as unknown as { api: typeof mockApi }).api = mockApi;
});

afterAll(() => {
  delete (window as unknown as { api?: typeof mockApi }).api;
});

beforeEach(() => {
  jest.clearAllMocks();
  // Reset platform mock
  Object.defineProperty(window.navigator, "platform", {
    value: "MacIntel",
    configurable: true,
  });
});

// ============================================
// TEST FIXTURES
// ============================================

const initialLoadingState: LoadingState = {
  status: "loading",
  phase: "checking-storage",
};

// ============================================
// HELPER COMPONENTS
// ============================================

/**
 * Test component to display current state.
 */
function StateDisplay() {
  const { state } = useAppState();
  return (
    <div>
      <div data-testid="status">{state.status}</div>
      {state.status === "loading" && (
        <div data-testid="phase">{state.phase}</div>
      )}
      {state.status === "error" && (
        <>
          <div data-testid="error-code">{state.error.code}</div>
          <div data-testid="error-message">{state.error.message}</div>
        </>
      )}
    </div>
  );
}

/**
 * Wrapper for testing with provider.
 */
function TestWrapper({
  children,
  initialState,
}: {
  children: React.ReactNode;
  initialState?: AppState;
}) {
  return (
    <AppStateProvider initialState={initialState}>
      <LoadingOrchestrator>{children}</LoadingOrchestrator>
    </AppStateProvider>
  );
}

// ============================================
// LOADING SCREEN TESTS
// ============================================

describe("LoadingOrchestrator", () => {
  describe("rendering", () => {
    it("shows loading screen during loading state", async () => {
      mockApi.system.hasEncryptionKeyStore.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <TestWrapper initialState={initialLoadingState}>
          <div data-testid="children">App Content</div>
        </TestWrapper>
      );

      // Should show loading message
      expect(
        screen.getByText("Checking secure storage...")
      ).toBeInTheDocument();
      // Children should not be visible
      expect(screen.queryByTestId("children")).not.toBeInTheDocument();
    });

    it("shows children when not in loading state", () => {
      const readyState: AppState = {
        status: "ready",
        user: { id: "1", email: "test@test.com" },
        platform: { isMacOS: true, isWindows: false, hasIPhone: false },
        userData: {
          phoneType: "iphone",
          hasCompletedEmailOnboarding: true,
          hasEmailConnected: true,
          needsDriverSetup: false,
          hasPermissions: true,
        },
      };

      render(
        <TestWrapper initialState={readyState}>
          <div data-testid="children">App Content</div>
        </TestWrapper>
      );

      expect(screen.getByTestId("children")).toBeInTheDocument();
    });
  });

  describe("phase 1: storage check", () => {
    it("dispatches STORAGE_CHECKED on success", async () => {
      mockApi.system.hasEncryptionKeyStore.mockResolvedValue({
        success: true,
        hasKeyStore: true,
      });
      // Don't resolve next phase - we just want to check storage phase
      mockApi.system.initializeSecureStorage.mockImplementation(
        () => new Promise(() => {})
      );

      render(
        <TestWrapper initialState={initialLoadingState}>
          <StateDisplay />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("phase")).toHaveTextContent("initializing-db");
      });
    });

    it("dispatches ERROR on storage check failure", async () => {
      mockApi.system.hasEncryptionKeyStore.mockRejectedValue(
        new Error("Storage check failed")
      );

      render(
        <TestWrapper initialState={initialLoadingState}>
          <StateDisplay />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("status")).toHaveTextContent("error");
        expect(screen.getByTestId("error-code")).toHaveTextContent(
          "STORAGE_CHECK_FAILED"
        );
      });
    });
  });

  describe("phase 2: database initialization", () => {
    it("dispatches DB_INIT_COMPLETE on success", async () => {
      mockApi.system.hasEncryptionKeyStore.mockResolvedValue({
        success: true,
        hasKeyStore: true,
      });
      mockApi.system.initializeSecureStorage.mockResolvedValue({
        success: true,
        available: true,
      });
      // Don't resolve next phase
      mockApi.auth.getCurrentUser.mockImplementation(
        () => new Promise(() => {})
      );

      render(
        <TestWrapper initialState={initialLoadingState}>
          <StateDisplay />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("phase")).toHaveTextContent("loading-auth");
      });
    });

    it("dispatches DB_INIT_COMPLETE with error on failure", async () => {
      mockApi.system.hasEncryptionKeyStore.mockResolvedValue({
        success: true,
        hasKeyStore: true,
      });
      mockApi.system.initializeSecureStorage.mockResolvedValue({
        success: false,
        error: "Database initialization failed",
      });

      render(
        <TestWrapper initialState={initialLoadingState}>
          <StateDisplay />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("status")).toHaveTextContent("error");
        expect(screen.getByTestId("error-code")).toHaveTextContent(
          "DB_INIT_FAILED"
        );
      });
    });
  });

  describe("phase 3: auth loading", () => {
    it("transitions to unauthenticated when no user", async () => {
      mockApi.system.hasEncryptionKeyStore.mockResolvedValue({
        success: true,
        hasKeyStore: true,
      });
      mockApi.system.initializeSecureStorage.mockResolvedValue({
        success: true,
        available: true,
      });
      mockApi.auth.getCurrentUser.mockResolvedValue({
        success: false,
      });

      render(
        <TestWrapper initialState={initialLoadingState}>
          <StateDisplay />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
      });
    });

    it("transitions to loading-user-data for returning user", async () => {
      mockApi.system.hasEncryptionKeyStore.mockResolvedValue({
        success: true,
        hasKeyStore: true,
      });
      mockApi.system.initializeSecureStorage.mockResolvedValue({
        success: true,
        available: true,
      });
      mockApi.auth.getCurrentUser.mockResolvedValue({
        success: true,
        user: { id: "user-1", email: "test@test.com" },
        isNewUser: false,
      });

      render(
        <TestWrapper initialState={initialLoadingState}>
          <StateDisplay />
        </TestWrapper>
      );

      // Should transition through loading-user-data and then to onboarding
      // (since userData is placeholder with incomplete onboarding)
      await waitFor(() => {
        // After user data loads, state will be onboarding (placeholder data = incomplete onboarding)
        expect(screen.getByTestId("status")).toHaveTextContent("onboarding");
      });
    });

    it("transitions to onboarding for new user", async () => {
      mockApi.system.hasEncryptionKeyStore.mockResolvedValue({
        success: true,
        hasKeyStore: true,
      });
      mockApi.system.initializeSecureStorage.mockResolvedValue({
        success: true,
        available: true,
      });
      mockApi.auth.getCurrentUser.mockResolvedValue({
        success: true,
        user: { id: "user-1", email: "test@test.com" },
        isNewUser: true,
      });

      render(
        <TestWrapper initialState={initialLoadingState}>
          <StateDisplay />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("status")).toHaveTextContent("onboarding");
      });
    });
  });

  describe("error handling", () => {
    it("shows error screen for non-recoverable errors", () => {
      const errorState: AppState = {
        status: "error",
        error: {
          code: "DB_INIT_FAILED",
          message: "Critical failure",
        },
        recoverable: false,
      };

      render(
        <TestWrapper initialState={errorState}>
          <div data-testid="children">App Content</div>
        </TestWrapper>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText("Critical failure")).toBeInTheDocument();
      expect(screen.queryByTestId("children")).not.toBeInTheDocument();
    });

    it("shows children for recoverable errors", () => {
      const errorState: AppState = {
        status: "error",
        error: {
          code: "NETWORK_ERROR",
          message: "Connection lost",
        },
        recoverable: true,
      };

      render(
        <TestWrapper initialState={errorState}>
          <div data-testid="children">App Content</div>
        </TestWrapper>
      );

      expect(screen.getByTestId("children")).toBeInTheDocument();
      expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    });
  });

  describe("platform detection", () => {
    it("detects macOS platform", async () => {
      Object.defineProperty(window.navigator, "platform", {
        value: "MacIntel",
        configurable: true,
      });

      mockApi.system.hasEncryptionKeyStore.mockResolvedValue({
        success: true,
        hasKeyStore: true,
      });
      mockApi.system.initializeSecureStorage.mockResolvedValue({
        success: true,
        available: true,
      });
      mockApi.auth.getCurrentUser.mockResolvedValue({
        success: true,
        user: { id: "user-1", email: "test@test.com" },
        isNewUser: true,
      });

      render(
        <TestWrapper initialState={initialLoadingState}>
          <StateDisplay />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("status")).toHaveTextContent("onboarding");
      });
    });

    it("detects Windows platform", async () => {
      Object.defineProperty(window.navigator, "platform", {
        value: "Win32",
        configurable: true,
      });

      mockApi.system.hasEncryptionKeyStore.mockResolvedValue({
        success: true,
        hasKeyStore: true,
      });
      mockApi.system.initializeSecureStorage.mockResolvedValue({
        success: true,
        available: true,
      });
      mockApi.auth.getCurrentUser.mockResolvedValue({
        success: true,
        user: { id: "user-1", email: "test@test.com" },
        isNewUser: true,
      });

      render(
        <TestWrapper initialState={initialLoadingState}>
          <StateDisplay />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("status")).toHaveTextContent("onboarding");
      });
    });
  });

  describe("effect cleanup", () => {
    it("does not dispatch after unmount", async () => {
      let resolveStorageCheck: (value: unknown) => void;
      mockApi.system.hasEncryptionKeyStore.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveStorageCheck = resolve;
          })
      );

      const { unmount } = render(
        <TestWrapper initialState={initialLoadingState}>
          <StateDisplay />
        </TestWrapper>
      );

      // Unmount before promise resolves
      unmount();

      // Resolve the promise after unmount
      await act(async () => {
        resolveStorageCheck!({ success: true, hasKeyStore: true });
      });

      // No error should be thrown (cleanup should prevent dispatch)
    });
  });
});

// ============================================
// LOADING SCREEN COMPONENT TESTS
// ============================================

describe("LoadingScreen", () => {
  it("displays correct message for checking-storage phase", () => {
    mockApi.system.hasEncryptionKeyStore.mockImplementation(
      () => new Promise(() => {})
    );

    render(
      <TestWrapper initialState={{ status: "loading", phase: "checking-storage" }}>
        <div>Children</div>
      </TestWrapper>
    );

    expect(screen.getByText("Checking secure storage...")).toBeInTheDocument();
  });

  it("displays correct message for initializing-db phase", () => {
    render(
      <TestWrapper initialState={{ status: "loading", phase: "initializing-db" }}>
        <div>Children</div>
      </TestWrapper>
    );

    expect(
      screen.getByText("Initializing secure database...")
    ).toBeInTheDocument();
  });

  it("displays correct message for loading-auth phase", () => {
    render(
      <TestWrapper initialState={{ status: "loading", phase: "loading-auth" }}>
        <div>Children</div>
      </TestWrapper>
    );

    expect(screen.getByText("Loading authentication...")).toBeInTheDocument();
  });

  it("displays correct message for loading-user-data phase", () => {
    render(
      <TestWrapper initialState={{ status: "loading", phase: "loading-user-data" }}>
        <div>Children</div>
      </TestWrapper>
    );

    expect(screen.getByText("Loading your data...")).toBeInTheDocument();
  });

  it("has accessible loading indicator", () => {
    mockApi.system.hasEncryptionKeyStore.mockImplementation(
      () => new Promise(() => {})
    );

    render(
      <TestWrapper initialState={initialLoadingState}>
        <div>Children</div>
      </TestWrapper>
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

// ============================================
// ERROR SCREEN COMPONENT TESTS
// ============================================

describe("ErrorScreen", () => {
  it("displays error message and code", () => {
    const errorState: AppState = {
      status: "error",
      error: {
        code: "DB_INIT_FAILED",
        message: "Database initialization failed",
      },
      recoverable: false,
    };

    render(
      <TestWrapper initialState={errorState}>
        <div>Children</div>
      </TestWrapper>
    );

    expect(
      screen.getByText("Database initialization failed")
    ).toBeInTheDocument();
    expect(screen.getByText("Error code: DB_INIT_FAILED")).toBeInTheDocument();
  });

  it("shows retry button for non-recoverable errors", () => {
    const errorState: AppState = {
      status: "error",
      error: {
        code: "DB_INIT_FAILED",
        message: "Failed",
      },
      recoverable: false,
    };

    render(
      <TestWrapper initialState={errorState}>
        <div>Children</div>
      </TestWrapper>
    );

    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
  });
});
