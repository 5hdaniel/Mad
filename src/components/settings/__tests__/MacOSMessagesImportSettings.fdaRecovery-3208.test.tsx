/**
 * BACKLOG-3208 — skipping the onboarding Full Disk Access step was a one-way
 * door. This is the way back.
 *
 * ─── WHAT WENT WRONG ─────────────────────────────────────────────────────────
 *
 * BACKLOG-1842 gave the onboarding permissions step a "Skip for now" button, at
 * the founder's direction, and its own comment calls it "the FIRST escape hatch
 * this step has ever had". The escape hatch shipped; the way back did not.
 *
 * Verified on develop @ 4876986b4 before a line was written:
 *   - `checkPermissions` had ZERO callers under `src/components/settings/`.
 *   - `MacOSMessagesImportSettings.tsx` matched none of `permission`,
 *     `Full Disk`, `FDA`, `EPERM` or `grant` — no permission awareness at all.
 *   - `PermissionsStep.meta.shouldShow` is `permissionsGranted !== true`, so
 *     once onboarding completes the only FDA surface in the app is retired.
 *
 * The result was a panel that looked fully available, could not read a single
 * message, and explained nothing.
 *
 * ─── WHY THESE TESTS ARE SHAPED THIS WAY ─────────────────────────────────────
 *
 * The decisive question is not "does the code path exist" — it is "with Full
 * Disk Access absent, does the PANEL SAY SO". So every test here drives the
 * real `systemService` (only `settingsService` is stubbed, via
 * `requireActual` + override) down to the globally-mocked `window.api.system.*`
 * channel, and asserts the RENDERED UI. Mocking the service would have let the
 * service itself rot with these tests still green.
 *
 * The fixtures are transcribed from the producers, not invented:
 *   - `checkPermissions` denied is `{ hasPermission: false, error: <the raw
 *     fs.access message> }` — the exact shape `permissionHandlers.ts`
 *     `check-permissions` returns on its catch path.
 *   - the estimate refusal is the literal string `permissionService.ts`
 *     `checkFullDiskAccess` puts in `userMessage`, which
 *     `getAvailableMessageCount` returns as `error` when FDA is missing.
 *
 * Rendered in StrictMode, matching the app and the rest of this suite.
 */

import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MacOSMessagesImportSettings } from "../MacOSMessagesImportSettings";

jest.mock("../../../contexts/PlatformContext", () => ({
  usePlatform: jest.fn(() => ({ isMacOS: true })),
}));

jest.mock("../../../hooks/useSyncOrchestrator", () => ({
  useSyncOrchestrator: jest.fn(() => ({
    queue: [],
    requestSync: jest.fn(),
    markCancelRequested: jest.fn(),
    getQueueItem: jest.fn(),
  })),
}));

const mockGetPreferences = jest.fn();
const mockUpdatePreferences = jest.fn();

/**
 * Only `settingsService` is stubbed. `systemService` is the REAL one, so these
 * tests exercise the trigger-then-open sequence and the permission decoding
 * inside it rather than a jest.fn() standing where it used to be.
 */
jest.mock("../../../services", () => {
  const actual = jest.requireActual("../../../services");
  return {
    ...actual,
    settingsService: {
      getPreferences: (...args: unknown[]) => mockGetPreferences(...args),
      updatePreferences: (...args: unknown[]) => mockUpdatePreferences(...args),
    },
  };
});

const USER_ID = "user-3208";

/**
 * What `check-permissions` returns when Full Disk Access is missing.
 * `permissionHandlers.ts`: `{ hasPermission: false, error: (error as Error).message }`
 * where the error is `fs.access(~/Library/Messages/chat.db, R_OK)` rejecting.
 */
const FDA_DENIED = {
  hasPermission: false,
  error:
    "EPERM: operation not permitted, access '/Users/<user>/Library/Messages/chat.db'",
};

/** What it returns once the toggle is on. */
const FDA_GRANTED = { hasPermission: true };

/**
 * What `messages:get-import-count` returns with FDA missing.
 * `getAvailableMessageCount` runs `permissionService.checkFullDiskAccess()`
 * FIRST and returns its `userMessage` verbatim — this exact sentence.
 */
const ESTIMATE_REFUSED_NO_FDA = {
  success: false,
  error: "Full Disk Access permission is required to read iMessages.",
};

/** A normal estimate, for the tests that are not about the estimate. */
const ESTIMATE_OK = {
  success: true,
  count: 1200,
  filteredCount: 1200,
  windowCount: 1200,
  attachmentBytes: 1_000_000,
  attachmentCount: 4,
  availableDiskBytes: 500_000_000_000,
  fitsOnDisk: true,
};

const systemApi = () => window.api.system as unknown as Record<string, jest.Mock>;

const renderStrict = () =>
  render(
    <React.StrictMode>
      <MacOSMessagesImportSettings userId={USER_ID} />
    </React.StrictMode>
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPreferences.mockResolvedValue({ success: true, data: {} });
  mockUpdatePreferences.mockResolvedValue({ success: true });
  (window.api.messages.getImportStatus as jest.Mock).mockResolvedValue({
    success: true,
    messageCount: 0,
  });
  (window.api.messages.getEffectiveImportWindow as jest.Mock).mockResolvedValue({
    success: true,
    source: "preference",
    lookbackMonths: null,
    effectiveCutoffISO: null,
  });
  (window.api.messages.getImportCount as jest.Mock).mockResolvedValue(ESTIMATE_OK);
  systemApi().checkPermissions.mockResolvedValue(FDA_GRANTED);
  systemApi().triggerFullDiskAccess.mockResolvedValue({ granted: true });
  systemApi().openSystemSettings.mockResolvedValue({ success: true });
  systemApi().relaunchApp.mockResolvedValue({ relaunched: true });
});

describe("BACKLOG-3208 — the Messages panel offers Full Disk Access after onboarding was skipped", () => {
  /**
   * CONTROL 1. The decisive test: with FDA absent, the panel SAYS so.
   * Not "the code path exists" — the rendered notice.
   */
  it("says Full Disk Access is missing when the check reports it denied", async () => {
    systemApi().checkPermissions.mockResolvedValue(FDA_DENIED);

    renderStrict();

    const notice = await screen.findByTestId("macos-fda-denied-notice");
    expect(notice).toHaveTextContent("Keepr does not have Full Disk Access");
    expect(notice).toHaveTextContent(/cannot read any messages/i);
  });

  /** CONTROL 4. Granted is silent — no notice in front of a user who has it. */
  it("shows no permission notice when Full Disk Access is granted", async () => {
    systemApi().checkPermissions.mockResolvedValue(FDA_GRANTED);

    renderStrict();

    await waitFor(() =>
      expect(systemApi().checkPermissions).toHaveBeenCalled()
    );
    await waitFor(() =>
      expect(screen.getByTestId("macos-messages-import")).toBeInTheDocument()
    );
    expect(screen.queryByTestId("macos-fda-denied-notice")).toBeNull();
    expect(screen.queryByTestId("macos-fda-restart-notice")).toBeNull();
  });

  /**
   * An unanswerable check is NOT a denial. The panel must stay silent rather
   * than accuse a user who has granted access of not having done so.
   */
  it("stays silent when the permission check cannot answer", async () => {
    systemApi().checkPermissions.mockResolvedValue({
      fullDiskAccess: true,
      contacts: true,
    });

    renderStrict();

    await waitFor(() =>
      expect(systemApi().checkPermissions).toHaveBeenCalled()
    );
    expect(screen.queryByTestId("macos-fda-denied-notice")).toBeNull();
  });

  /**
   * CONTROL 2. The button opens the macOS Full Disk Access pane, and pre-lists
   * Keepr first so there is a row to switch on when it opens — the
   * trigger-then-open sequence borrowed from the onboarding step.
   */
  it("opens the Full Disk Access pane, with Keepr pre-listed, when the button is clicked", async () => {
    systemApi().checkPermissions.mockResolvedValue(FDA_DENIED);

    renderStrict();

    const button = await screen.findByTestId("macos-fda-open-settings");
    systemApi().triggerFullDiskAccess.mockClear();
    systemApi().openSystemSettings.mockClear();

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() =>
      expect(systemApi().openSystemSettings).toHaveBeenCalledTimes(1)
    );
    expect(systemApi().triggerFullDiskAccess).toHaveBeenCalledTimes(1);
  });

  /**
   * CONTROL 3. Granting FDA means leaving Keepr for System Settings, so the
   * moment the user comes back is exactly when the answer may have changed.
   */
  it("re-checks the permission when the window regains focus", async () => {
    systemApi().checkPermissions.mockResolvedValue(FDA_DENIED);

    renderStrict();

    await screen.findByTestId("macos-fda-denied-notice");
    const before = systemApi().checkPermissions.mock.calls.length;

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() =>
      expect(
        systemApi().checkPermissions.mock.calls.length
      ).toBeGreaterThan(before)
    );
  });

  /**
   * A grant made while Keepr is running is not usable access: macOS fixes an
   * app's Full Disk Access at process start. BACKLOG-1842 established this in
   * onboarding; the panel must not report success the import cannot deliver.
   */
  it("asks for a restart when the grant arrives while Keepr is running", async () => {
    systemApi().checkPermissions.mockResolvedValue(FDA_DENIED);

    renderStrict();
    await screen.findByTestId("macos-fda-denied-notice");

    systemApi().checkPermissions.mockResolvedValue(FDA_GRANTED);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    const restart = await screen.findByTestId("macos-fda-restart-notice");
    expect(restart).toHaveTextContent(/restart Keepr to finish/i);
    expect(screen.queryByTestId("macos-fda-denied-notice")).toBeNull();
  });

  it("relaunches only when the user asks — never from the focus re-check", async () => {
    systemApi().checkPermissions.mockResolvedValue(FDA_DENIED);

    renderStrict();
    await screen.findByTestId("macos-fda-denied-notice");

    systemApi().checkPermissions.mockResolvedValue(FDA_GRANTED);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    await screen.findByTestId("macos-fda-restart-notice");

    // The flip alone must not quit the app out from under someone who is in
    // the middle of using Settings.
    expect(systemApi().relaunchApp).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId("macos-fda-restart"));
    });

    expect(systemApi().relaunchApp).toHaveBeenCalledTimes(1);
  });

  /**
   * `relaunch-app` resolves `{ relaunched: false }` when the main-process
   * E2E/dev gate suppresses it. The process is still running, so the panel must
   * say what to do instead of spinning on a restart that is never coming.
   */
  it("tells the user to quit and reopen when the relaunch is suppressed", async () => {
    systemApi().checkPermissions.mockResolvedValue(FDA_DENIED);
    systemApi().relaunchApp.mockResolvedValue({ relaunched: false });

    renderStrict();
    await screen.findByTestId("macos-fda-denied-notice");

    systemApi().checkPermissions.mockResolvedValue(FDA_GRANTED);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    await screen.findByTestId("macos-fda-restart-notice");

    await act(async () => {
      fireEvent.click(screen.getByTestId("macos-fda-restart"));
    });

    const fallback = await screen.findByTestId("macos-fda-restart-unavailable");
    expect(fallback).toHaveTextContent(/Quit Keepr and open it again/i);
    expect(screen.getByTestId("macos-fda-restart")).not.toBeDisabled();
  });

  /**
   * CONTROL 5. A permission refusal must not be reported as a disk-space
   * problem.
   *
   * `getAvailableMessageCount` checks Full Disk Access before it opens
   * anything, so its refusal resolves NORMALLY as `{success:false, error:
   * "Full Disk Access permission is required to read iMessages."}`. The panel
   * used to drop that `error` and render "Keepr could not work out how much
   * space this import needs" — the wrong answer, not a vague one.
   */
  it("does not blame disk space when the estimate was refused for want of permission", async () => {
    systemApi().checkPermissions.mockResolvedValue(FDA_DENIED);
    (window.api.messages.getImportCount as jest.Mock).mockResolvedValue(
      ESTIMATE_REFUSED_NO_FDA
    );

    renderStrict();

    await screen.findByTestId("macos-fda-denied-notice");
    await waitFor(() =>
      expect(window.api.messages.getImportCount).toHaveBeenCalled()
    );

    expect(screen.queryByTestId("import-estimate-unavailable")).toBeNull();
  });

  /**
   * The two reads happen at different moments, so they can disagree: main can
   * refuse for want of Full Disk Access while this panel still holds `granted`
   * (or has not answered yet).
   *
   * That disagreement is the one state where suppressing the space copy could
   * do harm — suppressed AND no notice would be a refused import with nothing
   * on screen explaining it, which is exactly what BACKLOG-2760 exists to
   * prevent. The panel re-asks instead, and the notice arrives.
   */
  it("re-asks and shows the notice when main refuses for permission before the panel knows", async () => {
    systemApi().checkPermissions.mockResolvedValue(FDA_GRANTED);
    (window.api.messages.getImportCount as jest.Mock).mockImplementation(() => {
      // From this point on the panel's own check would find it denied too —
      // it simply has not asked since.
      systemApi().checkPermissions.mockResolvedValue(FDA_DENIED);
      return Promise.resolve(ESTIMATE_REFUSED_NO_FDA);
    });

    renderStrict();

    expect(
      await screen.findByTestId("macos-fda-denied-notice")
    ).toHaveTextContent("Keepr does not have Full Disk Access");
    expect(screen.queryByTestId("import-estimate-unavailable")).toBeNull();
  });

  /**
   * The other half of control 5: a refusal that is NOT about permission still
   * gets the space copy. Without this, "suppress the message" would pass by
   * deleting the message.
   */
  it("still says the size is unknown when the refusal has nothing to do with permission", async () => {
    systemApi().checkPermissions.mockResolvedValue(FDA_GRANTED);
    (window.api.messages.getImportCount as jest.Mock).mockResolvedValue({
      success: false,
      error: "SQLITE_BUSY: database is locked",
    });

    renderStrict();

    expect(
      await screen.findByTestId("import-estimate-unavailable")
    ).toHaveTextContent(/could not work out how much space/i);
  });
});
