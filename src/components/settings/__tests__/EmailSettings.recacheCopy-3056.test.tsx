/**
 * BACKLOG-3056 — THE RE-CACHE DESCRIPTION MAY NOT PROMISE "NEWER ONLY".
 *
 * ===========================================================================
 * WHY THIS SUITE EXISTS
 * ===========================================================================
 * The panel said *"Only downloads emails newer than what is already cached."*
 * That sentence was true, and it is exactly what made the defect invisible: the
 * founder widened Email History from 3 to 6 to 12 months, pressed Re-cache, was
 * told "Cached 0 new emails" each time — and the copy underneath agreed with the
 * broken behaviour. Nothing went red when the behaviour changed, because no test
 * read the string.
 *
 * The same claim had spread past the panel. It was also in the preload bridge
 * JSDoc, the renderer-facing IPC type doc, and `precacheEmails`'s own doc
 * comment. Those are developer-facing and cannot be asserted from here; they
 * were corrected in the same commit.
 *
 * ===========================================================================
 * IT PINS THE CLAIMS, NOT THE PROSE
 * ===========================================================================
 * Asserting whole sentences freezes the wording, and a test that gets rewritten
 * to match whatever the code now says protects nothing. So this asserts:
 *
 *   - the thing that is now FALSE ("only ... newer") is absent
 *   - the two things that must be SAYABLE: older mail arrives when the history
 *     window has been widened, and the user's emails stay linked
 *   - the Force re-cache line next to it still says it unlinks — the contrast is
 *     the whole reason the ordinary button gained the reassurance
 *
 * MUTATION: restore "Only downloads emails newer than what is already cached."
 * in EmailSettings -> the first two tests go red.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { EmailSettings } from "../EmailSettings";

jest.mock("../../../contexts/NetworkContext", () => ({
  useNetwork: () => ({ isOnline: true }),
}));

jest.mock("../../../services", () => ({
  settingsService: { updatePreferences: jest.fn().mockResolvedValue({ success: true }) },
  authService: {
    googleConnectMailbox: jest.fn(),
    microsoftConnectMailbox: jest.fn(),
    googleDisconnectMailbox: jest.fn(),
    microsoftDisconnectMailbox: jest.fn(),
    onMailboxConnected: jest.fn(() => () => {}),
  },
}));

jest.mock("../../../utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  (window as unknown as { api: unknown }).api = {
    system: {
      checkAllConnections: jest.fn().mockResolvedValue({
        success: true,
        google: { connected: true, email: "agent@example.com" },
        microsoft: { connected: false },
      }),
    },
    transactions: {
      precacheEmails: jest.fn(),
      cancelPrecacheEmails: jest.fn(),
      onPrecacheProgress: () => () => {},
    },
  };
});

const renderPanel = () =>
  render(<EmailSettings userId="user-3056" initialPreferences={undefined as never} />);

/**
 * The Re-cache block's own text, isolated from the Force re-cache paragraph
 * below it. Reading the whole panel would let the force line's "unlinks" satisfy
 * an assertion about the ordinary one, which is the confusion under test.
 */
async function recacheBlockText(): Promise<string> {
  // BACKLOG-3156 stage A moved the buttons OUT of the description card and onto
  // the page, so climbing from the button now lands on a row with no prose in
  // it. The description block carries its own testid; reading it names the same
  // text the old traversal reached, and cannot silently start reading the Force
  // paragraph if the markup shifts again — which is the confusion under test.
  const block = await screen.findByTestId("recache-description");
  return (block.textContent ?? "").replace(/\s+/g, " ");
}

describe("BACKLOG-3056 — Re-cache copy", () => {
  it("no longer promises that only newer mail is downloaded", async () => {
    renderPanel();
    const text = await recacheBlockText();

    expect(text).not.toMatch(/only downloads emails newer/i);
    // Broader than the exact sentence: any "only ... newer" promise is the claim
    // the fix falsified, however it is phrased.
    expect(text).not.toMatch(/only[^.]*newer/i);
  });

  it("says older mail arrives when the history window has been widened", async () => {
    renderPanel();
    const text = await recacheBlockText();

    expect(text).toMatch(/older/i);
    // Tied to the setting by name, because "older mail sometimes arrives" with
    // no stated condition would be a different and misleading promise.
    expect(text).toMatch(/email history/i);
  });

  it("says the user's emails stay linked", async () => {
    renderPanel();
    const text = await recacheBlockText();

    expect(text).toMatch(/stay linked|nothing is unlinked|does not unlink/i);
  });

  it("still warns that Force re-cache unlinks — the contrast must survive", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByTestId("force-recache-emails")).toBeInTheDocument());
    const forceRow = screen.getByTestId("force-recache-description");

    expect((forceRow.textContent ?? "").replace(/\s+/g, " ")).toMatch(
      /unlinks your emails from their transactions/i,
    );
  });
});
