/**
 * BACKLOG-3156 stage E — THE FOUR SETTINGS SCREENS HAVE ONE BLOCK SHAPE.
 *
 * ===========================================================================
 * WHY THIS SUITE EXISTS
 * ===========================================================================
 * `settingsBlockOrder-3156` pins the ORDER of the blocks. It passed while the
 * screens looked like three different products, because order is not shape:
 * Messages wrapped every block in a panel card and Emails did not, each block's
 * label sat outside its card on one screen and there was no card at all on
 * another, and three cards opened with an `<h4>` repeating in different words
 * the label printed directly above them. The founder read the shipped screens
 * and reported exactly that. It was the third round of drift on these files.
 *
 * So this suite asserts the SHAPE, and — the part that matters — asserts it
 * through ONE function applied to every screen. A per-screen assertion can
 * drift per screen; a shared invariant cannot. If Emails and Messages diverge,
 * the divergent one fails `auditBlock`, and `it("uses one card style across
 * every screen")` fails on the pair.
 *
 * THE SHAPE (from the approved artifact):
 *
 *     Emails                          <- section title, on the page
 *     ┌──────────────────────────┐
 *     │ Sources                  │    <- the block's label, FIRST CHILD
 *     │ Choose where to import…  │    <- description, if the block has one
 *     │ …controls…               │
 *     └──────────────────────────┘
 *       Import Emails  Force…  ?      <- actions, BARE, outside every card
 *
 * CARD vs ROW. These files already used two chromes and this fixes the meaning
 * to them: a CARD is `rounded-lg` + `border` and holds a block; a ROW is
 * `rounded` + `border` and lives inside one (the radio options, the provider
 * connections, the stored-count cells). `isCard` below is the definition, and
 * `no card inside a card` is enforceable because of it.
 *
 * ===========================================================================
 * MUTATIONS RUN AGAINST THIS FILE (each reverted after)
 * ===========================================================================
 *   1. Re-wrapped `MacOSMessagesImportSettings` in an outer panel card
 *      -> "no card sits inside another card" red on Messages (macOS).
 *   2. Moved the `Sources` eyebrow back outside its card in
 *      `ImportSourceSettings`
 *      -> "the label is the card's first child" red on Messages (sources).
 *   3. Put `<h4>Email History</h4>` back between the label and the description
 *      -> "the card carries no heading of its own" red on Emails, and the
 *         description's position red too.
 *   4. Moved the email description out of its card, above it
 *      -> "the description is the line directly under the label" red on Emails.
 *   5. Changed one screen's card classes to the old `p-3 bg-white rounded`
 *      -> "uses one card style across every screen" red.
 */

import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { EmailSettings } from "../EmailSettings";
import { ImportSourceSettings } from "../ImportSourceSettings";
import { MacOSMessagesImportSettings } from "../MacOSMessagesImportSettings";
import { AndroidMessagesSettings } from "../AndroidMessagesSettings";
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

// ===========================================================================
// The shape, as code. Every screen below is held to THIS, not to a copy of it.
// ===========================================================================

/**
 * A CARD is a `<div>` carrying both `rounded-lg` and the bare `border` class.
 * Word-boundary matching matters: `border-gray-200` is not `border`, and
 * `rounded` is not `rounded-lg` — which is what separates a card from a row.
 */
function isCard(el: Element): boolean {
  const cls = typeof el.className === "string" ? el.className : "";
  return (
    el.tagName === "DIV" &&
    /(^|\s)rounded-lg(\s|$)/.test(cls) &&
    /(^|\s)border(\s|$)/.test(cls)
  );
}

/**
 * A ROW is the chrome one step down: `rounded` (not `-lg`) plus the bare
 * `border`. Rows live inside cards — the radio options, the Gmail/Outlook
 * connections, the stored-count cells — and a row MAY carry a heading naming
 * itself. That is the one place a heading is legitimate inside a card.
 */
function isRow(el: Element): boolean {
  const cls = typeof el.className === "string" ? el.className : "";
  return (
    /(^|\s)rounded(\s|$)/.test(cls) && /(^|\s)border(\s|$)/.test(cls)
  );
}

function cardAncestor(el: Element): Element | null {
  let node = el.parentElement;
  while (node) {
    if (isCard(node)) return node;
    node = node.parentElement;
  }
  return null;
}

function allCards(root: HTMLElement): Element[] {
  return Array.from(root.querySelectorAll("div")).filter(isCard);
}

/** The eyebrow's class signature, as written in all five components. */
const EYEBROW_SELECTOR =
  "p.text-xs.font-medium.text-gray-500.uppercase.tracking-wide";

interface BlockSpec {
  /** `data-testid` of the block. The block IS its card. */
  testId: string;
  /** The label printed on the card's first line. */
  label: string;
  /** The line under the label, or null where the block has none. */
  description: string | null;
}

/**
 * Asserts one block against the shared shape. Every message names the screen
 * and the block, so a red says which of the four diverged and how.
 */
function auditBlock(screenName: string, block: BlockSpec): string {
  const card = screen.getByTestId(block.testId);
  const where = `${screenName} / ${block.label}`;

  // 1. The block IS a card — nothing wraps it, and it is not a bare div.
  expect(`${where}: block is a card = ${isCard(card)}`).toBe(
    `${where}: block is a card = true`,
  );

  // 2. The label is the card's FIRST CHILD, inside it.
  const label = within(card).getByText(block.label);
  expect(`${where}: label is the card's first child`).toBe(
    card.firstElementChild === label
      ? `${where}: label is the card's first child`
      : `${where}: label is NOT the card's first child (first child is ${
          card.firstElementChild?.tagName ?? "nothing"
        }: "${card.firstElementChild?.textContent?.slice(0, 40) ?? ""}")`,
  );

  // 3. The description, where the block has one, is the very next line — the
  //    slot the deleted <h4> headings used to occupy.
  if (block.description !== null) {
    const description = within(card).getByText(block.description);
    expect(`${where}: description follows the label`).toBe(
      label.nextElementSibling === description
        ? `${where}: description follows the label`
        : `${where}: description does NOT follow the label (next is "${
            label.nextElementSibling?.textContent?.slice(0, 40) ?? "nothing"
          }")`,
    );
  }

  // 4. The card carries no heading OF ITS OWN. The label above IS the card's
  //    heading; an <h4>/<h5> beneath it is the doubling this stage removed
  //    (`Import Source`, `Email History`, `Contacts`, `Import Filters`).
  //    A heading inside a ROW is allowed and asserted separately: `Gmail` and
  //    `Outlook` name which connection each row is, not what the card is.
  const cardHeadings = Array.from(card.querySelectorAll("h1,h2,h3,h4,h5,h6"))
    .filter((h) => {
      let node: Element | null = h.parentElement;
      while (node !== null && node !== card) {
        if (isRow(node)) return false;
        node = node.parentElement;
      }
      return true;
    })
    .map((h) => (h.textContent ?? "").trim());
  expect(`${where}: headings owned by the card = ${JSON.stringify(cardHeadings)}`).toBe(
    `${where}: headings owned by the card = []`,
  );

  return typeof card.className === "string" ? card.className : "";
}

/** Screen-wide invariants that no single block can carry. */
function auditScreen(
  screenName: string,
  container: HTMLElement,
  blocks: BlockSpec[],
  actionsTestId: string | null,
): string[] {
  const classNames = blocks.map((b) => auditBlock(screenName, b));

  // 5. No card inside a card. This is the panel-card regression: one wrapper
  //    around every block puts each block's card inside it.
  const nested = allCards(container)
    .filter((c) => cardAncestor(c) !== null)
    .map((c) => `${(c.textContent ?? "").slice(0, 40)}`);
  expect(`${screenName}: cards nested inside other cards = ${JSON.stringify(nested)}`).toBe(
    `${screenName}: cards nested inside other cards = []`,
  );

  // 6. Every eyebrow on the screen belongs to a card and opens it. Catches an
  //    eyebrow that escaped its card, and a second eyebrow added mid-card.
  const strays = Array.from(container.querySelectorAll(EYEBROW_SELECTOR))
    .filter((p) => {
      const owner = cardAncestor(p);
      return owner === null || owner.firstElementChild !== p;
    })
    .map((p) => (p.textContent ?? "").trim());
  expect(`${screenName}: labels not opening a card = ${JSON.stringify(strays)}`).toBe(
    `${screenName}: labels not opening a card = []`,
  );

  // 7. The actions stay bare: outside every card, and with no heading.
  if (actionsTestId !== null) {
    const actions = screen.getByTestId(actionsTestId);
    expect(`${screenName}: actions inside a card = ${cardAncestor(actions) !== null}`).toBe(
      `${screenName}: actions inside a card = false`,
    );
    expect(actions.querySelector("h1,h2,h3,h4,h5,h6")).toBeNull();
  }

  return classNames;
}

/**
 * Collected across every screen. The suite's last test asserts they are all the
 * same string — the assertion that reds when the four screens diverge, which is
 * the failure this whole item is about.
 */
const cardStyles = new Map<string, string>();

function recordStyles(screenName: string, classNames: string[]): void {
  classNames.forEach((cls, i) => cardStyles.set(`${screenName} #${i}`, cls));
}

const originalApi = window.api;

afterEach(() => {
  Object.defineProperty(window, "api", {
    value: originalApi,
    writable: true,
    configurable: true,
  });
});

describe("BACKLOG-3156 stage E — Emails", () => {
  beforeEach(() => {
    Object.defineProperty(window, "api", {
      value: {
        ...originalApi,
        system: {
          ...originalApi?.system,
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
      },
      writable: true,
      configurable: true,
    });
  });

  it("has one card per block, each opening with its own label", async () => {
    const { container } = render(
      <EmailSettings userId="u" initialPreferences={undefined as never} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("emails-block-actions")).toBeInTheDocument(),
    );

    recordStyles(
      "Emails",
      auditScreen(
        "Emails",
        container,
        [
          { testId: "emails-block-sources", label: "Sources", description: null },
          {
            testId: "emails-block-preferences",
            label: "Import Preferences",
            description:
              "How much email to keep cached locally for fast search and auto-linking.",
          },
        ],
        "emails-block-actions",
      ),
    );
  });

  /**
   * The provider connections are ROWS inside the Sources card, not cards. They
   * were cards, which is why the eyebrow could not move inside without creating
   * a card-in-card. Their own `<h4>Gmail</h4>` / `<h4>Outlook</h4>` do not
   * repeat the label above them — they say WHICH source each row is — so this
   * asserts they are still there and still name the providers, rather than
   * being swept up by the heading rule.
   */
  it("keeps Gmail and Outlook as named rows inside the Sources card", async () => {
    render(<EmailSettings userId="u" initialPreferences={undefined as never} />);
    const card = await screen.findByTestId("emails-block-sources");

    const gmail = within(card).getByText("Gmail");
    const outlook = within(card).getByText("Outlook");
    expect(gmail.closest("div[class*='rounded']")).not.toBeNull();
    expect(isCard(gmail.closest("div[class*='rounded']")!)).toBe(false);
    expect(isCard(outlook.closest("div[class*='rounded']")!)).toBe(false);
  });
});

describe("BACKLOG-3156 stage E — Messages (the source picker)", () => {
  it("has one card whose first line is Sources, description beneath", async () => {
    const { container } = render(
      <PlatformProvider>
        <ImportSourceSettings userId="u" />
      </PlatformProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("messages-block-sources")).toBeInTheDocument(),
    );
    // The radio options only render once the preference has loaded; auditing
    // the loading state would audit a spinner.
    await screen.findByText("iPhone Sync");

    recordStyles(
      "Messages (sources)",
      auditScreen(
        "Messages (sources)",
        container,
        [
          {
            testId: "messages-block-sources",
            label: "Sources",
            description: "Choose where to import your text messages from.",
          },
        ],
        null,
      ),
    );
  });
});

describe("BACKLOG-3156 stage E — Messages (macOS)", () => {
  beforeEach(() => {
    (window.api.messages.getImportStatus as jest.Mock).mockResolvedValue({
      success: true,
      messageCount: 0,
      lastImportAt: null,
    });
    (window.api.messages.getEffectiveImportWindow as jest.Mock).mockResolvedValue({
      success: true,
      effectiveCutoffISO: null,
      source: "lookback-pref",
      lookbackMonths: 3,
    });
    (window.api.messages.getImportCount as jest.Mock).mockResolvedValue({
      success: true,
      count: 10,
      filteredCount: 10,
    });
  });

  it("has no panel card wrapping its blocks", async () => {
    const { container } = render(
      <PlatformProvider>
        <MacOSMessagesImportSettings userId="u" enabled />
      </PlatformProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("messages-block-actions")).toBeInTheDocument(),
    );

    recordStyles(
      "Messages (macOS)",
      auditScreen(
        "Messages (macOS)",
        container,
        [
          {
            testId: "messages-block-preferences",
            label: "Import Preferences",
            description: null,
          },
        ],
        "messages-block-actions",
      ),
    );
  });

  /**
   * The root still carries the testid and `aria-disabled` BACKLOG-2335 put
   * there, and removing the card must not have taken them with it: every
   * existing query and the disabled semantics reach the whole panel.
   */
  it("keeps the root's testid and aria-disabled after the card came off", async () => {
    render(
      <PlatformProvider>
        <MacOSMessagesImportSettings userId="u" enabled={false} />
      </PlatformProvider>,
    );
    const root = await screen.findByTestId("macos-messages-import");

    expect(root).toHaveAttribute("aria-disabled", "true");
    expect(isCard(root)).toBe(false);
    expect(root.contains(screen.getByTestId("messages-block-preferences"))).toBe(true);
    expect(root.contains(screen.getByTestId("messages-block-actions"))).toBe(true);
  });

  /**
   * `SyncStatusIndicator` links to `#settings-import-filters`. Merging the
   * filters card into the Import Preferences block could have deleted the
   * anchor and left a dead link that no type or lint check would notice.
   */
  it("keeps the settings-import-filters anchor, now on the block itself", async () => {
    render(
      <PlatformProvider>
        <MacOSMessagesImportSettings userId="u" enabled />
      </PlatformProvider>,
    );
    const block = await screen.findByTestId("messages-block-preferences");
    expect(block).toHaveAttribute("id", "settings-import-filters");
  });
});

describe("BACKLOG-3156 stage E — Messages (Android)", () => {
  it("has no panel card wrapping its blocks", async () => {
    const { container } = render(<AndroidMessagesSettings userId="u" />);
    await waitFor(() =>
      expect(screen.getByTestId("android-block-actions")).toBeInTheDocument(),
    );

    recordStyles(
      "Messages (Android)",
      auditScreen(
        "Messages (Android)",
        container,
        [
          {
            testId: "android-block-preferences",
            label: "Import Preferences",
            description: null,
          },
        ],
        "android-block-actions",
      ),
    );
  });

  it("keeps the settings-android-companion anchor on the root", async () => {
    const { container } = render(<AndroidMessagesSettings userId="u" />);
    await screen.findByTestId("android-block-actions");

    const root = container.querySelector("#settings-android-companion");
    expect(root).not.toBeNull();
    expect(isCard(root!)).toBe(false);
    expect(root!.contains(screen.getByTestId("android-block-preferences"))).toBe(true);
  });
});

describe("BACKLOG-3156 stage E — Contacts", () => {
  beforeEach(() => {
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
          getSourceStats: jest.fn().mockResolvedValue({ success: true, stats: {} }),
        },
      },
      writable: true,
      configurable: true,
    });
  });

  it("has one card per block, each opening with its own label", async () => {
    const { container } = render(
      <PlatformProvider>
        <ContactsSettings
          userId="u"
          initialPreferences={
            { phone_type: "iphone", contactSources: { direct: {} } } as never
          }
          isMicrosoftConnected={true}
          isGoogleConnected={false}
        />
      </PlatformProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("contacts-block-actions")).toBeInTheDocument(),
    );

    recordStyles(
      "Contacts",
      auditScreen(
        "Contacts",
        container,
        [
          {
            testId: "contacts-block-sources",
            label: "Sources",
            description:
              "Manage contact sources and import contacts for transaction assignment.",
          },
          {
            testId: "contacts-block-autodiscover",
            label: "Auto-discover from conversations",
            description: null,
          },
          {
            testId: "contacts-block-stored",
            label: "Stored on this computer",
            description: null,
          },
        ],
        "contacts-block-actions",
      ),
    );
  });

  /**
   * The panel's `<h4>Contacts</h4>` repeated the section's own `<h3>Contacts</h3>`
   * one line above it. Asserted as a COUNT rather than an absence, because the
   * section heading legitimately says the word and a bare `queryByText` would
   * red on the wrong thing — or, scoped too tightly, pass with the h4 restored
   * under a different tag.
   */
  it("says Contacts once, as the section heading", async () => {
    render(
      <PlatformProvider>
        <ContactsSettings
          userId="u"
          initialPreferences={
            { phone_type: "iphone", contactSources: { direct: {} } } as never
          }
          isMicrosoftConnected={true}
          isGoogleConnected={false}
        />
      </PlatformProvider>,
    );
    await screen.findByTestId("contacts-block-actions");

    const headings = screen.getAllByRole("heading", { name: "Contacts" });
    expect(headings).toHaveLength(1);
    expect(headings[0].tagName).toBe("H3");
  });
});

describe("BACKLOG-3156 stage E — the four screens agree", () => {
  /**
   * THE POINT OF THE SUITE. Every block card collected above must carry the
   * same class string. A screen that keeps its own padding, its own fill, or
   * its own corner radius fails HERE, naming both sides, even though each
   * screen passed its own audit.
   *
   * It runs last and reads what the earlier tests recorded, so a red here means
   * the screens disagree — not that any one of them is malformed.
   */
  it("uses one card style across every screen", () => {
    // Enumerated, not counted: a screen whose audit never ran would otherwise
    // let this pass by agreeing with itself.
    expect([...cardStyles.keys()].sort()).toEqual([
      "Contacts #0",
      "Contacts #1",
      "Contacts #2",
      "Emails #0",
      "Emails #1",
      "Messages (Android) #0",
      "Messages (macOS) #0",
      "Messages (sources) #0",
    ]);

    const distinct = new Map<string, string[]>();
    for (const [where, cls] of cardStyles) {
      distinct.set(cls, [...(distinct.get(cls) ?? []), where]);
    }

    expect(
      `card styles in use: ${JSON.stringify(
        Object.fromEntries(distinct),
        null,
        1,
      )}`,
    ).toBe(
      `card styles in use: ${JSON.stringify(
        { "p-4 bg-gray-50 rounded-lg border border-gray-200": [...cardStyles.keys()] },
        null,
        1,
      )}`,
    );
  });
});
