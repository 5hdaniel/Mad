/**
 * Tests for AppleDriverSetup.tsx
 * Covers driver installation UI, consent flow, and platform-specific behavior
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import AppleDriverSetup from "../AppleDriverSetup";
import { PlatformProvider } from "../../contexts/PlatformContext";

// Store original window.api
const originalApi = window.api;

// Shared mock functions that persist across tests
const mockDrivers = {
  checkApple: jest.fn(),
  installApple: jest.fn(),
  hasBundled: jest.fn(),
  openITunesStore: jest.fn(),
  checkUpdate: jest.fn(),
};

// Helper to render with PlatformProvider
function renderWithPlatform(
  ui: React.ReactElement,
  platform: string = "win32",
) {
  // Mock the api object with system.platform and drivers API
  Object.defineProperty(window, "api", {
    value: {
      ...originalApi,
      system: {
        ...originalApi?.system,
        platform,
      },
      drivers: mockDrivers,
    },
    writable: true,
    configurable: true,
  });

  return render(<PlatformProvider>{ui}</PlatformProvider>);
}

describe("AppleDriverSetup", () => {
  const mockOnComplete = jest.fn();
  const mockOnSkip = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mock implementations
    mockDrivers.checkApple.mockReset();
    mockDrivers.installApple.mockReset();
    mockDrivers.hasBundled.mockReset();
    mockDrivers.openITunesStore.mockReset();
    mockDrivers.checkUpdate.mockReset();
  });

  afterEach(() => {
    // Restore original window.api
    Object.defineProperty(window, "api", {
      value: originalApi,
      writable: true,
      configurable: true,
    });
  });

  describe("Platform Behavior", () => {
    it("should call onComplete immediately on non-Windows platforms", async () => {
      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "darwin", // macOS
      );

      // On non-Windows, should immediately call onComplete
      expect(mockOnComplete).toHaveBeenCalled();
    });

    it("should render the setup screen on Windows", async () => {
      mockDrivers.checkApple.mockResolvedValue({
        installed: false,
        serviceRunning: false,
      });
      mockDrivers.hasBundled.mockResolvedValue({ hasBundled: true });

      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "win32",
      );

      // Wait for the checking phase to complete
      await waitFor(() => {
        expect(screen.getByText("Install iPhone Tools")).toBeInTheDocument();
      });
    });
  });

  describe("Checking State", () => {
    it("should show checking state initially", async () => {
      // Make the check hang to observe the checking state
      mockDrivers.checkApple.mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "win32",
      );

      expect(screen.getByText("Checking System...")).toBeInTheDocument();
    });
  });

  describe("Already Installed State", () => {
    it("should show already installed state with Continue button when drivers are installed (no update available)", async () => {
      mockDrivers.checkApple.mockResolvedValue({
        installed: true,
        serviceRunning: true,
      });
      // No update available
      mockDrivers.checkUpdate.mockResolvedValue({
        updateAvailable: false,
        installedVersion: "19.0.0.0",
        bundledVersion: "19.0.0.0",
      });

      await act(async () => {
        renderWithPlatform(
          <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
          "win32",
        );
      });

      // Should show already installed state with Continue button
      await waitFor(() => {
        expect(screen.getByText("Already Installed")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
      });

      // onComplete should NOT have been called yet (user must click Continue)
      expect(mockOnComplete).not.toHaveBeenCalled();

      // Click Continue
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /continue/i }));
      expect(mockOnComplete).toHaveBeenCalled();
    });

    it("should show update available when newer version exists", async () => {
      mockDrivers.checkApple.mockResolvedValue({
        installed: true,
        serviceRunning: true,
      });
      mockDrivers.checkUpdate.mockResolvedValue({
        updateAvailable: true,
        installedVersion: "18.0.0.0",
        bundledVersion: "19.0.0.0",
      });
      mockDrivers.hasBundled.mockResolvedValue({ hasBundled: true });

      await act(async () => {
        renderWithPlatform(
          <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
          "win32",
        );
      });

      // Should show update available UI instead of skipping
      await waitFor(() => {
        expect(screen.getByText("Update Available")).toBeInTheDocument();
      });

      // onComplete should NOT have been called yet
      expect(mockOnComplete).not.toHaveBeenCalled();
    });
  });

  describe("Not Installed State - With Bundled MSI", () => {
    beforeEach(() => {
      mockDrivers.checkApple.mockResolvedValue({
        installed: false,
        serviceRunning: false,
      });
      mockDrivers.hasBundled.mockResolvedValue({ hasBundled: true });
    });

    it("should show install button when bundled MSI is available", async () => {
      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "win32",
      );

      await waitFor(() => {
        // Get all "Install Tools" elements (one in progress bar, one as button)
        const installButtons = screen.getAllByText("Install Tools");
        expect(installButtons.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("should show consent information", async () => {
      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "win32",
      );

      await waitFor(() => {
        expect(screen.getByText("What gets installed")).toBeInTheDocument();
        // Use getAllByText since "Apple Mobile Device Support" appears multiple times
        const amdsElements = screen.getAllByText(/Apple Mobile Device Support/);
        expect(amdsElements.length).toBeGreaterThanOrEqual(1);
        expect(
          screen.getByText("Administrator Permission Required"),
        ).toBeInTheDocument();
      });
    });

    it("should show skip option", async () => {
      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "win32",
      );

      await waitFor(() => {
        // Component uses "Skip for Now" (capital N)
        expect(screen.getByText(/skip for now/i)).toBeInTheDocument();
      });
    });

    it("should call onSkip when skip button is clicked", async () => {
      const user = userEvent.setup();

      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "win32",
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /skip for now/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /skip for now/i }));
      expect(mockOnSkip).toHaveBeenCalled();
    });
  });

  describe("Not Installed State - Without Bundled MSI", () => {
    beforeEach(() => {
      mockDrivers.checkApple.mockResolvedValue({
        installed: false,
        serviceRunning: false,
      });
      mockDrivers.hasBundled.mockResolvedValue({ hasBundled: false });
    });

    it("should show Microsoft Store button when bundled MSI is not available", async () => {
      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "win32",
      );

      await waitFor(() => {
        expect(
          screen.getByText("Open Microsoft Store (iTunes)"),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/Bundled installer not found/),
        ).toBeInTheDocument();
      });
    });

    it("should open iTunes store when Microsoft Store button is clicked", async () => {
      const user = userEvent.setup();
      mockDrivers.openITunesStore.mockResolvedValue(undefined);

      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "win32",
      );

      await waitFor(() => {
        expect(
          screen.getByText("Open Microsoft Store (iTunes)"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByText("Open Microsoft Store (iTunes)"));
      expect(mockDrivers.openITunesStore).toHaveBeenCalled();
    });
  });

  describe("Installation Flow", () => {
    beforeEach(() => {
      mockDrivers.checkApple.mockResolvedValue({
        installed: false,
        serviceRunning: false,
      });
      mockDrivers.hasBundled.mockResolvedValue({ hasBundled: true });
    });

    it("should show installing state when install is clicked", async () => {
      const user = userEvent.setup();

      // Make install hang to observe the installing state
      mockDrivers.installApple.mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "win32",
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /install tools/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /install tools/i }));

      await waitFor(() => {
        expect(screen.getByText("Installing Tools...")).toBeInTheDocument();
        expect(
          screen.getByText(/Please approve the installation/),
        ).toBeInTheDocument();
      });
    });

    it("should complete successfully after successful installation", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      mockDrivers.installApple.mockResolvedValue({ success: true });

      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "win32",
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /install tools/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /install tools/i }));

      // Component shows "Tools Ready!" for installed state
      await waitFor(() => {
        expect(screen.getByText("Tools Ready!")).toBeInTheDocument();
      });

      // Fast-forward the auto-continue timer (1500ms)
      await act(async () => {
        jest.advanceTimersByTime(1500);
      });

      expect(mockOnComplete).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it("should show error state when installation fails", async () => {
      const user = userEvent.setup();

      mockDrivers.installApple.mockResolvedValue({
        success: false,
        error: "Installation failed due to permissions",
      });

      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "win32",
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /install tools/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /install tools/i }));

      await waitFor(() => {
        expect(screen.getByText("Installation Issue")).toBeInTheDocument();
        expect(
          screen.getByText(/Installation failed due to permissions/),
        ).toBeInTheDocument();
      });
    });

    it("should show cancelled state when user cancels UAC prompt", async () => {
      const user = userEvent.setup();

      mockDrivers.installApple.mockResolvedValue({
        success: false,
        cancelled: true,
      });

      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "win32",
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /install tools/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /install tools/i }));

      await waitFor(() => {
        expect(screen.getByText("Installation Issue")).toBeInTheDocument();
        expect(
          screen.getByText(/Installation was cancelled/),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Error/Cancelled State Actions", () => {
    beforeEach(() => {
      mockDrivers.checkApple.mockResolvedValue({
        installed: false,
        serviceRunning: false,
      });
      mockDrivers.hasBundled.mockResolvedValue({ hasBundled: true });
      mockDrivers.installApple.mockResolvedValue({
        success: false,
        cancelled: true,
      });
    });

    it("should show Try Again and Install iTunes buttons in error state", async () => {
      const user = userEvent.setup();

      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "win32",
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /install tools/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /install tools/i }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /install itunes/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /skip for now/i })).toBeInTheDocument();
      });
    });

    it("should retry installation when Try Again is clicked", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      // First call fails, second call succeeds
      mockDrivers.installApple
        .mockResolvedValueOnce({ success: false, cancelled: true })
        .mockResolvedValueOnce({ success: true });

      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "win32",
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /install tools/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /install tools/i }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /try again/i }));

      // Component shows "Tools Ready!" for installed state
      await waitFor(() => {
        expect(screen.getByText("Tools Ready!")).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it("should open iTunes store when Install iTunes is clicked", async () => {
      const user = userEvent.setup();
      mockDrivers.openITunesStore.mockResolvedValue(undefined);

      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "win32",
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /install tools/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /install tools/i }));

      await waitFor(() => {
        expect(screen.getByText("Install iTunes")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Install iTunes"));
      expect(mockDrivers.openITunesStore).toHaveBeenCalled();
    });
  });

  describe("Progress Indicator", () => {
    beforeEach(() => {
      mockDrivers.checkApple.mockResolvedValue({
        installed: false,
        serviceRunning: false,
      });
      mockDrivers.hasBundled.mockResolvedValue({ hasBundled: true });
    });

    it("should show 3 steps in the progress indicator", async () => {
      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "win32",
      );

      await waitFor(() => {
        // Component shows 3 steps: Phone Type, Connect Email, Install Tools
        expect(screen.getByText("Phone Type")).toBeInTheDocument();
        expect(screen.getByText("Connect Email")).toBeInTheDocument();
        // "Install Tools" appears multiple times (progress + button + heading)
        const installToolsElements = screen.getAllByText("Install Tools");
        expect(installToolsElements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("should highlight Install Tools as current step (step 3)", async () => {
      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "win32",
      );

      await waitFor(() => {
        // Find the Install Tools label in the progress indicator
        const installToolsLabels = screen.getAllByText("Install Tools");
        // The progress indicator label should have the active styling
        const progressLabel = installToolsLabels.find(
          (el) =>
            el.classList.contains("text-blue-600") &&
            el.classList.contains("font-medium"),
        );
        expect(progressLabel).toBeTruthy();
      });
    });
  });

  describe("Accessibility", () => {
    beforeEach(() => {
      mockDrivers.checkApple.mockResolvedValue({
        installed: false,
        serviceRunning: false,
      });
      mockDrivers.hasBundled.mockResolvedValue({ hasBundled: true });
    });

    it("should have accessible install button", async () => {
      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "win32",
      );

      await waitFor(() => {
        const installButton = screen.getByRole("button", {
          name: /install tools/i,
        });
        expect(installButton).toBeInTheDocument();
      });
    });

    it("should have accessible skip button", async () => {
      renderWithPlatform(
        <AppleDriverSetup onComplete={mockOnComplete} onSkip={mockOnSkip} />,
        "win32",
      );

      await waitFor(() => {
        const skipButton = screen.getByRole("button", {
          name: /skip for now/i,
        });
        expect(skipButton).toBeInTheDocument();
      });
    });
  });
});
