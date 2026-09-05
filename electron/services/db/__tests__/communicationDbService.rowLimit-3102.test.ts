/**
 * @jest-environment node
 *
 * BACKLOG-3102 (PR 1) — the row limit is a BOUND PARAMETER, and `limit = 0`
 * still means "no limit".
 *
 * ===========================================================================
 * WHY THIS RUNS THE REAL SQL
 * ===========================================================================
 * The change under test moves a value out of SQL TEXT and into the params
 * array: `LIMIT ${Number(limit)}` became `LIMIT ?`. The obvious cheaper test —
 * assert the emitted statement contains "LIMIT ?" — proves only that a string
 * was edited. It passes with the parameter bound in the wrong ORDER, with the
 * clause emitted when it should be absent, and with `LIMIT 0` silently
 * returning nothing.
 *
 * So the query runs against a REAL in-memory SQLite database, injected with
 * `setDb`, over the REAL `electron/database/schema.sql`, and every assertion is
 * on the ROW IDS that come back.
 *
 * ===========================================================================
 * THE BOUNDARY THIS SUITE EXISTS FOR
 * ===========================================================================
 * Before this change the clause was emitted by a TRUTHINESS test:
 *
 *     ${limit ? `LIMIT ${Number(limit)}` : ""}
 *
 * so `limit = 0` emitted NO clause at all and returned every row. The naive
 * conversion — bind whenever `limit !== undefined` — turns that into `LIMIT 0`
 * and returns ZERO rows. That is a silent, total data loss for any caller that
 * ever passes 0, and it is the single reason this suite exists.
 *
 * `zero means no limit` and `negative means no limit` below are the tests that
 * fail under the naive bind. The rest of the suite passes without them.
 *
 * ===========================================================================
 * REACHABILITY — STATED, BECAUSE THE RULING OVERSTATED IT
 * ===========================================================================
 * The SR ruling (F2) called `limit = 0` reachable from the renderer. Measured
 * at `c3d9b6f3e`, it is NOT: `transactionCrudHandlers.ts:249` and `:301`
 * forward no third argument, `preload/transactionBridge.ts:129` and `:143`
 * send none, and `types/database.ts:152` declares a one-parameter signature.
 * No production call site passes a limit at all.
 *
 * The boundary is therefore LATENT, not live — and that is precisely why it is
 * pinned here rather than left to the next caller to discover. There is no IPC
 * payload to transcribe; the producer of this value is the exported signature
 * `limit?: number` on `getCommunicationsWithMessages` itself, which is what
 * these cases call.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require(
  require("path").join(__dirname, "..", "..", "..", "..", "node_modules", "better-sqlite3-multiple-ciphers"),
) as typeof import("better-sqlite3-multiple-ciphers");
import type { Database as DatabaseType } from "better-sqlite3";

jest.mock("../../logService", () => {
  const noop = jest.fn().mockResolvedValue(undefined);
  return { __esModule: true, default: { info: noop, warn: noop, error: noop, debug: noop } };
});

import { setDb } from "../core/dbConnection";
import { getCommunicationsWithMessages } from "../communicationDbService";

const USER = "user-3102";
const TXN = "txn-3102";
const THREAD = "macos-chat-3102";

/**
 * Five messages, NEWEST FIRST.
 *
 * `sent_at` is distinct per row because the statement orders by
 * `COALESCE(m.sent_at, e.sent_at) DESC` — ties would make "the newest 3" a
 * coin flip and a limit assertion meaningless. The bodies are distinct too:
 * the loader content-deduplicates text messages on `bodyText|sentAt`, so
 * repeated bodies would collapse rows AFTER the LIMIT and confound the count
 * this suite is measuring.
 */
const ROWS = [
  { id: "m-3102-e", sentAt: "2026-01-05T10:00:00Z" },
  { id: "m-3102-d", sentAt: "2026-01-04T10:00:00Z" },
  { id: "m-3102-c", sentAt: "2026-01-03T10:00:00Z" },
  { id: "m-3102-b", sentAt: "2026-01-02T10:00:00Z" },
  { id: "m-3102-a", sentAt: "2026-01-01T10:00:00Z" },
] as const;

/** Ids in the order the statement returns them: newest first. */
const NEWEST_FIRST = ROWS.map((r) => r.id);

let db: DatabaseType;

/**
 * The REAL schema, executed from `electron/database/schema.sql` — the same
 * choice, for the same reason, as `communicationDbService.threadNames-2814`:
 * a hand-written subset of `messages` / `emails` / `communications` is a guess
 * at what this 85-line SELECT projects, and a fixture that disagrees with the
 * shipped schema makes a passing test meaningless.
 */
function createSchema(d: DatabaseType): void {
  const schemaPath = require("path").join(
    __dirname, "..", "..", "..", "database", "schema.sql",
  );
  d.exec(require("fs").readFileSync(schemaPath, "utf8"));
}

function addMessage(id: string, sentAt: string): void {
  db.prepare(
    `INSERT INTO messages (id, user_id, channel, external_id, direction, body_text,
                           participants, thread_id, sent_at)
     VALUES (?, ?, 'imessage', ?, 'inbound', ?, ?, ?, ?)`,
  ).run(
    id,
    USER,
    `guid-${id}`,
    `body ${id}`,
    JSON.stringify({ from: "+15550100", to: ["+15550101"] }),
    THREAD,
    sentAt,
  );
  db.prepare(
    `INSERT INTO communications (id, user_id, transaction_id, message_id, thread_id)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(`comm-${id}`, USER, TXN, id, THREAD);
}

/**
 * The ids the loader returns, IN ORDER.
 *
 * Assertions below compare id sequences, never lengths. A length assertion
 * cannot tell "the newest 3" from "the oldest 3", and this statement's whole
 * contract is which rows the limit keeps.
 */
async function idsFor(limit?: number): Promise<string[]> {
  const rows = (await getCommunicationsWithMessages(TXN, "text", limit)) as unknown as Array<{
    id: string;
  }>;
  return rows.map((r) => r.id);
}

beforeEach(() => {
  db = new Database(":memory:");
  createSchema(db);
  // schema.sql carries the real FOREIGN KEYs, so the user must exist first.
  db.prepare(
    "INSERT INTO users_local (id, email, oauth_provider, oauth_id) VALUES (?, ?, 'google', ?)",
  ).run(USER, `${USER}@example.test`, `oauth-${USER}`);
  db.prepare(
    `INSERT INTO transactions (id, user_id, property_address) VALUES (?, ?, ?)`,
  ).run(TXN, USER, "1 Test St");
  for (const row of ROWS) addMessage(row.id, row.sentAt);
  setDb(db);
});

afterEach(() => {
  db?.close();
});

describe("BACKLOG-3102 — the row limit, swept across its boundary", () => {
  it("finds a corpus to limit (a limit test over zero rows always passes)", async () => {
    expect(await idsFor()).toEqual(NEWEST_FIRST);
    expect(NEWEST_FIRST).toHaveLength(5);
  });

  it("omitted (undefined) returns every row", async () => {
    expect(await idsFor(undefined)).toEqual(NEWEST_FIRST);
  });

  /**
   * THE CONTROL THAT MATTERS. Under the naive `limit !== undefined` bind this
   * emits `LIMIT 0` and returns []. Preserving the truthiness test is the
   * whole behavioural requirement of this PR.
   */
  it("ZERO means NO LIMIT, not zero rows", async () => {
    expect(await idsFor(0)).toEqual(NEWEST_FIRST);
  });

  /**
   * Truthy, and SQLite reads a negative LIMIT as "no limit" — so this returned
   * every row before the change and must still. Binding it changes nothing,
   * which is exactly what has to be shown rather than assumed.
   */
  it("NEGATIVE means no limit — same before and after binding", async () => {
    expect(await idsFor(-1)).toEqual(NEWEST_FIRST);
  });

  it("one returns the single NEWEST row", async () => {
    expect(await idsFor(1)).toEqual([NEWEST_FIRST[0]]);
  });

  it("three returns the three NEWEST rows, in order", async () => {
    expect(await idsFor(3)).toEqual(NEWEST_FIRST.slice(0, 3));
  });

  it("a limit larger than the table returns every row", async () => {
    expect(await idsFor(Number.MAX_SAFE_INTEGER)).toEqual(NEWEST_FIRST);
  });

  /**
   * The `Number()` coercion is load-bearing and must survive the conversion.
   *
   * The shipped text was `LIMIT ${Number(limit)}`, so a stringy value was
   * already normalised to a number before it reached SQLite. Binding `limit`
   * RAW instead of `Number(limit)` would bind TEXT and hand SQLite a different
   * type than it has been getting. The parameter is typed `number`, so the
   * cast here is deliberate: it exercises the coercion the production code
   * performs, which is the only reason that coercion is still in the diff.
   */
  it("coerces a stringy limit, exactly as the spliced Number() did", async () => {
    const stringy = "3" as unknown as number;
    expect(await idsFor(stringy)).toEqual(NEWEST_FIRST.slice(0, 3));
  });
});
