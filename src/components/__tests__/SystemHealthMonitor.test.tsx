/**
 * SystemHealthMonitor Tests (BACKLOG-2127)
 *
 * Focus of this iteration:
 * - CHANGE 2: the banner actually RENDERS a visible reconnect surface for a
 *   broken-token health issue (title + Reconnect action button), and clicking
 *   Reconnect routes to the shared email-settings navigation.
 * - CHANGE 4: the recoverable reconnect state renders in the AMBER family
 *   (not red), and there is no redundant subtitle echoing the button.
 *
 * These assert exact copy/testids/classes rather than counts.
 */

import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import SystemHealthMonitor from "../SystemHealthMonitor";
import {
  FDA_DENIED_BANNER_ISSUE,
  FDA_EXPLAINER_ACTION_LABEL,
} from "../../../tests/fixtures/fdaDeniedIssue-3219";

// Mock the services barrel that SystemHealthMonitor imports from.
const mockHealthCheck = jest.fn();
// BACKLOG-3210 (part 2): the explainer's primary button calls this. It is the
// ONLY route to the macOS pane from the banner now, so it is asserted both
// ways — not called when the button is clicked, called when the explainer's
// own primary is.
const mockOpenFullDiskAccessSettings = jest.fn();
jest.mock("../../services", () => ({
  systemService: {
    healthCheck: (...args: unknown[]) => mockHealthCheck(...args),
    openPrivacyPane: jest.fn(),
    openFullDiskAccessSettings: (...args: unknown[]) =>
      mockOpenFullDiskAccessSettings(...args),
  },
  authService: {
    googleConnectMailbox: jest.fn(),
    microsoftConnectMailbox: jest.fn(),
    onMailboxConnected: jest.fn(),
  },
}));

// A broken-Outlook health result as produced by system:health-check.
const brokenOutlookIssue = {
  type: "TOKEN_REFRESH_FAILED",
  provider: "microsoft",
  severity: "error",
  userMessage: "Your Outlook connection expired. Reconnect to keep capturing email.",
  action: "Reconnect",
  actionHandler: "reconnect-microsoft",
};

const healthResult = (issues: unknown[]) => ({
  success: true,
  data: { healthy: issues.length === 0, issues },
});

/** Render and fire the component's 3s initial-check timer. */
async function renderAndCheck(props: Partial<React.ComponentProps<typeof SystemHealthMonitor>> = {}) {
  const utils = render(
    <SystemHealthMonitor
      userId="user-1"
      provider="google"
      onOpenSettings={jest.fn()}
      {...props}
    />,
  );
  // Advance past the 3s initial delay and flush the async healthCheck.
  await act(async () => {
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
  });
  return utils;
}

describe("SystemHealthMonitor (BACKLOG-2127)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockHealthCheck.mockResolvedValue(healthResult([brokenOutlookIssue]));
    mockOpenFullDiskAccessSettings.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders a visible reconnect banner (title + Reconnect button) for a broken token", async () => {
    await renderAndCheck();

    // Title = the full reconnect sentence (userMessage).
    expect(
      screen.getByText("Your Outlook connection expired. Reconnect to keep capturing email."),
    ).toBeInTheDocument();
    // A visible action button labelled just "Reconnect".
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeInTheDocument();
  });

  it("clicking Reconnect opens Settings (shared email-settings navigation)", async () => {
    const onOpenSettings = jest.fn();
    await renderAndCheck({ onOpenSettings });

    fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("renders the recoverable reconnect state in the AMBER family, not red (CHANGE 4)", async () => {
    await renderAndCheck();

    const title = screen.getByText(
      "Your Outlook connection expired. Reconnect to keep capturing email.",
    );
    // The banner row is the title's ancestor carrying the severity background.
    const banner = title.closest("div.border-b");
    expect(banner).not.toBeNull();
    // Amber (warning) palette — NOT the red error palette.
    expect(banner?.className).toContain("amber");
    expect(banner?.className).not.toContain("bg-red-50");
    // Button uses the amber CTA styling.
    expect(screen.getByRole("button", { name: "Reconnect" }).className).toContain("amber");
  });

  it("does NOT render a redundant subtitle that echoes the button (CHANGE 4)", async () => {
    await renderAndCheck();

    // The word "Reconnect" appears once — as the button — not also as a subtitle.
    expect(screen.getAllByText("Reconnect")).toHaveLength(1);
  });

  it("renders nothing when the health check reports no issues", async () => {
    mockHealthCheck.mockResolvedValue(healthResult([]));
    const { container } = await renderAndCheck();
    expect(container).toBeEmptyDOMElement();
  });
});

/**
 * BACKLOG-3219 / BACKLOG-3210 (part 2) — the Full Disk Access row.
 *
 * The issue fed in here is `FDA_DENIED_BANNER_ISSUE` from
 * `tests/fixtures/fdaDeniedIssue-3219.ts`: the real
 * `permissionService.checkFullDiskAccess()` return, transcribed in
 * `electron/services/__tests__/permissionService.fdaDeniedShape-3219.test.ts`,
 * with the decoration `diagnosticHandlers` adds — asserted end to end in
 * `electron/handlers/__tests__/diagnosticHandlers.fdaIssueAction-3219.test.ts`.
 * Nothing here is invented; a producer change reds those two suites first.
 */
describe("SystemHealthMonitor — Full Disk Access (BACKLOG-3219 / BACKLOG-3210 part 2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockHealthCheck.mockResolvedValue(healthResult([FDA_DENIED_BANNER_ISSUE]));
    mockOpenFullDiskAccessSettings.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("the fixture really is an FDA denial carrying the explainer action (premise)", () => {
    // Asserted before any behaviour, so a fixture that drifted into some other
    // shape cannot make the assertions below pass for the wrong reason.
    expect(FDA_DENIED_BANNER_ISSUE.errorCode).toBe("FULL_DISK_ACCESS_DENIED");
    expect(FDA_DENIED_BANNER_ISSUE.actionHandler).toBe("open-fda-explainer");
  });

  it("STATE 1 — renders a banner that NAMES the permission", async () => {
    await renderAndCheck();

    expect(
      screen.getByText(
        "Full Disk Access permission is required to read iMessages."
      )
    ).toBeInTheDocument();
  });

  it("STATE 1 — the action button is the short 'Show me how', not the producer's sentence", async () => {
    await renderAndCheck();

    expect(
      screen.getByRole("button", { name: FDA_EXPLAINER_ACTION_LABEL })
    ).toBeInTheDocument();
    // The 78-character sentence the producer sends as `action` must not be a
    // button label. It is what would render if the decoration were dropped.
    expect(
      screen.queryByRole("button", {
        name: /Please grant Full Disk Access in System Settings/,
      })
    ).not.toBeInTheDocument();
  });

  it("STATE 2 — a healthy check renders NOTHING (the fix is not 'banner always on')", async () => {
    // Pairs with AppShell's STATE 2: the monitor now MOUNTS unconditionally on
    // the dashboard, so this is what stops that from meaning "always visible".
    mockHealthCheck.mockResolvedValue(healthResult([]));
    const { container } = await renderAndCheck();
    expect(container).toBeEmptyDOMElement();
  });

  it("STATE 3 — hidden suppresses the row even with the permission missing", async () => {
    const { container } = await renderAndCheck({ hidden: true });
    expect(container).toBeEmptyDOMElement();
  });

  it("STATE 5 — clicking it opens the explainer, NOT the macOS pane", async () => {
    await renderAndCheck();

    fireEvent.click(
      screen.getByRole("button", { name: FDA_EXPLAINER_ACTION_LABEL })
    );

    // The explainer — the same component the Settings notice opens.
    expect(await screen.findByTestId("fda-help-sheet")).toBeInTheDocument();
    expect(
      screen.getByText("Your messages stay on this Mac. Period.")
    ).toBeInTheDocument();
    // The whole point of the item: the user is NOT dropped into System
    // Settings by this click.
    expect(mockOpenFullDiskAccessSettings).not.toHaveBeenCalled();
  });

  it("STATE 6 — the macOS pane is still reachable from INSIDE the explainer", async () => {
    await renderAndCheck();
    fireEvent.click(
      screen.getByRole("button", { name: FDA_EXPLAINER_ACTION_LABEL })
    );
    await screen.findByTestId("fda-help-sheet");

    fireEvent.click(
      screen.getByRole("button", { name: "Open System Settings" })
    );

    await waitFor(() =>
      expect(mockOpenFullDiskAccessSettings).toHaveBeenCalledTimes(1)
    );
  });

  it("the banner row survives opening the explainer — the permission is still missing", async () => {
    await renderAndCheck();
    fireEvent.click(
      screen.getByRole("button", { name: FDA_EXPLAINER_ACTION_LABEL })
    );
    await screen.findByTestId("fda-help-sheet");

    // A banner that vanished because you asked for help would be a worse
    // dead-end than the one being fixed.
    expect(
      screen.getByText(
        "Full Disk Access permission is required to read iMessages."
      )
    ).toBeInTheDocument();
  });

  it("'Not now' closes the explainer without opening System Settings", async () => {
    await renderAndCheck();
    fireEvent.click(
      screen.getByRole("button", { name: FDA_EXPLAINER_ACTION_LABEL })
    );
    await screen.findByTestId("fda-help-sheet");

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    await waitFor(() =>
      expect(screen.queryByTestId("fda-help-sheet")).not.toBeInTheDocument()
    );
    expect(mockOpenFullDiskAccessSettings).not.toHaveBeenCalled();
  });
});
