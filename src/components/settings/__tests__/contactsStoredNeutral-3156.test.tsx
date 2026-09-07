/**
 * BACKLOG-3156 stage C — THE COUNTS GRID IS ONE TREATMENT, AND IT HEARS A CONNECT.
 *
 * ===========================================================================
 * PART 1: THE COLOURS
 * ===========================================================================
 * The five cells carried five hues — macOS violet, iPhone blue, Outlook
 * indigo, Google green, Android teal — and none of them meant anything: every
 * cell already names its source in words directly beneath the number. The
 * founder read the row as unfinished software, which is a fair reading of five
 * colours chosen for no reason.
 *
 * The assertion is deliberately a PROPERTY, not a class string: all enabled
 * cells wear one identical treatment, all disabled cells wear another, and no
 * cell anywhere in the grid carries a hue token. Pinning the exact Tailwind
 * string would red on a legitimate restyle while still passing on a fifth
 * colour added to a sixth cell — the opposite of what is wanted.
 *
 * The one difference kept is the dimming of a source whose import is switched
 * off, because that carries real state.
 *
 * ===========================================================================
 * PART 2: THE EM-DASH THE FOUNDER SAW, AND WHAT IT ACTUALLY WAS
 * ===========================================================================
 * The report was "`— Google` on a connected Google account". Traced rather than
 * guessed: it is NOT a key mismatch. `getContactSourceStats`
 * (externalContactDbService.ts) seeds all five keys at 0 and the renderer reads
 * those same five names character-for-character, so a connected-but-empty
 * source renders `0` — `0?.toLocaleString()` is `"0"`, and `??` does not fall
 * through it.
 *
 * The em-dash is the WHOLE-GRID null state: `sourceStats` starts `null` and
 * stays `null` when the read fails. On a machine where Google is the only
 * connected account it is also the only cell the grid draws, so a whole-grid
 * null looks exactly like one dashed Google cell.
 *
 * And it stayed null through the moment that should have fixed it. Connecting
 * an account runs a contact import in the MAIN process, which finishes by
 * sending `contacts:external-sync-complete` — a channel that, before this
 * change, had no listener anywhere in `src/`. That import bypasses the sync
 * orchestrator, so the orchestrator-completion effect never fired for it
 * either. The grid kept its mount-time numbers until Settings was reopened.
 *
 * `?? 0` at the render site was rejected: it would print a confident `0`
 * whenever the read had failed or not yet returned, turning "we do not know"
 * into "we counted, and there are none" — a false claim in the one situation
 * the user most needs the truth.
 *
 * ===========================================================================
 * MUTATIONS (planted, confirmed red by name, reverted)
 * ===========================================================================
 *   7. Give the Google cell back `bg-green-50 border-green-200`
 *   8. Drop `opacity-50` from the disabled treatment
 *   9. Delete the `onExternalSyncComplete` subscription
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ContactsSettings } from "../ContactsSettings";
import { PlatformProvider } from "../../../contexts/PlatformContext";

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

jest.mock("../../../hooks/useSyncOrchestrator", () => ({
  useSyncOrchestrator: () => ({ queue: [], isRunning: false, requestSync: jest.fn() }),
}));

jest.mock("../../../services", () => ({
  settingsService: {
    getPreferences: jest.fn().mockResolvedValue({ success: true, data: {} }),
    updatePreferences: jest.fn().mockResolvedValue({ success: true }),
  },
  authService: {},
}));

jest.mock("../../../utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const originalApi = window.api;

/** Every Tailwind hue family the grid must not reach for. */
const HUE_TOKENS = [
  "violet", "indigo", "teal", "green", "blue", "amber", "purple",
  "red", "yellow", "emerald", "sky", "cyan", "pink", "orange",
  "lime", "fuchsia", "rose",
];

let getSourceStats: jest.Mock;
/** Captured `contacts:external-sync-complete` subscribers. */
let syncCompleteSubscribers: Array<() => void>;

function installApi(stats: Record<string, number>): void {
  getSourceStats = jest.fn().mockResolvedValue({ success: true, stats });
  syncCompleteSubscribers = [];
  Object.defineProperty(window, "api", {
    value: {
      ...originalApi,
      system: { ...originalApi?.system, platform: "darwin" },
      contacts: {
        getExternalSyncStatus: jest
          .fn()
          .mockResolvedValue({ success: true, lastSyncAt: null, contactCount: 0 }),
        syncOutlookContacts: jest.fn().mockResolvedValue({ success: true, count: 0 }),
        syncGoogleContacts: jest.fn().mockResolvedValue({ success: true, count: 0 }),
        syncExternal: jest.fn().mockResolvedValue({ success: true }),
        forceReimport: jest.fn().mockResolvedValue({ success: true, cleared: 0 }),
        getSourceStats,
        onExternalSyncComplete: (cb: () => void) => {
          syncCompleteSubscribers.push(cb);
          return () => {
            syncCompleteSubscribers = syncCompleteSubscribers.filter((s) => s !== cb);
          };
        },
      },
    },
    writable: true,
    configurable: true,
  });
}

/**
 * Outlook ON, Google OFF: the grid needs one cell of each treatment for the
 * "enabled and disabled differ ONLY by dimming" claim to have anything to
 * compare.
 */
function renderContacts(
  direct: Record<string, boolean> = { outlookContacts: true, googleContacts: false },
) {
  return render(
    <PlatformProvider>
      <ContactsSettings
        userId="u"
        initialPreferences={
          { phone_type: "iphone", contactSources: { direct } } as never
        }
        isMicrosoftConnected={true}
        isGoogleConnected={true}
      />
    </PlatformProvider>,
  );
}

/**
 * Every source switched ON.
 *
 * This exists because the first control run against the mixed fixture above did
 * NOT go red: the planted hue was put on the Google cell's ENABLED branch, and
 * the mixed fixture has Google switched off, so the mutated line never
 * rendered. The fixture could not reach the code the assertion was written to
 * guard — so the suite sweeps both branches of every cell rather than sampling
 * one.
 */
const ALL_ON = {
  outlookContacts: true,
  googleContacts: true,
  macosContacts: true,
  androidContacts: true,
};

/** The cells, taken from the DOM rather than from a list this test maintains. */
function cells(): HTMLElement[] {
  const stored = screen.getByTestId("contacts-block-stored");
  const grid = stored.querySelector(".grid");
  expect(grid).not.toBeNull();
  return Array.from((grid as HTMLElement).children) as HTMLElement[];
}

beforeEach(() => {
  installApi({ macos: 12, iphone: 0, outlook: 34, google_contacts: 0, android_sync: 0 });
});

afterEach(() => {
  Object.defineProperty(window, "api", {
    value: originalApi,
    writable: true,
    configurable: true,
  });
});

describe("BACKLOG-3156 stage C — the counts grid wears one treatment", () => {
  it("renders more than one cell, so the comparisons below are not vacuous", async () => {
    renderContacts();
    await waitFor(() => expect(cells().length).toBeGreaterThan(1));
  });

  it.each([
    ["a mix of switched-on and switched-off sources", undefined],
    ["every source switched on", ALL_ON],
  ])("carries no hue anywhere in the grid — %s", async (_label, direct) => {
    renderContacts(direct as Record<string, boolean> | undefined);
    await waitFor(() => expect(cells().length).toBeGreaterThan(1));

    const classes = cells()
      .flatMap((cell) => [cell, ...Array.from(cell.querySelectorAll("*"))])
      .map((el) => el.getAttribute("class") ?? "")
      .join(" ");

    for (const hue of HUE_TOKENS) {
      expect(`${hue} in the counts grid: ${classes.includes(hue)}`).toBe(
        `${hue} in the counts grid: false`,
      );
    }
  });

  /**
   * The all-on fixture must actually light every cell, or the sweep above is a
   * second sample rather than a sweep.
   */
  it("lights every cell when every source is switched on", async () => {
    renderContacts(ALL_ON);
    await waitFor(() => expect(cells().length).toBeGreaterThan(1));

    const dimmed = cells().filter((c) =>
      (c.getAttribute("class") ?? "").includes("opacity-50"),
    );
    expect(dimmed).toHaveLength(0);
    expect(cells().map((c) => c.textContent).join(" ")).toContain("Google");
  });

  it("gives every enabled cell the SAME treatment, and every disabled cell one other", async () => {
    renderContacts();
    await waitFor(() => expect(cells().length).toBeGreaterThan(1));

    const dimmed = cells().filter((c) => (c.getAttribute("class") ?? "").includes("opacity-50"));
    const lit = cells().filter((c) => !(c.getAttribute("class") ?? "").includes("opacity-50"));

    // Both groups are populated by the fixture (Outlook on, Google off), so
    // neither loop below can pass by being empty.
    expect(lit.length).toBeGreaterThan(0);
    expect(dimmed.length).toBeGreaterThan(0);

    const litClasses = new Set(lit.map((c) => c.getAttribute("class")));
    const dimmedClasses = new Set(dimmed.map((c) => c.getAttribute("class")));
    expect(litClasses.size).toBe(1);
    expect(dimmedClasses.size).toBe(1);
  });

  /**
   * The dimming is the ONE difference that survives, so it is asserted as
   * present rather than merely allowed — a neutralisation that also flattened
   * the on/off distinction would pass every check above.
   */
  it("still dims a source whose import is switched off", async () => {
    renderContacts();
    await waitFor(() => expect(cells().length).toBeGreaterThan(1));

    const google = cells().find((c) => c.textContent?.includes("Google"));
    const outlook = cells().find((c) => c.textContent?.includes("Outlook"));
    expect(google?.getAttribute("class")).toContain("opacity-50");
    expect(outlook?.getAttribute("class")).not.toContain("opacity-50");
  });

  /**
   * The premise the founder's report rested on, checked directly: a connected
   * source with no rows shows `0`. If this ever renders `—`, the em-dash IS a
   * per-cell miss and the diagnosis above is wrong.
   */
  it("shows 0, not an em-dash, for a connected source with no rows", async () => {
    renderContacts();
    await waitFor(() => expect(cells().length).toBeGreaterThan(1));

    const google = cells().find((c) => c.textContent?.includes("Google"));
    expect(google?.textContent).toContain("0");
    expect(google?.textContent).not.toContain("—");
  });
});

describe("BACKLOG-3156 stage C — the grid refreshes when the main process imports", () => {
  it("re-reads the counts when contacts:external-sync-complete fires", async () => {
    renderContacts();
    await waitFor(() => expect(getSourceStats).toHaveBeenCalled());
    await waitFor(() => expect(syncCompleteSubscribers.length).toBeGreaterThan(0));

    const before = getSourceStats.mock.calls.length;
    getSourceStats.mockResolvedValue({
      success: true,
      stats: { macos: 12, iphone: 0, outlook: 34, google_contacts: 900, android_sync: 0 },
    });

    await act(async () => {
      syncCompleteSubscribers.forEach((notify) => notify());
    });

    expect(getSourceStats.mock.calls.length).toBeGreaterThan(before);
    await waitFor(() => {
      const google = cells().find((c) => c.textContent?.includes("Google"));
      expect(google?.textContent).toContain("900");
    });
  });
});
