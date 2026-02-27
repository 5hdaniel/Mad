/**
 * Loading Orchestrator Tests
 *
 * Tests for the LoadingOrchestrator component that coordinates
 * the app initialization sequence.
 *
 * @module appCore/state/machine/LoadingOrchestrator.test
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { LoadingOrchestrator } from "./LoadingOrchestrator";
import { LoadingScreen } from "./components/LoadingScreen";
import { AppStateProvider } from "./AppStateContext";

import { AuthProvider } from "../../../contexts/AuthContext";
import type { AppState } from "./types";

// ============================================
// MOCK SETUP
// ============================================

jest.mock("../../../contexts/NetworkContext", () => ({
  useNetwork: () => ({
    isOnline: true,
    isChecking: false,
    lastOnlineAt: null,
    lastOfflineAt: null,
    connectionError: null,
    checkConnection: jest.fn(),
    clearError: jest.fn(),
    setConnectionError: jest.fn(),
  }),
}));

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
  // Default to never-resolving promises to prevent unintended transitions
  mockApi.system.hasEncryptionKeyStore.mockReturnValue(new Promise(() => {}));
  mockApi.system.initializeSecureStorage.mockReturnValue(new Promise(() => {}));
  mockApi.auth.getCurrentUser.mockReturnValue(new Promise(() => {}));
});

// ============================================
// HELPER COMPONENTS
// ============================================

/**
 * Wrapper for testing with provider.
 * SPRINT-066: Added AuthProvider wrapper since LoadingOrchestrator uses useAuth
 */
function TestWrapper({
  children,
  initialState,
}: {
  children: React.ReactNode;
  initialState?: AppState;
}) {
  return (
    <AuthProvider>
      <AppStateProvider initialState={initialState}>
        <LoadingOrchestrator>{children}</LoadingOrchestrator>
      </AppStateProvider>
    </AuthProvider>
  );
}

// ============================================
// STATIC STATE TESTS (no async transitions)
// ============================================

describe("LoadingOrchestrator", () => {
  describe("static rendering", () => {
    it("shows children when in ready state", () => {
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

    it("shows children when in unauthenticated state", () => {
      render(
        <TestWrapper initialState={{ status: "unauthenticated" }}>
          <div data-testid="children">Login Screen</div>
        </TestWrapper>
      );

      expect(screen.getByTestId("children")).toBeInTheDocument();
    });

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
});

// ============================================
// LOADING SCREEN COMPONENT TESTS
// ============================================

describe("LoadingScreen phases", () => {
  it("displays correct message for checking-storage phase", () => {
    // Never resolve so we stay in this phase
    mockApi.system.hasEncryptionKeyStore.mockReturnValue(new Promise(() => {}));

    render(
      <TestWrapper>
        <div>Children</div>
      </TestWrapper>
    );

    expect(screen.getByText("Checking secure storage...")).toBeInTheDocument();
    expect(screen.queryByText("Children")).not.toBeInTheDocument();
  });

  it("displays correct message for initializing-db phase (macOS)", () => {
    // Default mock is MacIntel (set in beforeEach)
    render(
      <TestWrapper
        initialState={{ status: "loading", phase: "initializing-db" }}
      >
        <div>Children</div>
      </TestWrapper>
    );

    // macOS shows Keychain-specific message
    expect(
      screen.getByText("Waiting for Keychain access...")
    ).toBeInTheDocument();
  });

  it("displays correct message for initializing-db phase (Windows)", () => {
    Object.defineProperty(window.navigator, "platform", {
      value: "Win32",
      configurable: true,
    });

    render(
      <TestWrapper initialState={{ status: "loading", phase: "initializing-db" }}>
        <div>Children</div>
      </TestWrapper>
    );

    // Windows shows standard database message
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
    // Note: loading-user-data phase triggers the user data effect which will
    // dispatch an ERROR action because there's no auth data in ref.
    // So we just test that the loading screen initially shows the message.
    // For integration testing of this phase, see the full flow tests.
    render(
      <AppStateProvider
        initialState={{ status: "loading", phase: "loading-user-data" }}
      >
        <LoadingScreen phase="loading-user-data" />
      </AppStateProvider>
    );

    expect(screen.getByText("Loading your data...")).toBeInTheDocument();
  });

  it("has accessible loading indicator", () => {
    mockApi.system.hasEncryptionKeyStore.mockReturnValue(new Promise(() => {}));

    render(
      <TestWrapper>
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

    expect(
      screen.getByRole("button", { name: "Try Again" })
    ).toBeInTheDocument();
  });
});

// ============================================
// PHASE TRANSITION TESTS
// ============================================

describe("LoadingOrchestrator phase transitions", () => {
  it("transitions from checking-storage to initializing-db", async () => {
    mockApi.system.hasEncryptionKeyStore.mockResolvedValue({
      success: true,
      hasKeyStore: true,
    });
    // Never resolve - stay at initializing-db
    mockApi.system.initializeSecureStorage.mockReturnValue(new Promise(() => {}));

    render(
      <TestWrapper>
        <div>Children</div>
      </TestWrapper>
    );

    // First we see checking-storage message
    expect(screen.getByText("Checking secure storage...")).toBeInTheDocument();

    // After storage check completes, we should see initializing-db message
    // (macOS shows "Waiting for Keychain access..." per platform-specific logic)
    await waitFor(
      () => {
        expect(
          screen.getByText("Waiting for Keychain access...")
        ).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it("transitions to error state on storage check failure", async () => {
    mockApi.system.hasEncryptionKeyStore.mockRejectedValue(
      new Error("Storage check failed")
    );

    render(
      <TestWrapper>
        <div data-testid="children">Children</div>
      </TestWrapper>
    );

    // Storage check failure is a recoverable error, so children are shown
    // (not the error screen which is for non-recoverable errors)
    await waitFor(
      () => {
        expect(screen.getByTestId("children")).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it("transitions to error state on DB init failure", async () => {
    mockApi.system.hasEncryptionKeyStore.mockResolvedValue({
      success: true,
      hasKeyStore: true,
    });
    mockApi.system.initializeSecureStorage.mockResolvedValue({
      success: false,
      error: "Database initialization failed",
    });

    render(
      <TestWrapper>
        <div data-testid="children">Children</div>
      </TestWrapper>
    );

    // DB init failure is a recoverable error (via the reducer),
    // so children are shown (not the error screen)
    await waitFor(
      () => {
        expect(screen.getByTestId("children")).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it("transitions to unauthenticated when no user session", async () => {
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
      <TestWrapper>
        <div data-testid="children">Login Screen</div>
      </TestWrapper>
    );

    // Once unauthenticated, the children should be visible
    await waitFor(
      () => {
        expect(screen.getByTestId("children")).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
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
      <TestWrapper>
        <div data-testid="children">Onboarding Content</div>
      </TestWrapper>
    );

    // Once in onboarding, the children should be visible (not loading)
    await waitFor(
      () => {
        expect(screen.getByTestId("children")).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it("skips DB init for first-time macOS users (deferredDbInit)", async () => {
    // First-time macOS user: no keystore exists
    mockApi.system.hasEncryptionKeyStore.mockResolvedValue({
      success: true,
      hasKeyStore: false, // No keystore = first time macOS user
    });
    // initializeSecureStorage should NOT be called - that's what we're testing
    mockApi.system.initializeSecureStorage.mockImplementation(() => {
      throw new Error("initializeSecureStorage should not be called when deferredDbInit is true");
    });
    // Auth should proceed normally
    mockApi.auth.getCurrentUser.mockResolvedValue({
      success: false, // No session - goes to unauthenticated
    });

    render(
      <TestWrapper>
        <div data-testid="children">Login Screen</div>
      </TestWrapper>
    );

    // Should skip DB init and go directly to loading-auth, then unauthenticated
    // If initializeSecureStorage was called, the test would fail with an error
    await waitFor(
      () => {
        expect(screen.getByTestId("children")).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Verify initializeSecureStorage was never called
    expect(mockApi.system.initializeSecureStorage).not.toHaveBeenCalled();
  });
});

// ============================================
// PRELOAD BRIDGE RACE CONDITION TESTS (TASK-2005)
// ============================================

describe("LoadingOrchestrator preload bridge race condition", () => {
  it("does not throw when window.api is undefined at mount time", async () => {
    // Remove window.api to simulate the race condition
    const savedApi = window.api;
    delete (window as unknown as { api?: typeof mockApi }).api;

    // Should not throw - the waitForApi guard prevents the TypeError
    expect(() => {
      render(
        <TestWrapper>
          <div data-testid="children">App Content</div>
        </TestWrapper>
      );
    }).not.toThrow();

    // Restore window.api so waitForApi resolves and the component
    // can proceed (prevents act() warnings from dangling promises)
    (window as unknown as { api: typeof mockApi }).api = savedApi;

    // Wait for the component to process the restored API
    await waitFor(
      () => {
        // The loading screen should still be visible (or children if it transitioned)
        expect(document.body.querySelector("[role='status']") ||
          document.body.querySelector("[data-testid='children']")).toBeTruthy();
      },
      { timeout: 2000 }
    );
  });

  it("recovers when window.api becomes available after initial undefined", async () => {
    // Remove window.api to simulate the race condition
    const savedApi = window.api;
    delete (window as unknown as { api?: typeof mockApi }).api;

    // Setup: when API becomes available, storage check succeeds
    mockApi.system.hasEncryptionKeyStore.mockResolvedValue({
      success: true,
      hasKeyStore: true,
    });
    // Stay at initializing-db phase
    mockApi.system.initializeSecureStorage.mockReturnValue(new Promise(() => {}));

    render(
      <TestWrapper>
        <div data-testid="children">App Content</div>
      </TestWrapper>
    );

    // Initially showing loading screen (waitForApi is polling)
    expect(screen.getByText("Checking secure storage...")).toBeInTheDocument();

    // Restore window.api after a short delay (simulates preload finishing)
    await new Promise((r) => setTimeout(r, 60));
    (window as unknown as { api: typeof mockApi }).api = savedApi;

    // Should eventually transition to the next phase after API becomes available
    await waitFor(
      () => {
        expect(
          screen.getByText("Waiting for Keychain access...")
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });
});
