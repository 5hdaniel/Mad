/**
 * Tests for Platform Components
 * Verifies PlatformOnly, MacOSOnly, WindowsOnly, LinuxOnly, DesktopOnly, and FeatureGate
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { PlatformProvider } from "../../../contexts/PlatformContext";
import {
  PlatformOnly,
  MacOSOnly,
  WindowsOnly,
  LinuxOnly,
  DesktopOnly,
  FeatureGate,
} from "../index";

// Store original window.electron
const originalElectron = window.electron;

// Helper to render with PlatformProvider
function renderWithPlatform(ui: React.ReactElement, platform: string) {
  Object.defineProperty(window, "electron", {
    value: { platform },
    writable: true,
    configurable: true,
  });

  return render(<PlatformProvider>{ui}</PlatformProvider>);
}

describe("Platform Components", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original window.electron
    Object.defineProperty(window, "electron", {
      value: originalElectron,
      writable: true,
      configurable: true,
    });
  });

  describe("PlatformOnly", () => {
    it("should render children when platform matches", () => {
      renderWithPlatform(
        <PlatformOnly platforms={["macos"]}>
          <span data-testid="content">macOS Content</span>
        </PlatformOnly>,
        "darwin",
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
    });

    it("should not render children when platform does not match", () => {
      renderWithPlatform(
        <PlatformOnly platforms={["macos"]}>
          <span data-testid="content">macOS Content</span>
        </PlatformOnly>,
        "win32",
      );

      expect(screen.queryByTestId("content")).not.toBeInTheDocument();
    });

    it("should render fallback when platform does not match", () => {
      renderWithPlatform(
        <PlatformOnly
          platforms={["macos"]}
          fallback={<span data-testid="fallback">Fallback</span>}
        >
          <span data-testid="content">macOS Content</span>
        </PlatformOnly>,
        "win32",
      );

      expect(screen.queryByTestId("content")).not.toBeInTheDocument();
      expect(screen.getByTestId("fallback")).toBeInTheDocument();
    });

    it("should render children when any of multiple platforms match", () => {
      renderWithPlatform(
        <PlatformOnly platforms={["macos", "linux"]}>
          <span data-testid="content">Unix Content</span>
        </PlatformOnly>,
        "linux",
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
    });
  });

  describe("MacOSOnly", () => {
    it("should render children on macOS", () => {
      renderWithPlatform(
        <MacOSOnly>
          <span data-testid="content">macOS Feature</span>
        </MacOSOnly>,
        "darwin",
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
    });

    it("should not render children on Windows", () => {
      renderWithPlatform(
        <MacOSOnly>
          <span data-testid="content">macOS Feature</span>
        </MacOSOnly>,
        "win32",
      );

      expect(screen.queryByTestId("content")).not.toBeInTheDocument();
    });

    it("should render fallback on Windows", () => {
      renderWithPlatform(
        <MacOSOnly fallback={<span data-testid="fallback">Not available</span>}>
          <span data-testid="content">macOS Feature</span>
        </MacOSOnly>,
        "win32",
      );

      expect(screen.getByTestId("fallback")).toBeInTheDocument();
    });
  });

  describe("WindowsOnly", () => {
    it("should render children on Windows", () => {
      renderWithPlatform(
        <WindowsOnly>
          <span data-testid="content">Windows Feature</span>
        </WindowsOnly>,
        "win32",
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
    });

    it("should not render children on macOS", () => {
      renderWithPlatform(
        <WindowsOnly>
          <span data-testid="content">Windows Feature</span>
        </WindowsOnly>,
        "darwin",
      );

      expect(screen.queryByTestId("content")).not.toBeInTheDocument();
    });
  });

  describe("LinuxOnly", () => {
    it("should render children on Linux", () => {
      renderWithPlatform(
        <LinuxOnly>
          <span data-testid="content">Linux Feature</span>
        </LinuxOnly>,
        "linux",
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
    });

    it("should not render children on Windows", () => {
      renderWithPlatform(
        <LinuxOnly>
          <span data-testid="content">Linux Feature</span>
        </LinuxOnly>,
        "win32",
      );

      expect(screen.queryByTestId("content")).not.toBeInTheDocument();
    });
  });

  describe("DesktopOnly", () => {
    it("should render children on macOS", () => {
      renderWithPlatform(
        <DesktopOnly>
          <span data-testid="content">Desktop Feature</span>
        </DesktopOnly>,
        "darwin",
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
    });

    it("should render children on Windows", () => {
      renderWithPlatform(
        <DesktopOnly>
          <span data-testid="content">Desktop Feature</span>
        </DesktopOnly>,
        "win32",
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
    });

    it("should render children on Linux", () => {
      renderWithPlatform(
        <DesktopOnly>
          <span data-testid="content">Desktop Feature</span>
        </DesktopOnly>,
        "linux",
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
    });
  });

  describe("FeatureGate", () => {
    describe("localMessagesAccess feature", () => {
      it("should render on macOS", () => {
        renderWithPlatform(
          <FeatureGate feature="localMessagesAccess">
            <span data-testid="messages">Local Messages</span>
          </FeatureGate>,
          "darwin",
        );

        expect(screen.getByTestId("messages")).toBeInTheDocument();
      });

      it("should not render on Windows", () => {
        renderWithPlatform(
          <FeatureGate feature="localMessagesAccess">
            <span data-testid="messages">Local Messages</span>
          </FeatureGate>,
          "win32",
        );

        expect(screen.queryByTestId("messages")).not.toBeInTheDocument();
      });

      it("should render fallback on Windows", () => {
        renderWithPlatform(
          <FeatureGate
            feature="localMessagesAccess"
            fallback={<span data-testid="fallback">Use USB sync instead</span>}
          >
            <span data-testid="messages">Local Messages</span>
          </FeatureGate>,
          "win32",
        );

        expect(screen.getByTestId("fallback")).toBeInTheDocument();
      });
    });

    describe("iPhoneUSBSync feature", () => {
      it("should render on Windows", () => {
        renderWithPlatform(
          <FeatureGate feature="iPhoneUSBSync">
            <span data-testid="usb-sync">USB Sync</span>
          </FeatureGate>,
          "win32",
        );

        expect(screen.getByTestId("usb-sync")).toBeInTheDocument();
      });

      it("should render on Linux", () => {
        renderWithPlatform(
          <FeatureGate feature="iPhoneUSBSync">
            <span data-testid="usb-sync">USB Sync</span>
          </FeatureGate>,
          "linux",
        );

        expect(screen.getByTestId("usb-sync")).toBeInTheDocument();
      });

      it("should not render on macOS", () => {
        renderWithPlatform(
          <FeatureGate feature="iPhoneUSBSync">
            <span data-testid="usb-sync">USB Sync</span>
          </FeatureGate>,
          "darwin",
        );

        expect(screen.queryByTestId("usb-sync")).not.toBeInTheDocument();
      });
    });

    describe("emailIntegration feature", () => {
      it("should render on all platforms", () => {
        const platforms = ["darwin", "win32", "linux"];

        platforms.forEach((platform) => {
          const { unmount } = renderWithPlatform(
            <FeatureGate feature="emailIntegration">
              <span data-testid="email">Email Integration</span>
            </FeatureGate>,
            platform,
          );

          expect(screen.getByTestId("email")).toBeInTheDocument();
          unmount();
        });
      });
    });
  });
});
