/**
 * Feature Flag Component Tests
 *
 * Tests for the FeatureFlaggedProvider and related components.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import {
  FeatureFlaggedProvider,
  StateMachineDebugPanel,
  useNewStateMachine,
} from "./FeatureFlag";

// Mock the feature flags module
jest.mock("./utils/featureFlags", () => ({
  isNewStateMachineEnabled: jest.fn(),
  getFeatureFlagStatus: jest.fn(() => ({ source: "default", value: false })),
  enableNewStateMachine: jest.fn(),
  disableNewStateMachine: jest.fn(),
}));

// Mock AppStateContext
jest.mock("./AppStateContext", () => ({
  AppStateProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-state-provider">{children}</div>
  ),
}));

import { isNewStateMachineEnabled } from "./utils/featureFlags";

const mockIsNewStateMachineEnabled = isNewStateMachineEnabled as jest.Mock;

describe("FeatureFlaggedProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders children without wrapper when flag is disabled", () => {
    mockIsNewStateMachineEnabled.mockReturnValue(false);

    render(
      <FeatureFlaggedProvider>
        <div data-testid="child">Child Content</div>
      </FeatureFlaggedProvider>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByTestId("app-state-provider")).not.toBeInTheDocument();
  });

  it("renders children with AppStateProvider when flag is enabled", () => {
    mockIsNewStateMachineEnabled.mockReturnValue(true);

    render(
      <FeatureFlaggedProvider>
        <div data-testid="child">Child Content</div>
      </FeatureFlaggedProvider>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByTestId("app-state-provider")).toBeInTheDocument();
  });

  it("renders fallback when flag is disabled and fallback is provided", () => {
    mockIsNewStateMachineEnabled.mockReturnValue(false);

    render(
      <FeatureFlaggedProvider
        fallback={<div data-testid="fallback">Fallback Content</div>}
      >
        <div data-testid="child">Child Content</div>
      </FeatureFlaggedProvider>
    );

    expect(screen.getByTestId("fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  it("ignores fallback when flag is enabled", () => {
    mockIsNewStateMachineEnabled.mockReturnValue(true);

    render(
      <FeatureFlaggedProvider
        fallback={<div data-testid="fallback">Fallback Content</div>}
      >
        <div data-testid="child">Child Content</div>
      </FeatureFlaggedProvider>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
  });

  it("checks flag only once on mount", () => {
    mockIsNewStateMachineEnabled.mockReturnValue(false);

    const { rerender } = render(
      <FeatureFlaggedProvider>
        <div data-testid="child">Child Content</div>
      </FeatureFlaggedProvider>
    );

    // Change the mock return value
    mockIsNewStateMachineEnabled.mockReturnValue(true);

    // Rerender
    rerender(
      <FeatureFlaggedProvider>
        <div data-testid="child">Child Content</div>
      </FeatureFlaggedProvider>
    );

    // Should still not have the provider (flag was false on mount)
    expect(screen.queryByTestId("app-state-provider")).not.toBeInTheDocument();

    // Should only have been called once per mount
    expect(mockIsNewStateMachineEnabled).toHaveBeenCalledTimes(1);
  });
});

describe("StateMachineDebugPanel", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("renders nothing in production", () => {
    process.env.NODE_ENV = "production";

    const { container } = render(<StateMachineDebugPanel />);

    expect(container.firstChild).toBeNull();
  });

  it("renders in development", () => {
    process.env.NODE_ENV = "development";

    render(<StateMachineDebugPanel />);

    expect(screen.getByText(/State Machine:/)).toBeInTheDocument();
  });
});

describe("useNewStateMachine", () => {
  // Helper component to test the hook
  function TestComponent() {
    const isEnabled = useNewStateMachine();
    return <div data-testid="result">{isEnabled ? "enabled" : "disabled"}</div>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns false when flag is disabled", () => {
    mockIsNewStateMachineEnabled.mockReturnValue(false);

    render(<TestComponent />);

    expect(screen.getByTestId("result")).toHaveTextContent("disabled");
  });

  it("returns true when flag is enabled", () => {
    mockIsNewStateMachineEnabled.mockReturnValue(true);

    render(<TestComponent />);

    expect(screen.getByTestId("result")).toHaveTextContent("enabled");
  });
});
