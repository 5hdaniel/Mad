/**
 * @jest-environment node
 *
 * BACKLOG-2530 STEP 4 — A MULTI-STATEMENT WRITE MAY NOT SHIP WITHOUT A
 * TRANSACTION.
 *
 * ===========================================================================
 * WHY A GUARD AND NOT A CONVENTION
 * ===========================================================================
 * Steps 1-3 of BACKLOG-2530 wrapped every write the audit found. That fixes
 * today and relies on every future author remembering tomorrow.
 *
 * **Conventions failed twice on 2026-08-05.** BACKLOG-2510 (an import path that
 * wrote no crosswalk row) and BACKLOG-2525 (a path with no duplicate guard)
 * were both a NEW path not doing what its siblings did. Neither was caught by
 * review, because nothing about the new code looked wrong — it looked like the
 * other paths, minus one line nobody was looking for.
 *
 * This guard makes the omission red instead of invisible. Same shape as the
 * fixture-PII check: **you cannot forget it, because forgetting is what turns
 * the build red.**
 *
 * ===========================================================================
 * THE RULE
 * ===========================================================================
 * An exported function in the db layer that issues TWO OR MORE write statements
 * must either:
 *
 *   (a) call `dbTransaction` itself, or
 *   (b) be called BY NAME inside some other function's `dbTransaction` callback
 *       — the sync-core pattern (`updateContactSync`, `createTransactionSync`,
 *       `assignContactToTransactionSync`), which exists precisely so the
 *       composition can be atomic.
 *
 * ===========================================================================
 * WHY THE ENUMERATION IS DERIVED FROM SOURCE, NOT LISTED
 * ===========================================================================
 * BACKLOG-2530: *"A registry someone must remember to update is not
 * enforcement; prefer something derived from the code itself."*
 *
 * The function set, the write count and the wrapping are all read out of the
 * files. **Adding a new multi-write function turns this red without anyone
 * touching this file.** The only hand-maintained part is EXEMPT below, which
 * requires a written reason per entry and is asserted to stay small.
 *
 * ===========================================================================
 * WHAT IT DELIBERATELY DOES NOT CHECK
 * ===========================================================================
 * It does not verify that a rollback TEST exists — that cannot be derived from
 * source without pattern-matching test bodies, and a check that guesses is a
 * check that gets ignored. The forced-crash tests are asserted per operation in
 * the suites named in EXEMPT and in `atomicCreate-2496` / `atomicDealCreate-2538`.
 *
 * It counts statements textually. A write built by string concatenation at
 * runtime is invisible to it. That is a known floor, not a claim of completeness.
 */

import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const DB_DIR = path.join(REPO_ROOT, "electron", "services", "db");

/**
 * ===========================================================================
 * BACKLOG-2584 — THE SCAN ROOT, AND WHY WIDENING IT ALONE WOULD PROVE NOTHING
 * ===========================================================================
 * This used to be `DB_DIR`. Orchestration services in `electron/services/` and
 * IPC handlers in `electron/handlers/` were never enumerated, so a multi-write
 * ADDED LATER to any of them shipped with no standing red.
 *
 * Widening the ROOT alone does not fix that, and the measurement says so.
 * At `0dca6beb1`, with the enumerator unchanged:
 *
 *   root electron/services/db   96 files   439 fns   13 multi-write   0 new offenders
 *   root electron/services     269 files   820 fns   13 multi-write   0 new offenders
 *   root electron/services+handlers 317    890 fns   13 multi-write   0 new offenders
 *   root electron/             498 files  1131 fns   13 multi-write   0 new offenders
 *
 * Thirteen to thirteen. The 402 added files contain no exported function with
 * two SQL write STATEMENTS, because these files hold no SQL: epic 9 moved the
 * SQL into `db/` and left them composing db-layer CALLS. A textual write rule
 * cannot see a composition, so a root-only widening ships a green test that
 * proves nothing — the exact failure this guard exists to prevent.
 *
 * What makes the widening real is the composition rule below: a call to a
 * db-layer function that writes COUNTS AS A WRITE. That is what turns the
 * orchestration layer red, and it re-derives BACKLOG-2549, 2550, 2845 and part
 * of 2546 from source without being told about them.
 *
 * `__typefixtures__` is excluded deliberately: it holds `mustNotCompile-*.ts`
 * fixtures for `dbTransaction` itself, which are not shipped code. The exclusion
 * is pinned by a PRECONDITION below, because an exclusion held only by a string
 * literal is silently undone by a directory rename.
 *
 * ===========================================================================
 * STRUCTURAL FLOOR — WRITES SPREAD ACROSS NON-EXPORTED MODULE-LOCAL HELPERS
 * ===========================================================================
 * A unit is an exported function or an `ipcMain.handle` registration. Writes
 * split across TWO non-exported module-local helpers belong to no unit and are
 * invisible at any root. The depth-1 closure in `unitsInFile` only helps when
 * an enumerated unit calls both.
 *
 * This is not hypothetical and it hides part of an open critical.
 * BACKLOG-2546's own named sites `systemHandlers.ts:156` and `:198` sit inside
 * `createLocalUserFromCloud` (declared `:135`) and `persistSessionForUser`
 * (declared `:192`) — both `async function`, neither exported. The guard reads
 * green over them.
 *
 * SO: GUARD-GREEN IS NOT ITEM-COMPLETE, and the disposition must say which
 * sites each item has covered. BACKLOG-2546 names five entry points; this guard
 * sees three of them (`googleAuthHandlers.ts:116` and `:423`,
 * `microsoftAuthHandlers.ts:94`) and does not see the `systemHandlers` pair.
 * Closing 2546 requires reading the item, not re-running this file.
 */
const SCAN_ROOT = path.join(REPO_ROOT, "electron");
const EXCLUDED_DIR_NAMES = ["__tests__", "__typefixtures__"];

/**
 * Functions allowed to issue multiple writes unwrapped. EVERY entry needs a
 * reason. An entry whose reason is "it's fine" is a bug report.
 */
/**
 * An exemption is keyed `file::function`, never a bare name — BACKLOG-2990 chunk 5.
 *
 * A bare name is matched REPO-WIDE, so exempting one function silently exempts
 * every same-named function in `db/`. That is not hypothetical here: chunk 5
 * exempted `deleteLiveForceSet` in `macosForceSetSql.ts`, and
 * `emailForceSetSql.ts` has a namesake. The email one is inert today at a single
 * write — below this guard's threshold of two — but it would have been covered
 * silently the moment it grew.
 *
 * Third name-collision in this epic: BACKLOG-3061's method shadowed by an
 * identically-named live one, this guard's own known-list, and a reviewer pass
 * that matched `REPO_ROOT` and missed a guard using `ROOT`. A stated collision
 * is not hypothetical.
 */
const exemptKey = (f: { file: string; name: string }): string => `${f.file}::${f.name}`;

const EXEMPT: Record<string, string> = {
  // REMOVED by BACKLOG-2990 chunk 5: `runMigrations` and `applyMigration` were
  // exempted here, and both are METHODS on `electron/services/databaseService.ts`
  // — outside `DB_DIR`, which is `electron/services/db`. This guard has never
  // enumerated them, so those two exemptions were inert for their whole life.
  //
  // A bare-name key hid that: nothing distinguishes "exempted and needed" from
  // "exempted and never seen". Re-keying to `file::function` made me write the
  // path down, and there was no path to write. Deleting them shrinks the
  // exemption surface, which is the safe direction.
  // BACKLOG-2990 chunk 5. Three DELETEs, and they ARE atomic — this guard cannot
  // see it, because the transaction is one module away in `services/` and
  // `namesCalledInsideATransaction` scans only `db/` for `dbTransaction(`.
  //
  // Its ONE caller is `forceStaging.forceSwapSteps.deleteLiveForceSet`, itself
  // called only from inside the `db.transaction()` callback in
  // `swapStagingIntoLive` (forceStaging.ts:453). Verified by enumerating every
  // reference to the symbol, not by reading the nearest one.
  //
  // WRAPPING IT WOULD BE REDUNDANT, not merely stylistically wrong. better-sqlite3
  // implements a nested `db.transaction()` as a SAVEPOINT, so the failure semantics
  // of THIS path are unchanged — measured on the real driver, an uncaught throw
  // inside the inner transaction rolls back to the savepoint, rethrows, and aborts
  // the outer swap, leaving the user's corpus untouched exactly as it does today.
  // What nesting WOULD change is what a FUTURE caller could do: it makes a
  // partial-swap-survives-an-error state reachable by catching, on the one path
  // whose job is not to lose the user's messages. Transaction shape belongs to
  // item 6, not to a text move.
  //
  // These three writes lived in `services/` before this chunk and were invisible
  // to a guard that enumerates `db/`. The move did not create the exposure; it
  // made it visible.
  //
  // BACKLOG-2960 RE-KEYED, not re-argued: the three DELETEs now live in the
  // SYNCHRONOUS TWIN `deleteLiveForceSetSync`, because the seam export
  // `deleteLiveForceSet` became a promise-returning wrapper and a
  // `db.transaction()` body cannot await. The exemption follows the writes. The
  // reasoning above is unchanged — same three DELETEs, same single call path,
  // same reason nesting would be wrong — and this map still holds two entries.
  "electron/services/db/macosForceSetSql.ts::deleteLiveForceSetSync":
    "atomic via swapStagingIntoLive's db.transaction() body in macOSMessagesImportService/forceStaging.ts, its only call path (body -> forceSwapSteps.deleteLiveForceSet -> this twin); nesting would convert a swap-aborting failure into a savepoint rollback",
  "electron/services/db/contactValueProvenanceBackfill.ts::relabelTypedContactValues":
    "called only from a migration — inside migration v60's migrate() at databaseService.ts:3276 — and EVERY migration is run by `const runInTransaction = currentDb.transaction(...)` at databaseService.ts:3513, verified by reading the caller, not inferred (BACKLOG-2569 re-checked these; they had drifted from :3231/:3468)",
};

/**
 * ===========================================================================
 * WHAT THE FIRST VERSION OF THIS GUARD GOT WRONG
 * ===========================================================================
 * It reported NINE unwrapped multi-write functions. **Six were false
 * positives.** The claim was made, filed and reported before any of the nine
 * was opened and read — the exact failure this whole feature exists to prevent,
 * committed by the guard meant to prevent it.
 *
 * (This paragraph said SEVEN until BACKLOG-2569. The seventh, `updateContactRole`,
 * was never a false positive — it was a REAL unwrapped multi-write that blind
 * spot 3 below hid. Reclassifying it corrected the headline to six.)
 *
 * Three blind spots produced them, all now fixed above:
 *
 *   1. **`db.transaction(...)` was not recognised as wrapping** — only the
 *      shared `dbTransaction(...)` helper was. `batchUpdateContactAssignments`
 *      was reported as the worst offender in the codebase (six writes) while
 *      having been transactional all along.
 *
 *   2. **Branch-exclusive writes were counted as sequential.** The upsert shape
 *      —  `if (existing) { UPDATE …; return; } INSERT …;`  — is two write
 *      STATEMENTS and never two WRITES. That accounted for
 *      `upsertEmailAttachmentMetadata`, `createLink`, `markContactAsImported`
 *      and `createEmail`.
 *
 *   3. **BACKLOG-2569 — one write regex, two different views of the body.**
 *      `writeCount` tested the JOINED body; `writesAreBranchExclusive` tested
 *      the SAME pattern line by line. A multi-line `UPDATE …\n SET …` matches
 *      the first and no single line of the second, so any function whose second
 *      write was multi-line was counted as multi-write and then silently
 *      cleared as branch-exclusive. It hid `updateContactRole` — two sequential
 *      unwrapped writes, listed under blind spot 2 above as though it were an
 *      upsert. Fixed by deriving both from one `WRITE_PATTERN` over one
 *      `stripComments()` view and ordering by character offset. The function
 *      itself was deleted (unreachable: no IPC handler, preload bridge or
 *      renderer caller); its shape survives as a transcribed fixture, because
 *      after the deletion that fixture is the only thing still proving this
 *      guard can catch the shape at all.
 *
 * A fourth was a reachability error no static rule would catch:
 * `relabelTypedContactValues` runs from a migration, and EVERY migration is
 * already wrapped by the runner at `databaseService.ts:3513`
 * (`currentDb.transaction(...)`). Established by reading the caller.
 *
 * **Two were real.** `deleteBySessionId` (fixed by BACKLOG-2480) and
 * `linkContactToTransaction` (fixed by BACKLOG-2543). `updateContactRole` was a
 * third, found only once blind spot 3 was closed.
 *
 * THE STANDING LESSON, since this guard exists to enforce it: **a tool that
 * reports a violation has not established one.** The list below is what a human
 * confirmed by opening the function, not what the scan emitted.
 */
/**
 * ===========================================================================
 * BACKLOG-2584 — KEYED `file::function`, AND WHAT MAY GO IN IT
 * ===========================================================================
 * This map was keyed by BARE NAME while `EXEMPT` above was re-keyed to
 * `file::function` by BACKLOG-2990 chunk 5. Both filters that read it — the
 * offender test's `exemptKey(f) in KNOWN_UNWRAPPED` and the shrink test's
 * `unwrapped().map(exemptKey)` — now use the same key, and they must be changed
 * together or the re-key is half-applied and the shrink test compares
 * `file::function` strings against bare names.
 *
 * The reason is the same one chunk 5 gave for `EXEMPT`, and it got stronger when
 * this guard's scan root widened to `electron/`. Measured at `0dca6beb1`:
 *
 *   electron/services/db  —  439 exported functions,  6 duplicate bare names
 *   electron/             — 1131 exported functions, 15 duplicate bare names
 *
 * `deleteLiveForceSet` — the exact name that motivated chunk 5 — is one of the
 * fifteen. A bare-name key across 1131 functions silences every namesake, and
 * this list went from 0 entries to a populated one in the same change.
 *
 * ---------------------------------------------------------------------------
 * WHAT MAY BE LISTED HERE — this is the rule, not a preference
 * ---------------------------------------------------------------------------
 * **An entry is a CONFIRMED REAL VIOLATION with a filed BACKLOG item, and it is
 * DELETED as that item ships.** A FALSE POSITIVE is never listed: it is fixed in
 * the heuristic, or exempted in `EXEMPT` above with a written reason under the
 * cap of 6.
 *
 * Stated because the widened root and the cite-an-item rule together create a
 * pressure that runs the wrong way — quieting a false positive by filing a bogus
 * item to cite. That is silencing by another route, and it is the failure
 * BACKLOG-3053 recorded: a known-list entry that made a refactor tidy while
 * preserving a live data-integrity defect.
 *
 * Every entry cites the SHA it was measured at, because a `file::function` key
 * survives line drift but the LINE NUMBERS inside these reason strings do not.
 * Re-derive them; do not hand-copy them forward.
 *
 * ---------------------------------------------------------------------------
 * THIS LIST IS A LOWER BOUND, NOT A COMPLETE SET
 * ---------------------------------------------------------------------------
 * A populated list invites the reading "these are the unwrapped multi-writes."
 * It is not. Two measured floors sit under it, and while either is open the
 * thirteen is a FLOOR:
 *
 *   - `captureBody` truncates on an inline object type in a parameter list, so
 *     some multi-write functions are counted as ZERO-write and can never appear
 *     here. 56 functions have the shape, 4 are multi-write, at `0dca6beb1`.
 *     Tracked by BACKLOG-3225.
 *   - Call-token counting is scoped OUT of `db/`. That is a floor with a
 *     measured size, not a proof of absence: turning it on surfaces EIGHT more,
 *     all real (a raw write plus a non-exported local helper that writes), of
 *     which six had no filed item until BACKLOG-3226. Tracked there.
 *
 * Add a floor here when one is found; do not let the list's completeness be
 * assumed from its length.
 */
const KNOWN_UNWRAPPED: Record<string, string> = {
  // ==========================================================================
  // POPULATED BY BACKLOG-2584, from THIS GUARD'S OWN OUTPUT at `0dca6beb1`.
  // ==========================================================================
  // Not from a scratch harness: the list was emptied, the suite run, and these
  // thirteen are the offender test's own failure output. Each was then opened
  // and read before being classified — a tool that reports a violation has not
  // established one.
  //
  // Each damage string is TRANSCRIBED from its item's "Crash leaves" section,
  // not paraphrased. Line numbers here are as measured at `0dca6beb1` and drift;
  // the `file::function` keys do not.

  // --- BACKLOG-2546: DISCHARGED by the login-provisioning transaction -------
  // The three entries that were here (googleAuthHandlers::handleGoogleLogin,
  // ::handleGoogleCompleteLogin, microsoftAuthHandlers::handleMicrosoftLogin)
  // are deleted because their bug is fixed: all four login paths now commit the
  // user, token and session rows in one transaction owned by
  // `services/loginProvisioningService.ts`.
  //
  // READ THIS BEFORE TRUSTING THE DELETION. It is evidenced by the DIFF and by
  // the forced-crash suite `loginProvisioningAtomicity-2546.test.ts`, NOT by
  // this guard. This guard cannot tell "fixed" from "made invisible" here: the
  // fix turns five db/ exports into delegates, which drops them from
  // `dbLayerWriters()`, so the same three entries would also have to be deleted
  // if the handlers had been left completely untouched (measured). That is
  // BACKLOG-3238.

  // --- BACKLOG-2550 (critical, open): message link pointer vs junction ----
  "electron/services/messageMatchingService.ts::autoLinkTextsToTransaction":
    "BACKLOG-2550 @0dca6beb1 (:386, junction INSERT loop then one bulk messages UPDATE): junction rows with messages.transaction_id still NULL, so the message is re-offered as unlinked and the re-link is blocked only by the unique index",
  "electron/services/messageMatchingService.ts::autoLinkEmailsToTransaction":
    "BACKLOG-2550 @0dca6beb1 (:645, same shape on the email path): the pointer set with no junction row leaves the message invisible to every reader that joins through communications, while the messages table claims it is linked",
  "electron/services/autoLinkService.ts::expandAttachedThreadsForUser":
    "BACKLOG-2550 @0dca6beb1 (:1501, linkMessageToTransaction + createCommunicationReference): a thread expansion that half-ran leaves some messages of one attached conversation linked and the rest not, which reads to the user as a conversation that imported incompletely",

  // --- BACKLOG-2845 (open): review queue approve/reject -------------------
  "electron/services/reviewStateService.ts::approveReviewItems":
    "BACKLOG-2845 @0dca6beb1 (:1018, confirmEmailLinksByEmailIds + resolveLegacyTwins + createThreadCommunicationReference, in a for loop over itemIds): a crash part-way through approving a selection leaves some emails promoted and the rest still queued, with the pending_review row deleted for only some of them",
  "electron/services/reviewStateService.ts::rejectReviewItems":
    "BACKLOG-2845 @0dca6beb1 (:1071, addIgnoredCommunication + resolveLegacyTwins): a failure after the suppression row is written leaves the legacy address_missing link alive — the email is hidden from future discovery but still counted by getReviewState(), so the Complete gate never clears",

  // --- Filed by BACKLOG-2584 itself, before being listed here -------------
  "electron/handlers/contactHandlers.ts::ipc:contacts:import":
    "BACKLOG-3220 @1cd39acd0 (:1954, markContactAsImported + linkImportedContact across three for loops, PLUS backfillContactEmails + backfillContactPhones on the same path — 4 counted writes became 6 when BACKLOG-3235 restored the two twin facades to the writer set; zero dbTransaction anywhere in the handler): some contacts marked imported with their crosswalk link written and others marked imported with no link, so those source rows are never suppressed and re-offer on the next pass — and now also a contact whose emails were backfilled while its phones were not",

  // --- BACKLOG-3259 (open): surfaced BY BACKLOG-3235's own fix ------------
  // Listed, never fixed: the widening PR must list what it surfaces or CI is
  // red and it cannot land; fixing a surfaced defect belongs to its own item.
  "electron/handlers/contactHandlers.ts::ipc:contacts:create":
    "BACKLOG-3259 @1cd39acd0 (:2547, createContact :2717 + backfillContactEmails :2774 + backfillContactPhones :2778, zero dbTransaction in the handler): reachable WITHOUT a crash — the catch arm at :2801-2815 returns { success: false } with no compensating delete, so an ordinary throw from either backfill (a malformed email or phone is enough) leaves the contact row committed and visible in Clients & Contacts holding the name and only some of the addresses the user typed, while the UI tells them it was not created; the user retries and gets a SECOND contact",
  "electron/handlers/emailLinkingHandlers.ts::ipc:transactions:link-emails":
    "BACKLOG-3221 @0dca6beb1 (:169, createCommunication + createEmail unwrapped): a communications junction row whose email_id points at an emails row that was never written, so the email is invisible to every reader that joins through it — or the inverse, an email row with no link, absent from the transaction it was just attached to",
  "electron/handlers/messageImportHandlers.ts::ipc:messages:import-macos":
    "BACKLOG-3222 @0dca6beb1 (:148, backfillContactCommunicationDates :278 + backfillPhoneLastMessageTable :302): contacts showing a refreshed last-communication date while phone_last_message still holds the pre-import value, so the contact list and the phone-keyed views disagree until the next successful import",

  // ORIGINAL NOTE, kept because it records why this list was empty and why the
  // nine-entry version of it was discarded rather than merged:
  // EMPTY — and that is the honest result. Six of the nine this list started
  // with were false positives (see the correction above); `deleteBySessionId`
  // was fixed by BACKLOG-2480, `linkContactToTransaction` by BACKLOG-2543, and
  // `updateContactRole` — mislabelled a false positive, actually real — was
  // deleted as unreachable by BACKLOG-2569.
  //
  // MERGE NOTE: the incoming side of this conflict was the original nine-entry
  // list. It is deliberately discarded, not merged — every entry in it was
  // either fixed or never a violation, and re-adding one would fail the
  // "may only shrink" test below.
};

interface Fn {
  file: string;
  name: string;
  line: number;
  body: string;
  /**
   * Predicate for "this identifier is a db-layer write", or `null` INSIDE the
   * db layer. See `dbLayerWriters` for why `db/` keeps the raw-SQL rule.
   */
  isDbWriterCall: ((name: string) => boolean) | null;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.includes(entry.name)) continue;
      out.push(...sourceFiles(p));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Brace-matched body of the function starting at `startLine`.
 *
 * ===========================================================================
 * STATED FLOOR — BACKLOG-3225, FOUND BY A CONTROL THAT DID NOT GO RED
 * ===========================================================================
 * This matches braces from the DECLARATION line, so a parameter list holding an
 * INLINE OBJECT TYPE closes the capture before the body opens:
 *
 *     export function f(row: { a: string; b: string }): void {   // capture ends
 *       dbRun(`INSERT INTO x ...`);                              // never seen
 *
 * The function then reads as having NO BODY: zero writes, zero transaction.
 *
 * Measured at `0dca6beb1` across scan root `electron/`: 56 exported functions
 * have a truncated capture, and FOUR have >= 2 SQL writes in their true body
 * while this guard counts 0 — `contactDbService.ts:520 createContactsBatch`,
 * `:2729 syncContactEmails`, `:2825 syncContactPhones`, and
 * `emailSyncStateService.ts:104 updateCachedBounds`. All four are in `db/`, so
 * this floor predates the widened root; it is not a cost of BACKLOG-2584.
 *
 * Severity today is ONE defect: the first three are self-wrapped and would not
 * be offenders if visible, and `updateCachedBounds` is already filed in
 * BACKLOG-2554. Severity tomorrow is not bounded — any new multi-write written
 * with an inline-typed parameter is invisible, and 56 functions already have the
 * shape.
 *
 * Filed as BACKLOG-3225 with the fix (capture from the matching `)` of the
 * parameter list). Not fixed here: this PR is capped at two heuristic changes
 * and already carries both.
 *
 * HOW IT WAS FOUND, because the method matters more than the bug: control 5 of
 * BACKLOG-2584 planted a deliberately unwrapped multi-write and the guard stayed
 * GREEN. The rule is to suspect the fixture before the control — the planted
 * function had an inline object type in its parameters. The plant was wrong AND
 * the guard was wrong, and only chasing the silent control found the second one.
 */
function captureBody(lines: string[], startLine: number): string {
  let depth = 0;
  let started = false;
  const buf: string[] = [];
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    buf.push(line);
    for (const ch of line) {
      if (ch === "{") {
        depth++;
        started = true;
      } else if (ch === "}") {
        depth--;
      }
    }
    if (started && depth <= 0) break;
  }
  return buf.join("\n");
}

/**
 * An `ipcMain.handle(...)` registration as its own unit, captured by PARENTHESIS
 * span rather than by brace matching.
 *
 * BACKLOG-2584: brace matching is wrong here in both directions. A registrar
 * function's body brace-matches every handler it registers, so
 * `registerContactHandlers` reads as one function issuing eight writes — the
 * headline is then a function that does not exist. And a ONE-LINE registration
 * (`ipcMain.handle("x", handlerFn);`) contains no brace at all, so a
 * brace-matched capture runs on into the FOLLOWING handlers and reports several
 * registrations with identical write sets. Both were live in an earlier
 * measurement of this task; three `sharedAuthHandlers` rows were the same body.
 *
 * Reading the channel from the `handle(` line alone is also wrong: at
 * `0dca6beb1` only 80 of 323 registrations put the channel on that line, so 243
 * would go unenumerated — 75% of the IPC surface, silently.
 *
 * So: track paren depth from `handle(`. If a `{` opens first, the unit is that
 * block. If the paren closes with no block, the handler was registered BY NAME
 * and the identifier is resolved to its declaration in the same file.
 */
function captureHandlerUnit(
  lines: string[],
  startLine: number
): { body: string | null; channel: string | null; refName: string | null } {
  let paren = 0;
  let sawParen = false;
  let brace = 0;
  let sawBrace = false;
  const buf: string[] = [];
  let flat = "";
  const startCol = lines[startLine].indexOf("ipcMain.handle(");
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    buf.push(line);
    flat += line + " ";
    for (let j = i === startLine ? startCol : 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === "(") {
        paren++;
        sawParen = true;
      } else if (ch === ")") {
        paren--;
        if (sawParen && paren <= 0 && !sawBrace) {
          const m = /ipcMain\.handle\(\s*["'`]([^"'`]+)["'`]\s*,\s*([A-Za-z0-9_.]+)\s*\)/.exec(flat);
          return { body: null, channel: m ? m[1] : null, refName: m ? m[2] : null };
        }
      } else if (ch === "{") {
        brace++;
        sawBrace = true;
      } else if (ch === "}") {
        brace--;
        if (sawBrace && brace <= 0) {
          const m = /ipcMain\.handle\(\s*["'`]([^"'`]+)/.exec(flat);
          return { body: buf.join("\n"), channel: m ? m[1] : null, refName: null };
        }
      }
    }
  }
  return { body: null, channel: null, refName: null };
}

/**
 * Every function exported from `electron/services/db` that issues at least one
 * SQL write in its own body — the ground truth the composition rule stands on.
 * 114 of 439 at `0dca6beb1`.
 *
 * STATED FLOOR: this is derived from body TEXT, so a db-layer function that
 * writes through a hoisted SQL constant is missing from it. Exactly one is, at
 * `0dca6beb1` — `emailSyncSql.ts:263 clearSyncCursor`, which runs
 * `dbRun(CLEAR_SYNC_CURSOR_SQL, ...)` against a constant declared at :148. The
 * count is written down so the floor can be re-measured rather than assumed.
 *
 * A builder that RETURNS SQL rather than executing it is also in this set —
 * `claimMessagesForTransactionSql09` builds a `SafeSql`. A builder call is not
 * itself a write, and a builder-plus-executor pair for one logical write counts
 * as two. That is why every reported offender is dispositioned by reading the
 * function, never by trusting this set.
 */
/**
 * The exported `db/` function declarations of ONE file, as name + captured body.
 *
 * Split out of `dbLayerWriters` by BACKLOG-3235 so `writersFrom` below is a PURE
 * function over declarations and a fixture can run the real derivation over a
 * transcribed source string. Before the split there was no way to test the
 * writer-set rule at all: `dbLayerWriters` read the disk, so every fixture in
 * this file could only ever exercise what happens AFTER the set is built.
 */
function dbWriterDeclsIn(lines: string[]): { name: string; body: string }[] {
  const decls: { name: string; body: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/.exec(lines[i]);
    if (!m) continue;
    decls.push({ name: m[1], body: captureBody(lines, i) });
  }
  return decls;
}

/**
 * ===========================================================================
 * BACKLOG-3235 — A WRITER THAT MOVED INTO A SYNCTWIN IS STILL A WRITER
 * ===========================================================================
 * Pass 1 is the raw-SQL rule, unchanged. Pass 2 is the one heuristic change
 * this PR carries.
 *
 * THE DEFECT. The syncTwin recipe (`electron/__tests__/syncTwin.guard.test.ts`)
 * moves a writer's body into `<name>Sync` and leaves `<name>` a one-line
 * delegate holding NO SQL. Under pass 1 alone the promise-returning name drops
 * out of this set, and because call sites are resolved by BARE NAME, every
 * caller outside `db/` silently stops counting that write. The guard's coverage
 * shrank as the epic that depends on it advanced.
 *
 * THE RULE. A `db/` export whose own body holds no SQL, whose `<name>Sync`
 * sibling IS a pass-1 writer, and whose body REFERENCES that sibling, is a
 * writer. Two passes over the pass-1 set — no fixpoint, so the result does not
 * depend on declaration order.
 *
 * This is a RESTORATION, not a wider predicate. Measured at `1cd39acd0`:
 * `writersFrom(decls) minus pass-1-only` is set-equal, element for element, to
 * the seven names BACKLOG-3238 enumerates. It makes writer-set membership
 * INVARIANT under the syncTwin refactor and changes nothing else.
 *
 * POPULATION, measured at `1cd39acd0`: EIGHT `db/` wrappers hold no SQL and
 * delegate to a writing twin; SEVEN of them are de-detected. The eighth,
 * `macosForceSetSql.ts:284 deleteLiveForceSet`, is masked — the UNRELATED
 * `emailForceSetSql.ts:201 deleteLiveForceSet` runs a `DELETE FROM emails` and
 * keeps the bare name in the pass-1 set, so pass 2 skips it at the first
 * `continue`. Its callers count a write for the wrong reason. The seven is
 * therefore conditional on that function: give IT a twin and the eighth name
 * de-detects too, and pass 2 restores it. Stated with its condition so a later
 * count of eight reads as the condition being met, not as drift.
 *
 * WHY THE BODY CHECK IS HERE THOUGH IT CHANGES NOTHING TODAY. Measured: with
 * and without it the writer set is 122 and the offender set identical, at this
 * SHA. It is not decoration. `base` is a set of BARE NAMES over 434 unique
 * names with SIX measured duplicates (`columnList`, `createStagingTable`,
 * `deleteLiveForceSet`, `dropStagingTable`, `mirrorStagingIndexes`,
 * `selectExistingExternalIds`). Without the body check, a `foo` in one file
 * pairs with a writing `fooSync` in ANOTHER by naming coincidence alone, with no
 * evidence that `foo` delegates to anything. This guard has been burned by
 * bare-name matching twice already — EXEMPT's re-key to `file::function`, and
 * `deleteLiveForceSet` again in the measurement above. The check is pinned by
 * `a db/ export that does not reference its twin is not admitted`; delete the
 * check and that test goes red.
 *
 * IT MUST NOT BE KEYED ON `Promise.resolve`. Measured: only THREE of the seven
 * use `return Promise.resolve(xSync(...))`. The other four are
 * `export async function x(...) { return xSync(...); }` with no `Promise.resolve`
 * at all. A shape check on the ruled wrapper text would miss four of seven.
 *
 * IT PROTECTS A FIXTURE. BACKLOG-3238 records that 2546's `updateUser` twin
 * flips the `THREE_HANDLERS_ONE_WRITE_EACH` fixture below from [1,1,1] to
 * [0,1,1]. Pass 2 keeps `updateUser` in the set once that twin lands, so the
 * fixture stays green rather than needing an edit.
 *
 * Cited by NAME, deliberately. This line carried a line number through three
 * hands — BACKLOG-3238 measured it at `bea54238f`, the plan review repeated it,
 * and it landed here as `:1324` — while the fixture is at `:1253` at
 * `1cd39acd0` and moves again with every edit to this file. A number that names
 * a location INSIDE the file citing it stales itself; a name does not.
 *
 * STATED FLOORS — measured sizes, not absences. None of these is fixed here.
 *
 *   1. NON-TWIN DELEGATION, seven names at `1cd39acd0`:
 *      `createTransactionWithContactsSync`, `fullSync`,
 *      `getContactsSortedByActivity`, `getOrCreateLLMSettings`,
 *      `syncContactsBySource`, `syncGoogleContacts`, `upsertFromOutlook`.
 *      A `db/` export holding no SQL that reaches a writer through a call which
 *      is NOT its `<name>Sync` twin stays out of this set. These are REAL
 *      exposures under this guard's own rule — a caller invoking one of them
 *      plus one more write can half-happen — not artefacts. Admitting them is a
 *      WIDER PREDICATE with its own unfiled population, which is why it is not
 *      done here. BACKLOG-3238 is narrowed to exactly these seven and stays
 *      OPEN. Measured consequence today: one unit,
 *      `contactHandlers.ts ipc:contacts:get-available`.
 *
 *   2. BARE-NAME MASKING: `macosForceSetSql.ts:284 deleteLiveForceSet`, above.
 *      Sibling of BACKLOG-3223's clearing-set floor.
 *
 *   3. BACKLOG-3225 TRUNCATION hides FIVE `db/` writers from pass 1, so pass 2
 *      cannot pair with them either: `batchInsertMessages`,
 *      `createContactsBatch`, `syncContactEmails`, `syncContactPhones`,
 *      `updateCachedBounds`. (3225's body names four on a ">= 2 writes" test;
 *      writer-set membership needs only one, so the number here is five.)
 *      Measured at `1cd39acd0`: 12 `db/` exports truncate, and ZERO of the ten
 *      same-file twin pairs do — on either side — so 3225 does not blind pass 2
 *      at this SHA.
 *
 * `followTwins` exists ONLY so a fixture can derive both sets from one
 * declaration list and assert the DIFFERENCE. No production caller passes it;
 * `dbLayerWriters()` takes the default.
 */
function writersFrom(
  decls: { name: string; body: string }[],
  followTwins = true
): Set<string> {
  const base = new Set<string>();
  for (const d of decls) if (writeCount(d.body) >= 1) base.add(d.name);
  if (!followTwins) return base;

  const writers = new Set(base);
  for (const d of decls) {
    if (base.has(d.name)) continue;
    if (!base.has(d.name + "Sync")) continue;
    if (!new RegExp("\\b" + d.name + "Sync\\s*\\(").test(stripComments(d.body))) continue;
    writers.add(d.name);
  }
  return writers;
}

function dbLayerWriters(): Set<string> {
  const decls: { name: string; body: string }[] = [];
  for (const file of sourceFiles(DB_DIR)) {
    decls.push(...dbWriterDeclsIn(fs.readFileSync(file, "utf8").split("\n")));
  }
  return writersFrom(decls);
}

/**
 * The units of one file: exported functions, plus each `ipcMain.handle`
 * registration. A registrar function is dropped once its handlers are units in
 * their own right — otherwise the same writes are counted twice, at a
 * granularity that names no real function.
 *
 * Exported as its own function so a fixture can run the real enumeration over a
 * transcribed source string. That is what makes the "we do NOT see a
 * non-violation" control possible at all.
 */
function unitsInFile(rel: string, lines: string[], dbWriters: Set<string>): Fn[] {
  const inDbLayer = rel.startsWith("electron/services/db/");

  // Declarations in this file, for identifier-registered handlers and for the
  // local-helper closure below.
  const declared = new Map<string, { line: number; body: string; exported: boolean }>();
  for (let i = 0; i < lines.length; i++) {
    const m = /^(export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/.exec(lines[i]);
    if (m) {
      declared.set(m[2], { line: i + 1, body: captureBody(lines, i), exported: Boolean(m[1]) });
    }
  }

  // A NON-EXPORTED helper in the same file that reaches a db-layer write counts
  // as a write at its call site. Depth 1, no propagation into exported units:
  // full closure makes every caller-of-two-callers an offender, and an async
  // orchestrator cannot be fixed with a `dbTransaction` anyway.
  //
  // This is what sees BACKLOG-2549: `markFirstExport` in
  // `transactionExportHandlers.ts` is exactly this shape, wrapping
  // `stampFirstExportedAt`.
  const localWriters = new Set<string>();
  for (const [name, decl] of declared) {
    if (decl.exported) continue;
    let reaches = writeCount(decl.body) >= 1;
    if (!reaches) {
      for (const call of stripComments(decl.body).matchAll(/\b([A-Za-z0-9_]+)\s*\(/g)) {
        if (call[1] !== name && dbWriters.has(call[1])) {
          reaches = true;
          break;
        }
      }
    }
    if (reaches) localWriters.add(name);
  }

  // Inside `db/` the raw-SQL rule stands and call tokens are OFF. `db/` is the
  // leaf layer: its functions hold the SQL, so a uniform rule would have them
  // counting each other, and a writer's own declaration line matches its own
  // call pattern.
  //
  // MEASURED, not assumed. With call tokens ON inside `db/` and own-name
  // stripping applied, the offender set goes 13 -> 21 at `0dca6beb1`. The eight
  // additions are all in `db/`: communicationDbService.ts createCommunication
  // (:80), deleteCommunication (:333), deleteCommunicationByMessageId (:367),
  // createCommunicationReference (:732), createThreadCommunicationReference
  // (:1017), deleteCommunicationByThread (:1061), and emailSyncStateService.ts
  // recordSyncSuccess (:158) / recordSyncFailure (:173).
  //
  // The delta is NOT noise: the last two are named in BACKLOG-2554 as "two
  // unwrapped statements" already. They are invisible to the raw-SQL rule
  // because one of each pair goes through a hoisted SQL constant. So the
  // scoped-out decision is a FLOOR, not a proof of absence, and the floor has a
  // measured size. Not adopted here — eight new dispositions inside the
  // write-densest directory in the repo is its own task, and SR ruled it comes
  // back for review rather than being absorbed.
  //
  // SO THIS IS A FLOOR WITH A MEASURED SIZE, NOT A PROOF OF ABSENCE. SR
  // decomposed the eight and they are real, not artifacts of the uniform rule:
  // the six in communicationDbService.ts are a raw write plus a call to
  // `updateTransactionThreadCountInternal` (:1236), a non-exported local helper
  // holding its own UPDATE. Two are filed in BACKLOG-2554; the six are filed as
  // BACKLOG-3226, which also carries the rule change. Do not read the scoped-out
  // decision as "nothing is there".
  const isDbWriterCall = inDbLayer
    ? null
    : (name: string) => dbWriters.has(name) || localWriters.has(name);

  const found: Fn[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/ipcMain\.handle\s*\(/.test(lines[i])) {
      const handler = captureHandlerUnit(lines, i);
      if (handler.body) {
        found.push({
          file: rel,
          name: `ipc:${handler.channel ?? "<unnamed>"}`,
          line: i + 1,
          body: handler.body,
          isDbWriterCall,
        });
      } else if (handler.refName) {
        const base = handler.refName.split(".").pop() as string;
        const decl = declared.get(base);
        if (decl) {
          found.push({ file: rel, name: base, line: decl.line, body: decl.body, isDbWriterCall });
        }
      }
      continue;
    }
    const m = /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/.exec(lines[i]);
    if (m) {
      found.push({ file: rel, name: m[1], line: i + 1, body: captureBody(lines, i), isDbWriterCall });
    }
  }

  const registrars = new Set(
    found
      .filter((u) => !u.name.startsWith("ipc:") && /ipcMain\.handle\s*\(/.test(u.body))
      .map((u) => `${u.file}:${u.line}`)
  );
  const seen = new Set<string>();
  return found.filter((u) => {
    const key = `${u.file}:${u.line}`;
    if (registrars.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scanUnits(): Fn[] {
  const dbWriters = dbLayerWriters();
  const units: Fn[] = [];
  for (const file of sourceFiles(SCAN_ROOT)) {
    const rel = path.relative(REPO_ROOT, file).split(path.sep).join("/");
    units.push(...unitsInFile(rel, fs.readFileSync(file, "utf8").split("\n"), dbWriters));
  }
  return units;
}

/**
 * Write statements in a body, counted on SQL keywords at the start of a
 * statement. `strip` removes line comments first so a commented-out INSERT in
 * an explanation does not count — several of these files carry long comments
 * quoting the SQL they replaced.
 */
/**
 * ONE pattern, used by EVERY heuristic below.
 *
 * BACKLOG-2569: it used to be written out twice — and the two copies were
 * applied to two different VIEWS of the function body (`writeCount` to the
 * joined body, `writesAreBranchExclusive` line by line). A multi-line
 * `UPDATE …\n SET …` matches the first and not the second, so a function whose
 * second write was multi-line was silently cleared. Sharing the source string
 * is not cosmetic: it is what makes that divergence impossible to re-introduce
 * without deleting this constant.
 */
const WRITE_PATTERN = String.raw`\b(INSERT\s+(OR\s+\w+\s+)?INTO|UPDATE\s+[a-z_]+\s+SET|DELETE\s+FROM)\b`;

/**
 * ONE view of the body, used by EVERY heuristic below — the other half of the
 * BACKLOG-2569 fix. Drops lines that OPEN with a comment marker so a
 * commented-out INSERT in an explanation does not count; several of these files
 * carry long comments quoting the SQL they replaced.
 */
function stripComments(body: string): string {
  return body
    .split("\n")
    .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
    .join("\n");
}

function writeCount(body: string): number {
  const matches = stripComments(body).match(new RegExp(WRITE_PATTERN, "gi"));
  return matches ? matches.length : 0;
}

/**
 * ONE pattern for "this text opens a `dbTransaction`", used by BOTH
 * `wrapsItself` and `namesCalledInsideATransaction` — the same
 * one-source-string discipline BACKLOG-2569 imposed on `WRITE_PATTERN`, and for
 * the same reason: these two were written out separately and drifted together.
 *
 * ===========================================================================
 * BACKLOG-2584 — THE GENERIC FORM WAS NEVER MATCHED
 * ===========================================================================
 * Both sites used to test `/\bdbTransaction\s*\(/`, which does NOT match
 * `dbTransaction<UnlinkOutcome>(` — the type argument sits between the name and
 * the paren. Executed both forms: plain -> true, generic -> FALSE.
 *
 * Inside `db/` that was inert, because the only `dbTransaction<` occurrence
 * there is the DECLARATION at `core/dbConnection.ts:287`. It became
 * load-bearing the moment this guard's scan root widened past `db/`: six call
 * sites live in five production files outside it, and five of the six use the
 * generic form (measured at `0dca6beb1`) —
 *
 *   electron/handlers/contactHandlers.ts:2884        dbTransaction(() => {
 *   electron/services/contactProvenance.ts:246       dbTransaction<UnlinkOutcome>(
 *   electron/services/contactCompare.ts:1166         dbTransaction<ConfirmSourcesOutcome>(
 *   electron/services/contactLinkReview.ts:322,:410  dbTransaction<ReviewDecisionOutcome>(
 *   electron/services/contactManualLink.ts:294       dbTransaction<LinkSourceOutcome>(
 *
 * — so the widened scan would have reported four CORRECTLY ATOMIC wrappers as
 * unwrapped. Under this guard's rule that every `KNOWN_UNWRAPPED` entry cites a
 * filed item, those four false positives could only have been quieted by filing
 * four bogus items. Fixing the regex is a PRECONDITION of widening, not an
 * improvement shipped alongside it.
 *
 * STATED FLOOR, not fixed: `(?:<[^>]*>)?` cannot match a NESTED generic —
 * `dbTransaction<Map<string, number>>(` reads as unwrapped, measured. There are
 * ZERO nested-generic call sites at `0dca6beb1`, so this is latent. Closing it
 * needs a bracket-matching parse, which is a different task.
 */
const TRANSACTION_CALL = String.raw`\bdbTransaction\s*(?:<[^>]*>)?\s*\(`;

function wrapsItself(body: string): boolean {
  // `dbTransaction(...)` is the shared helper. `db.transaction(...)` is
  // better-sqlite3's own API, used directly where a function already holds a
  // handle — MISSING IT WAS A BUG IN THE FIRST VERSION OF THIS GUARD, and it
  // reported `batchUpdateContactAssignments` as the worst offender in the
  // codebase when that function has been transactional all along.
  //
  // BACKLOG-2569: read the STRIPPED body, so a comment merely mentioning
  // `.transaction(` cannot clear a function that never opens one — the same
  // defect class as the multi-line blind spot this task fixes. Measured at 0
  // classification changes across all 316 exported functions when introduced.
  // KNOWN LIMITATION, stated here rather than only in the PR: stripComments
  // drops lines that OPEN with a comment marker, so a TRAILING
  // `// … .transaction( …` comment still evades this. Closing that needs a real
  // comment/string-literal-aware parse, which is a different task.
  const src = stripComments(body);
  return new RegExp(TRANSACTION_CALL).test(src) || /\b\w+\.transaction\s*\(/.test(src);
}

/**
 * A write that can only run when an earlier one did NOT — the upsert shape:
 *
 *     if (existing) { UPDATE …; return existing.id; }
 *     INSERT …;
 *
 * Two write statements, never two writes. Counting them textually is what made
 * the first version of this guard report four functions that cannot leave a
 * partial state.
 *
 * ===========================================================================
 * BACKLOG-2584 — THE RULE AS IMPLEMENTED, BECAUSE IT USED TO BE STATED WRONG
 * ===========================================================================
 * This paragraph used to read "a `return` sits between the writes at the same
 * or shallower brace depth" while the implementation COMPUTED NO DEPTH AT ALL.
 * One function, two accounts — the BACKLOG-2569 class, inside the very function
 * 2569 fixed. Two real false clears followed, both read in source, not inferred:
 *
 *   - `messageMatchingService.ts:386 autoLinkTextsToTransaction` —
 *     `createCommunicationReference` at :483 runs inside a `for` loop, then
 *     `dbRun(claimMessagesForTransactionSql09(...))` at :516 runs after it.
 *     Strictly sequential. Cleared by a `} else {` at :493 closing an unrelated
 *     inner `if (refId)` — a SIBLING of the first write, not its branch.
 *   - `autoLinkEmailsToTransaction` (:645), the same shape at :776/:809.
 *
 * THE RULE, exactly as the code below implements it. An exit clears two writes
 * when, between them, there is either:
 *
 *   (a) a `return` — at ANY depth, because it leaves the function; or
 *   (b) a `} else` whose depth is STRICTLY LESS than the preceding write's,
 *       i.e. the write was inside the branch that the `else` closes.
 *
 * Strictly less, not "at or below". The upsert's `return` sits at the SAME
 * depth as the write above it, and an `} else` at the same depth as a write is
 * the sibling case that produced both false clears. Two rules because a
 * `return` and an `} else` mean different things, and one condition covering
 * both is what let the sibling case through.
 *
 * MEASURED, not assumed: 0 classification changes across all 439 exported
 * functions in `electron/services/db` at `0dca6beb1` — the bar BACKLOG-2569 set
 * for its own change to this function. The upsert shape and the
 * one-write-per-branch shape both still clear; the fixtures below pin that.
 *
 * STATED FLOOR, not fixed (BACKLOG-2584, cut from that task's scope by SR): a
 * `return` INSIDE A CLOSURE still clears at any depth. Two writes separated by
 * a `.filter((x) => { return x.ok; })` read as branch-exclusive. Pre-existing —
 * the old depth-blind rule cleared it too, so this is not a regression — but it
 * is a floor, not a guarantee. Closing it needs the exits to be attributed to
 * the function they actually leave.
 *
 * ===========================================================================
 * BACKLOG-2569 — WHY THIS READS THE JOINED BODY AND NOT LINES
 * ===========================================================================
 * This used to `split("\n")` and test each line. `writeCount` above tested the
 * SAME pattern against the JOINED body. A multi-line statement —
 *
 *     UPDATE transaction_contacts
 *     SET role = ?
 *
 * — matches the joined view (`\s+` spans the newline) and matches NO SINGLE
 * LINE. So `writeCount` saw 2 writes while this function saw 1, concluded
 * "one write is trivially exclusive", and cleared the function. That is
 * exactly how `updateContactRole` (two sequential unwrapped writes) passed
 * this guard. Both heuristics now derive from `WRITE_PATTERN` over
 * `stripComments(body)`, and ordering is by CHARACTER OFFSET rather than line
 * index — which is what makes a multi-line write positionable at all.
 */
/**
 * Brace depth at every character offset. A `{` reports the depth it OPENS; a
 * `}` reports the depth it CLOSES, so the character AFTER a `}` is already at
 * the outer depth. That is what lets `} else` be read at the depth of the `if`
 * it belongs to rather than the depth of the block it just closed.
 */
function braceDepths(src: string): number[] {
  const depths = new Array<number>(src.length).fill(0);
  let cur = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") {
      cur++;
      depths[i] = cur;
    } else if (ch === "}") {
      depths[i] = cur;
      cur--;
    } else {
      depths[i] = cur;
    }
  }
  return depths;
}

/**
 * Every write in a body as an offset-ordered stream — the ONE view both
 * `unitWriteCount` and `writesAreBranchExclusive` read, for the reason
 * BACKLOG-2569 gave: two heuristics over two different views of one body is how
 * `updateContactRole` was silently cleared.
 *
 * A write is a raw SQL statement, or — outside `db/` — a CALL to a db-layer
 * writer. `selfName` is stripped so a function never counts its own declaration
 * line or its own recursion: `export function createLink(` matches
 * `\bcreateLink\s*\(`.
 */
function writeOffsets(
  src: string,
  isDbWriterCall: ((name: string) => boolean) | null,
  selfName: string | null
): { at: number; label: string }[] {
  const out: { at: number; label: string }[] = [];
  for (const m of src.matchAll(new RegExp(WRITE_PATTERN, "gi"))) {
    out.push({ at: m.index ?? 0, label: "<sql>" });
  }
  if (isDbWriterCall) {
    for (const m of src.matchAll(/\b([A-Za-z0-9_]+)\s*\(/g)) {
      if (selfName !== null && m[1] === selfName) continue;
      if (isDbWriterCall(m[1])) out.push({ at: m.index ?? 0, label: m[1] });
    }
  }
  return out;
}

/** Writes a unit issues, under the rule that applies to the layer it lives in. */
function unitWrites(unit: Fn): { at: number; label: string }[] {
  return writeOffsets(stripComments(unit.body), unit.isDbWriterCall, unit.name);
}

function writesAreBranchExclusive(
  body: string,
  isDbWriterCall: ((name: string) => boolean) | null = null,
  selfName: string | null = null
): boolean {
  const src = stripComments(body);
  const depths = braceDepths(src);

  // Writes and exits as one offset-ordered stream. A write at the same offset
  // as an exit sorts first, preserving the old `else if` precedence where a
  // line containing a write was never also read as an exit.
  const tokens: { at: number; isWrite: boolean; depth: number; isReturn: boolean }[] = [];
  for (const w of writeOffsets(src, isDbWriterCall, selfName)) {
    tokens.push({ at: w.at, isWrite: true, depth: depths[w.at] ?? 0, isReturn: false });
  }
  // Anchored per line via /m. `[ \t]*` NOT `\s*`, and `\}[ \t]*else` NOT
  // `\}\s*else`: under /m, `\s` spans newlines, which would let a `}` and an
  // `else` on separate lines register as an exit the original never accepted.
  // A LOOSENED exit anchor creates new masking — the opposite of this fix.
  for (const m of src.matchAll(/^[ \t]*(return\b|\}[ \t]*else\b)/gm)) {
    const at = m.index ?? 0;
    // Depth is read at the LAST character of the match, so for `} else` it is
    // the depth AFTER the `}` closed — the depth of the `if` this `else` pairs
    // with. For `return` the depth is where it stands.
    const depthAt = at + m[0].length - 1;
    tokens.push({
      at,
      isWrite: false,
      depth: depths[depthAt] ?? 0,
      isReturn: /return/.test(m[1]),
    });
  }
  tokens.sort((a, b) => a.at - b.at || (a.isWrite ? -1 : 1));

  let seenWrite = false;
  let lastWriteDepth = 0;
  let exitsSinceWrite: { depth: number; isReturn: boolean }[] = [];
  for (const t of tokens) {
    if (t.isWrite) {
      if (seenWrite) {
        // (a) a `return` leaves the function from any depth; (b) a `} else`
        // only separates the two writes if the earlier one was INSIDE the
        // branch it closes — strictly deeper than the `else` itself.
        const separated = exitsSinceWrite.some(
          (e) => e.isReturn || e.depth < lastWriteDepth
        );
        if (!separated) return false; // two writes, nothing exclusive between
      }
      seenWrite = true;
      lastWriteDepth = t.depth;
      exitsSinceWrite = [];
    } else if (seenWrite) {
      exitsSinceWrite.push({ depth: t.depth, isReturn: t.isReturn });
    }
  }
  return seenWrite;
}

/**
 * Every identifier called inside some `dbTransaction(() => { ... })` anywhere in
 * the scanned tree — rule (b), the sync-core pattern.
 *
 * BACKLOG-2584: this scans `SCAN_ROOT`, not `DB_DIR`, or a db-layer function
 * composed inside a HANDLER's transaction reads as unwrapped
 * (`contactHandlers.ts:2884` is such a transaction). The set goes 54 -> 81 bare
 * names at `0dca6beb1`.
 *
 * STATED FLOOR, and the sharp edge of this widening: this is a CLEARING set,
 * matched by BARE NAME against 1131 functions with 15 duplicate names. A
 * function wrapped by one caller and unwrapped by another is cleared by the
 * wrapped one.
 *
 * AUDITED, not assumed. Exactly TWO multi-write units are cleared ONLY by this
 * set at `0dca6beb1`, and both FAIL the reachability check that
 * `relabelTypedContactValues` gets in EXEMPT:
 *
 *   - `contactSourceValues.ts:233 applyLinkedSourceValues` — 5 call sites, and
 *     3 are NOT inside any transaction (`contactHandlers.ts:466`,
 *     `contactNameAutoLink.ts:621`, `contactSourceLinker.ts:823`). Two are
 *     (`contactLinkReview.ts:383`, `contactManualLink.ts:362`), and those two
 *     clear it everywhere.
 *   - `transactionContactDbService.ts:292 assignContactToTransactionSync` —
 *     reachable unwrapped through its own async seam at `:274`. Pre-existing:
 *     this was cleared under the `db/`-only scan too.
 *
 * Filed as BACKLOG-3223, which also carries the fix to this rule: clear a name
 * only when NO call path reaches it outside a transaction. Not fixed here — it
 * is a heuristic change beyond this task's budget, and neither function is
 * REPORTED today, which is precisely the point. A clearing set nobody audits is
 * how a real violation goes quiet.
 */
function namesCalledInsideATransaction(): Set<string> {
  const inside = new Set<string>();
  for (const file of sourceFiles(SCAN_ROOT)) {
    const src = fs.readFileSync(file, "utf8");
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (!new RegExp(TRANSACTION_CALL).test(lines[i])) continue;
      const block = captureBody(lines, i);
      for (const m of block.matchAll(/\b([A-Za-z0-9_]+)\s*\(/g)) inside.add(m[1]);
    }
  }
  return inside;
}

/**
 * ===========================================================================
 * BACKLOG-2569 — THE HEURISTICS, TESTED DIRECTLY
 * ===========================================================================
 * The scan below can only ever prove things about the tree as it stands today.
 * It cannot prove the RULE, and it could not have caught the bug this block
 * exists for: `updateContactRole` was cleared by a heuristic disagreement, so a
 * green scan was the SYMPTOM, not the evidence.
 *
 * These fixtures are TRANSCRIBED FROM REAL SOURCE at
 * `2910c79af82098f17067dbad0a35c1e33d0830a4`, never invented — an invented
 * fixture is how a control silently stops being a control (2026-08-04).
 *
 * They also outlive their subjects. `updateContactRole` is DELETED by
 * BACKLOG-2569, so fixture 1 is the only remaining proof that the guard can
 * still catch a multi-line sequential write at all.
 */
describe("the write heuristics themselves (BACKLOG-2569)", () => {
  // Transcribed verbatim from `updateContactRole`,
  // electron/services/db/transactionContactDbService.ts:433-454 @ 2910c79a,
  // DELETED by this task. Two sequential unwrapped writes: a multi-line
  // `UPDATE … \n SET …`, then a conditional single-line UPDATE, no exit between.
  const MULTILINE_THEN_SECOND_WRITE = `
  const sql = \`
    UPDATE transaction_contacts
    SET \${fields.join(", ")}
    WHERE transaction_id = ? AND contact_id = ? AND removed_at IS NULL
  \`;

  dbRun(sql, values);

  // Auto-update contact default_role
  if (updates.specific_role || updates.role) {
    dbRun(
      \`UPDATE contacts SET default_role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?\`,
      [updates.specific_role || updates.role, contactId]
    );
  }
`;

  // Transcribed from `createLink`, contactSourceLinkDbService.ts:244 @ 2910c79a.
  const UPSERT_SHAPE = `
  if (existing) {
    dbRun(\`UPDATE contact_source_links SET last_seen_at = ? WHERE id = ?\`, [now, existing.id]);
    return existing.id;
  }
  dbRun(\`INSERT INTO contact_source_links (id, contact_id) VALUES (?, ?)\`, [id, contactId]);
  return id;
`;

  // Transcribed from `markContactAsImported`, contactDbService.ts:765 @ 2910c79a.
  const IF_ELSE_ONE_WRITE_PER_BRANCH = `
  if (row) {
    dbRun(\`UPDATE contacts SET imported_at = ? WHERE id = ?\`, [now, row.id]);
  } else {
    dbRun(\`UPDATE contacts SET imported_at = ?, source = ? WHERE id = ?\`, [now, src, id]);
  }
`;

  // The multi-line half of the fixture above, standing alone.
  const LONE_MULTILINE_WRITE = `
  const sql = \`
    UPDATE transaction_contacts
    SET role = ?
    WHERE transaction_id = ?
  \`;
  dbRun(sql, values);
`;

  it("a multi-line write followed by a second sequential write is NOT branch-exclusive", () => {
    // THE BUG, pinned. Under the old line-by-line loop the multi-line
    // `UPDATE …\n SET …` matched no single line, so this returned `true` and
    // `updateContactRole` was cleared. Revert `writesAreBranchExclusive` to the
    // line-based version and THIS TEST IS THE ONE THAT GOES RED.
    expect(writesAreBranchExclusive(MULTILINE_THEN_SECOND_WRITE)).toBe(false);
    expect(writeCount(MULTILINE_THEN_SECOND_WRITE)).toBe(2);
  });

  it("the classic upsert (UPDATE + return, then INSERT) IS branch-exclusive", () => {
    expect(writesAreBranchExclusive(UPSERT_SHAPE)).toBe(true);
    expect(writeCount(UPSERT_SHAPE)).toBe(2);
  });

  it("if/else with one write per branch IS branch-exclusive", () => {
    expect(writesAreBranchExclusive(IF_ELSE_ONE_WRITE_PER_BRANCH)).toBe(true);
    expect(writeCount(IF_ELSE_ONE_WRITE_PER_BRANCH)).toBe(2);
  });

  it("a lone multi-line write is now VISIBLE to the branch-exclusive check (it was not before)", () => {
    // NOT a regression guard — this specifies CHANGED behaviour. Under the old
    // line-by-line loop a lone multi-line write matched no line, `seenWrite`
    // never set, and this returned FALSE. It now returns true (one write is
    // trivially exclusive). 22 single-write functions flip this way; all are
    // filtered out by `writeCount >= 2` before the check runs, so the offender
    // set is unaffected. This test is what pins that flip.
    expect(writesAreBranchExclusive(LONE_MULTILINE_WRITE)).toBe(true);
    expect(writeCount(LONE_MULTILINE_WRITE)).toBe(1);
  });

  // ==========================================================================
  // BACKLOG-2584 — a SIBLING `} else` is not an exclusivity witness
  // ==========================================================================
  // Control flow transcribed from `autoLinkTextsToTransaction`,
  // electron/services/messageMatchingService.ts:481-516 @ 0dca6beb1. The writes
  // are strictly sequential: N junction inserts inside the loop, then one bulk
  // messages UPDATE after it. The `} else {` at :493 closes `if (refId)`, which
  // is a SIBLING of the first write, not the branch containing it.
  //
  // The first write is shown as the SQL it actually executes, RESOLVED not
  // invented: the real line is `await createCommunicationReference(...)`, whose
  // body runs `dbRun(INSERT_COMMUNICATION_SQL, params)`, and that constant is
  // declared at electron/services/db/messageMatchingSql.ts:145-150 with exactly
  // the INSERT below. Resolving it keeps this heuristic test independent of the
  // call-token rule — and the need to resolve it at all is the hoisted-SQL floor
  // stated in the scan docblock.
  //
  // This fixture outlives its subject on purpose: BACKLOG-2550 will wrap this
  // path, and after that this is the only thing still proving the guard can
  // catch the shape. Same reason fixture 1 survives `updateContactRole`.
  const SIBLING_ELSE_BETWEEN_SEQUENTIAL_WRITES = `
  for (const match of filteredMatches) {
    try {
      dbRun(\`
        INSERT INTO communications (
          id, user_id, transaction_id, message_id,
          link_source, link_confidence, linked_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      \`, params);
      const refId = existingId ?? newId;

      if (refId) {
        result.linked++;
      } else {
        result.skipped++;
      }
    } catch (error) {
      result.errors.push(\`Failed to link message \${match.messageId}\`);
    }
  }

  if (result.linked > 0) {
    const linkedMessageIds = filteredMatches
      .slice(0, result.linked)
      .map((m) => m.messageId);

    dbRun(\`UPDATE messages SET transaction_id = ? WHERE id IN (?)\`, [transactionId, ...linkedMessageIds]);
  }
`;

  it("a SIBLING `} else` does not make two sequential writes exclusive (BACKLOG-2584)", () => {
    // THE SECOND BUG, pinned. Under the depth-blind rule any `} else` between
    // two writes cleared them, so this read as branch-exclusive and
    // `autoLinkTextsToTransaction` passed the guard. Revert the `} else` arm of
    // `writesAreBranchExclusive` to depth-blind and THIS TEST GOES RED.
    //
    expect(writesAreBranchExclusive(SIBLING_ELSE_BETWEEN_SEQUENTIAL_WRITES)).toBe(false);
  });

  it("an `} else` that DOES enclose the earlier write still clears it", () => {
    // The other direction, so the fix cannot pass by rejecting every `else`.
    // Same shape as IF_ELSE_ONE_WRITE_PER_BRANCH above, stated at depth: the
    // `} else` is strictly shallower than the write it separates.
    expect(writesAreBranchExclusive(IF_ELSE_ONE_WRITE_PER_BRANCH)).toBe(true);
    // And a `return` still clears from inside a deeper branch — the upsert.
    expect(writesAreBranchExclusive(UPSERT_SHAPE)).toBe(true);
  });

  // ==========================================================================
  // BACKLOG-2584 — the generic form of the wrapper, pinned
  // ==========================================================================
  // Transcribed from `unlinkContactSource`, electron/services/contactProvenance.ts:246
  // @ 0dca6beb1. Five of the six `dbTransaction` call sites outside `db/` look
  // like this, and NONE of them was recognised as wrapping before this task.
  const GENERIC_FORM_WRAPPER = `
  return dbTransaction<UnlinkOutcome>(() => {
    recordVerdict({
      userId,
      contactId,
      sourceType: row.source_type,
      sourceRecordId: row.source_record_id,
      identityVerdict: "different_people",
      reason: "manual_unlink",
      matchedOn: row.match_method,
      decidedBy: "provenance_unlink",
    });
    deleteLinkById(linkId);
  });
`;

  it("a `dbTransaction<T>(...)` call reads as WRAPPED (BACKLOG-2584)", () => {
    // THE DEFECT, pinned. Delete `(?:<[^>]*>)?` from TRANSACTION_CALL and THIS
    // TEST IS THE ONE THAT GOES RED — along with four correctly-atomic
    // orchestration wrappers turning up as offenders in the scan below.
    expect(wrapsItself(GENERIC_FORM_WRAPPER)).toBe(true);

    // The negative half, so this cannot pass by `wrapsItself` returning true for
    // everything — the same anti-vacuity shape as the PRECONDITION below.
    expect(wrapsItself(`dbRun(\`INSERT INTO contacts (id) VALUES (?)\`, [id]);`)).toBe(false);

    // And the plain form still works. `contactHandlers.ts:2884` is the only
    // plain-form caller outside `db/`; if this regressed, that site would be the
    // one to lose its clearance.
    expect(wrapsItself(`dbTransaction(() => { dbRun(sql, v); });`)).toBe(true);
  });

  it("a NESTED generic is a STATED FLOOR, not a claim (BACKLOG-2584)", () => {
    // Not a wish — a measurement of what this guard cannot do, written as a test
    // so the floor cannot quietly become false. `[^>]*` stops at the first `>`.
    // ZERO nested-generic call sites exist at `0dca6beb1`. If this ever flips to
    // `true`, someone closed the floor and this test should be deleted with a note.
    expect(wrapsItself(`dbTransaction<Map<string, number>>(() => { dbRun(sql, v); });`)).toBe(false);
  });

  it("writeCount and the branch-exclusive check see the SAME writes", () => {
    // True BY CONSTRUCTION now that both derive from WRITE_PATTERN over
    // stripComments(). That is the POINT — it can only fail if someone
    // re-introduces the divergence that caused BACKLOG-2569. Do not delete this
    // as tautological; the tautology is the guarantee.
    for (const body of [
      MULTILINE_THEN_SECOND_WRITE,
      UPSERT_SHAPE,
      IF_ELSE_ONE_WRITE_PER_BRANCH,
      LONE_MULTILINE_WRITE,
    ]) {
      const seenByExclusiveCheck = stripComments(body).match(new RegExp(WRITE_PATTERN, "gi")) ?? [];
      expect(seenByExclusiveCheck.length).toBe(writeCount(body));
    }
  });
});

describe("the enumerator does NOT see a non-violation (BACKLOG-2584)", () => {
  // ==========================================================================
  // THE DIRECTION EVERY OTHER CONTROL MISSES
  // ==========================================================================
  // Every other test here proves "we can still SEE a violation." None proves
  // "we do not see a NON-violation" — and that is the direction this guard has
  // actually failed in: its first run reported nine offenders, SIX of them false
  // positives. Under the rule above, a false positive can only be quieted by
  // filing a bogus item or bending EXEMPT. Both are silencing.
  //
  // Transcribed from `electron/handlers/sharedAuthHandlers.ts:475-545` @0dca6beb1:
  // THREE separate registrations, ONE write each. Two are multi-line and
  // block-bodied; the FIRST is the one-liner identifier form the real file uses
  // at `:475` — `ipcMain.handle("auth:complete-pending-login", handleCompletePendingLogin);`
  //
  // THE ONE-LINER IS WHAT MAKES THIS FIXTURE ABLE TO FAIL, and it was missing.
  // An earlier version held only the two block-bodied registrations and claimed
  // it would catch a regression to brace matching. IT COULD NOT: an arrow
  // function's own braces balance, so a brace-matched capture stops cleanly at
  // the end of the first handler and never reaches the second. SR injected that
  // exact regression and the suite stayed 19/19 GREEN. A one-liner registration
  // contains no brace at all, which is the only shape that makes a brace-matched
  // capture run on — and it is the shape that produced three identical
  // `sharedAuthHandlers` rows in this task's first measurement.
  //
  // The assertion is the UNIT NAMES, and the claim is stated as MEASURED rather
  // than as predicted — the first draft of this comment predicted two different
  // failures and both runs disagreed with it.
  //
  // Both regressions produce the SAME observable, verified by injecting each:
  //   - `captureHandlerUnit` replaced by a plain brace-matched capture, and
  //   - the identifier-resolution arm disabled (`if (false && ...)`)
  // both make the one-liner stop resolving to its declaration. It is named
  // `ipc:auth:complete-pending-login` instead of `handleCompletePendingLogin`,
  // and its body becomes the FOLLOWING handler's. Each injection reddens this
  // test on exactly that first array element.
  //
  // WHICH ASSERTION IS LOAD-BEARING, because it is not the obvious one: the
  // per-unit write counts stay `[1, 1, 1]` under both regressions, since the
  // swallowed body carries one write just as the resolved declaration does. The
  // counts cannot tell the two apart. THE NAMES CAN. Do not "simplify" this to a
  // length or a total.
  const THREE_HANDLERS_ONE_WRITE_EACH = `
  ipcMain.handle("auth:complete-pending-login", handleCompletePendingLogin);

  ipcMain.handle(
    "auth:dev:expire-mailbox-token",
    async (_event, userId, provider) => {
      try {
        const token = await databaseService.getOAuthToken(userId, provider, "mailbox");
        if (!token) {
          return { success: false, error: "No token found" };
        }
        const expiredTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        await databaseService.updateOAuthToken(token.id, {
          token_expires_at: expiredTime,
        });
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  ipcMain.handle(
    "auth:dev:reset-onboarding",
    async (_event, userId) => {
      try {
        const db = databaseService.getRawDatabase();
        db.prepare(
          "UPDATE users_local SET email_onboarding_completed_at = NULL WHERE id = ?"
        ).run(userId);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

async function handleCompletePendingLogin(_event, userId) {
  await databaseService.completeEmailOnboarding(userId);
}
`;

  it("three handlers with one write each are THREE units, and none is an offender", () => {
    const units = unitsInFile(
      "electron/handlers/fixture.ts",
      THREE_HANDLERS_ONE_WRITE_EACH.split("\n"),
      dbLayerWriters()
    );

    // THREE units, named exactly. The first name is the resolved DECLARATION,
    // not a channel. That element is the whole control: both the brace-matching
    // regression and a disabled identifier arm turn it into
    // `ipc:auth:complete-pending-login`, measured by injecting each.
    expect(units.map((u) => u.name)).toEqual([
      "handleCompletePendingLogin",
      "ipc:auth:dev:expire-mailbox-token",
      "ipc:auth:dev:reset-onboarding",
    ]);

    // BACKLOG-3238 — why this fixture says `completeEmailOnboarding` and not
    // `updateUser`. BACKLOG-2546 gave `updateUser` a sync twin, so the exported
    // `updateUser` became a one-line delegate holding no SQL of its own and
    // LEFT `dbLayerWriters()` — this unit then read 0 writes and the assertion
    // below went red on correct code. `completeEmailOnboarding` writes
    // `users_local` in its own body and is not twinned, so it is a stable stand
    // in with the same meaning (the fixture's third handler already writes the
    // same column raw). The load-bearing assertion here is the NAMES array
    // above, which is unchanged.
    //
    // One write each: a db-layer writer call in the resolved declaration, a
    // db-layer writer call in the second, raw SQL in the third. Asserted per
    // unit, not as a total — a total cannot tell "one each" from "all three in
    // one handler". Measured limit, stated so nobody mistakes this line for the
    // control: these counts are UNCHANGED by both regressions above. They pin
    // the write rule, not the enumeration.
    expect(units.map((u) => unitWrites(u).length)).toEqual([1, 1, 1]);

    // And therefore nothing to report. This is the offender predicate itself,
    // minus the two repo-global clearing sets, which a fixture cannot supply.
    const offenders = units
      .filter((u) => unitWrites(u).length >= 2)
      .filter((u) => !wrapsItself(u.body))
      .filter((u) => !writesAreBranchExclusive(u.body, u.isDbWriterCall, u.name));
    expect(offenders).toEqual([]);
  });

  // The same two writes, in ONE registration. Written out rather than derived
  // from the fixture above, because a fixture built by editing another fixture
  // is a fixture nobody has read.
  const BOTH_WRITES_IN_ONE_HANDLER = `
  ipcMain.handle(
    "auth:dev:expire-and-reset",
    async (_event, userId, provider) => {
      const token = await databaseService.getOAuthToken(userId, provider, "mailbox");
      await databaseService.updateOAuthToken(token.id, {
        token_expires_at: expiredTime,
      });
      const db = databaseService.getRawDatabase();
      db.prepare(
        "UPDATE users_local SET email_onboarding_completed_at = NULL WHERE id = ?"
      ).run(userId);
      return { success: true };
    }
  );
`;

  it("the same two writes in ONE handler ARE reported", () => {
    // The other half, so the test above cannot pass by the enumerator seeing
    // nothing at all. One registration, two writes, no transaction, and no exit
    // between them — the shape the guard exists to catch.
    const units = unitsInFile(
      "electron/handlers/fixture.ts",
      BOTH_WRITES_IN_ONE_HANDLER.split("\n"),
      dbLayerWriters()
    );
    expect(units.map((u) => u.name)).toEqual(["ipc:auth:dev:expire-and-reset"]);
    expect(unitWrites(units[0]).length).toBe(2);

    const offenders = units
      .filter((u) => unitWrites(u).length >= 2)
      .filter((u) => !wrapsItself(u.body))
      .filter((u) => !writesAreBranchExclusive(u.body, u.isDbWriterCall, u.name));
    expect(offenders.map((u) => u.name)).toEqual(["ipc:auth:dev:expire-and-reset"]);
  });
});

/**
 * ===========================================================================
 * BACKLOG-3235 — THE WRITER SET FOLLOWS THE SYNCTWIN, TESTED DIRECTLY
 * ===========================================================================
 * The scan cannot prove this rule, for the same reason BACKLOG-2569 gave: a
 * green scan is compatible with the rule being wrong. These fixtures run the
 * REAL derivation (`dbWriterDeclsIn` + `writersFrom`) and the REAL enumeration
 * (`unitsInFile`) over transcribed source strings.
 *
 * TRANSCRIBED, NOT INVENTED. `DB_LAYER_WITH_TWINS` is
 * `electron/services/db/contactDbService.ts` @ `1cd39acd0`: the
 * `backfillContactEmails` wrapper VERBATIM from `:959-965`, its twin reduced to
 * its real SELECT (`:998`) and its real INSERT (`:1015-1019`), the
 * `backfillContactPhones` wrapper VERBATIM from `:1041-1047` with its twin's
 * INSERT (`:1081-1085`), and `createContact` reduced to its declaration
 * (`:358-361`) and its write (`:366-370`). Reductions are stated because a
 * reduction is a claim about what does not matter.
 *
 * The wrapper deliberately transcribed here is a `return xSync(...)` one, NOT a
 * `Promise.resolve` one: four of the seven real wrappers have this shape, and a
 * fixture using only the ruled `Promise.resolve` text would let a rule that
 * keyed on it pass.
 *
 * THE TWO NEGATIVE FIXTURES ARE ONE-LINE MUTATIONS OF THAT TRANSCRIPTION, not
 * separate inventions — so a failure points at the clause under test rather than
 * at a fixture nobody has read.
 */
describe("the writer set follows a syncTwin (BACKLOG-3235)", () => {
  const DB_LAYER_WITH_TWINS = `
export async function createContact(
  contactData: NewContact,
  origin: ContactOrigin,
): Promise<Contact> {
  const statement = sql\`
      INSERT INTO contacts (
        id, user_id, display_name, company, title, source, is_imported
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    \`;
  return dbRun(statement, values);
}

export async function backfillContactEmails(
  contactId: string,
  emails: string[],
  source: ContactInfoSource = "import",
): Promise<number> {
  return backfillContactEmailsSync(contactId, emails, source);
}

export function backfillContactEmailsSync(
  contactId: string,
  emails: string[],
  source: ContactInfoSource = "import",
): number {
  const existingSql = sql\`SELECT LOWER(email) as email FROM contact_emails WHERE contact_id = ?\`;
  const existingRows = dbAll<{ email: string }>(existingSql, [contactId]);
  const emailSql = sql\`
      INSERT OR IGNORE INTO contact_emails (
        id, contact_id, email, is_primary, source, created_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    \`;
  return dbRun(emailSql, [emailId, contactId, normalizedEmail, isPrimary, source]).changes;
}

export async function backfillContactPhones(
  contactId: string,
  phones: string[],
  source: ContactInfoSource = "import",
): Promise<number> {
  return backfillContactPhonesSync(contactId, phones, source);
}

export function backfillContactPhonesSync(
  contactId: string,
  phones: string[],
  source: ContactInfoSource = "import",
): number {
  const phoneSql = sql\`
      INSERT OR IGNORE INTO contact_phones (
        id, contact_id, phone_e164, phone_display, phone_normalized, is_primary, source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    \`;
  return dbRun(phoneSql, [phoneId, contactId, phoneE164, phone, toLookupKey(phoneE164), isPrimary, source]).changes;
}
`;

  // The SAME pair, with exactly ONE thing changed: the wrapper no longer
  // mentions its twin. Pins the body check — delete that line and this reddens.
  const WRAPPER_WITHOUT_DELEGATION = `
export async function backfillContactEmails(
  contactId: string,
  emails: string[],
  source: ContactInfoSource = "import",
): Promise<number> {
  return Promise.resolve(0);
}

export function backfillContactEmailsSync(
  contactId: string,
  emails: string[],
  source: ContactInfoSource = "import",
): number {
  const emailSql = sql\`
      INSERT OR IGNORE INTO contact_emails (
        id, contact_id, email, is_primary, source, created_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    \`;
  return dbRun(emailSql, [emailId, contactId, normalizedEmail, isPrimary, source]).changes;
}
`;

  // The SAME pair, with exactly ONE thing changed: the twin's INSERT is gone and
  // only its real SELECT remains. Pins `base.has(name + "Sync")` against a bare
  // declaration-existence check — which the fixture above CANNOT catch, because
  // its twin writes.
  const TWIN_THAT_ONLY_READS = `
export async function backfillContactEmails(
  contactId: string,
  emails: string[],
  source: ContactInfoSource = "import",
): Promise<number> {
  return backfillContactEmailsSync(contactId, emails, source);
}

export function backfillContactEmailsSync(
  contactId: string,
  emails: string[],
  source: ContactInfoSource = "import",
): number {
  const existingSql = sql\`SELECT LOWER(email) as email FROM contact_emails WHERE contact_id = ?\`;
  const existingRows = dbAll<{ email: string }>(existingSql, [contactId]);
  return existingRows.length;
}
`;

  // `contactHandlers.ts:2717-2780` @ `1cd39acd0`, CONTIGUOUS AND VERBATIM —
  // every line of the span, comments included. It is wrapped in an
  // `ipcMain.handle` registration because `unitsInFile` enumerates units, not
  // fragments; the shell is scaffolding, the span is not touched.
  //
  // Reducing it would be unsafe rather than merely lossy: the span contains NO
  // `return` and NO `} else`, which is exactly why `writesAreBranchExclusive`
  // declines to clear it. Dropping or introducing either while trimming would
  // silently reclassify the fixture.
  //
  // This is also the ONLY place in this file pinning TWO CONSECUTIVE `if` BLOCKS
  // WITH NO `else` — `IF_ELSE_ONE_WRITE_PER_BRANCH` pins if/else and
  // `SIBLING_ELSE_BETWEEN_SEQUENTIAL_WRITES` pins a sibling `} else`. Neither
  // covers the shape this fix actually surfaces.
  const CALLER_COMPOSING_THE_TWINS = `
  ipcMain.handle(
    "contacts:create",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
      contactData: unknown,
    ): Promise<ContactResponse> => {
        const contact = await databaseService.createContact(
          {
            user_id: validatedUserId,
            // BACKLOG-2707 — \`?? ""\`, not \`|| "Unknown"\`. Same reason as the
            // import loop above; one substitution site left behind is how this
            // recurs.
            display_name: validatedData.name ?? "",
            email: validatedData.email ?? undefined,
            phone: validatedData.phone ?? undefined,
            company: validatedData.company ?? undefined,
            title: validatedData.title ?? undefined,
            source,
            is_imported: true,
          },
          // BACKLOG-2496 — "derived": this contact was typed into the Add
          // Contact form (or arrived from a message thread), so there is no
          // address-book record to point at and its origin row is synthetic,
          // keyed on its own id. The row is now written INSIDE the create
          // transaction, so the separate \`recordContactOrigin\` call that used
          // to sit below is gone: it could not fail to happen any more.
          { kind: "derived" },
        );

        /**
         * WHERE THIS CONTACT CAME FROM IS NO LONGER WRITTEN HERE (BACKLOG-2496).
         *
         * It used to be a \`recordContactOrigin(...)\` call on this line, AFTER
         * the contact had already been committed. That is the defect this item
         * closes: two separate writes, with nothing forcing the second, so a
         * crash or a throw between them left a contact with no origin —
         * indistinguishable afterwards from one a path never wrote.
         *
         * The origin is now a REQUIRED ARGUMENT to \`createContact\` above and is
         * written inside the same transaction as the contact. A create path that
         * does not state an origin does not compile, and one that does cannot
         * half-succeed.
         *
         * The four-way case analysis that used to sit here — listing which
         * create paths were covered and naming the import batch and the Android
         * promote as KNOWN GAPS — is obsolete: all of them now go through a
         * signature that requires it.
         */

        // BACKLOG-1270: Store ALL emails/phones (not just the primary)
        //
        // BACKLOG-2427: with the SAME provenance the contact itself was given.
        // These two calls stamped every value 'import' regardless — and the
        // manual Add Contact form arrives here with no \`source\` at all, so
        // \`source\` above resolves to "manual" while the addresses the user had
        // just typed were recorded as imported. The unlink is then entitled to
        // delete them: a stranger's address-book card sharing the contact's
        // office line was enough to take a client's own phone number off their
        // record.
        const valueSource = contactInfoSourceFor(source);
        const inputAllEmails = (contactData as { allEmails?: string[] })?.allEmails || [];
        const inputAllPhones = (contactData as { allPhones?: string[] })?.allPhones || [];
        if (inputAllEmails.length > 0) {
          await databaseService.backfillContactEmails(contact.id, inputAllEmails, valueSource);
          logService.info(\`[Contacts] Stored \${inputAllEmails.length} emails for new contact \${contact.id}\`, "Contacts");
        }
        if (inputAllPhones.length > 0) {
          await databaseService.backfillContactPhones(contact.id, inputAllPhones, valueSource);
          logService.info(\`[Contacts] Stored \${inputAllPhones.length} phones for new contact \${contact.id}\`, "Contacts");
        }
    },
  );
`;

  const declsOf = (src: string): { name: string; body: string }[] =>
    dbWriterDeclsIn(src.split("\n"));

  it("admits a wrapper that delegates to a writing twin — and did NOT before", () => {
    const decls = declsOf(DB_LAYER_WITH_TWINS);
    const before = writersFrom(decls, false);
    const after = writersFrom(decls);

    // The twin holds the SQL, so it is a writer under BOTH derivations.
    expect(before.has("backfillContactEmailsSync")).toBe(true);
    expect(after.has("backfillContactEmailsSync")).toBe(true);

    // The wrapper holds none. This is the defect, and then the fix.
    expect(before.has("backfillContactEmails")).toBe(false);
    expect(after.has("backfillContactEmails")).toBe(true);
    expect(before.has("backfillContactPhones")).toBe(false);
    expect(after.has("backfillContactPhones")).toBe(true);

    // Exact delta, not a size: pass 2 restores the delegating wrappers and
    // NOTHING else. A count would pass just as well if it swapped a name.
    expect([...after].filter((n) => !before.has(n)).sort()).toEqual([
      "backfillContactEmails",
      "backfillContactPhones",
    ]);
  });

  it("a db/ export that does NOT reference its twin is not admitted", () => {
    const writers = writersFrom(declsOf(WRAPPER_WITHOUT_DELEGATION));
    expect(writers.has("backfillContactEmailsSync")).toBe(true);
    // Naming coincidence is not delegation. `base` is BARE NAMES over 434 unique
    // names with six measured duplicates, so without the body check a `foo` in
    // one file pairs with a writing `fooSync` in another on the name alone.
    expect(writers.has("backfillContactEmails")).toBe(false);
  });

  it("a wrapper whose twin only READS is not admitted", () => {
    const writers = writersFrom(declsOf(TWIN_THAT_ONLY_READS));
    // The twin exists and is delegated to — but it issues no write, so neither
    // name is a writer. Pins the rule against "a twin declaration exists".
    expect(writers.has("backfillContactEmailsSync")).toBe(false);
    expect(writers.has("backfillContactEmails")).toBe(false);
  });

  it("reports a handler composing twin wrappers as an offender — and did NOT before", () => {
    const decls = declsOf(DB_LAYER_WITH_TWINS);
    const before = writersFrom(decls, false);
    const after = writersFrom(decls);

    // NOT `electron/services/db/...`: inside `db/` the raw-SQL rule stands and
    // call tokens are OFF, which would make every assertion below vacuous.
    const rel = "electron/handlers/contactHandlers.ts";
    const lines = CALLER_COMPOSING_THE_TWINS.split("\n");
    const unitsBefore = unitsInFile(rel, lines, before);
    const unitsAfter = unitsInFile(rel, lines, after);

    // The db/ pair and the caller are SEPARATE strings on purpose. In one
    // combined string `unitsInFile`'s `localWriters` rule would admit a
    // non-exported `backfillContactEmails` declaration at depth 1, and this test
    // would pass with the twin clause deleted.
    expect(unitsBefore.map((u) => u.name)).toEqual(["ipc:contacts:create"]);
    expect(unitsAfter.map((u) => u.name)).toEqual(["ipc:contacts:create"]);

    // Counts DERIVED FROM THIS FIXTURE'S CONTENTS: `createContact` is a raw-SQL
    // writer in both derivations, the two backfills only in the second.
    expect(unitWrites(unitsBefore[0]).length).toBe(1);
    expect(unitWrites(unitsAfter[0]).length).toBe(3);

    // THE ASSERTION THAT MATTERS. A write COUNT cannot separate a violation from
    // a non-violation — `length === 2` is equally true of a correctly
    // branch-exclusive upsert. Run the offender predicate itself and assert the
    // unit's NAME.
    const offenders = (units: Fn[]): string[] =>
      units
        .filter((u) => unitWrites(u).length >= 2)
        .filter((u) => !wrapsItself(u.body))
        .filter((u) => !writesAreBranchExclusive(u.body, u.isDbWriterCall, u.name))
        .map((u) => u.name);

    expect(offenders(unitsBefore)).toEqual([]);
    expect(offenders(unitsAfter)).toEqual(["ipc:contacts:create"]);
  });
});

describe("a multi-statement write may not ship without a transaction (BACKLOG-2530)", () => {
  const units = scanUnits();
  const insideATransaction = namesCalledInsideATransaction();

  it("PRECONDITION: the scan reaches the db layer AND the orchestration layer", () => {
    expect(units.length).toBeGreaterThan(50);
    // If this ever drops to zero the guard below passes vacuously — which is
    // the failure mode every check in this repo is now written to avoid.
    expect(units.some((u) => u.name === "createContact")).toBe(true);

    // BACKLOG-2584: the db-layer name above passed for this guard's whole life
    // while the orchestration layer was unscanned. Name one function from the
    // widened root, so a root that silently reverts to `db/` cannot pass.
    expect(units.some((u) => u.name === "unlinkContactSource")).toBe(true);
  });

  it("PRECONDITION: the IPC surface is enumerated at handler granularity", () => {
    // 243 of 323 `ipcMain.handle(` registrations put the channel on a LATER
    // line. A capture that reads only the `handle(` line misses 75% of handlers
    // and reports green over them. This channel is registered multi-line.
    expect(units.some((u) => u.name === "ipc:transactions:export-enhanced")).toBe(true);

    // And one registered through a wrapper — `wrapHandler(async (...) => {` —
    // which the paren-bounded capture has to see through.
    expect(units.some((u) => u.name === "ipc:transactions:link-emails")).toBe(true);

    // A registrar must NOT survive as its own unit: its brace-matched body
    // swallows every handler it registers, and it would report their writes
    // added together under a function that issues none.
    expect(units.some((u) => u.name === "registerContactHandlers")).toBe(false);
  });

  it("PRECONDITION: the db-layer writer set is populated and type fixtures are excluded", () => {
    // The composition rule stands entirely on this set. Empty set, green guard.
    expect(dbLayerWriters().size).toBeGreaterThan(50);

    // The exclusion is pinned, not merely written: assert the directory EXISTS
    // and that nothing from it was enumerated. Asserting absence alone would
    // pass just as well if the directory were renamed or deleted.
    expect(fs.existsSync(path.join(REPO_ROOT, "electron", "types", "__typefixtures__"))).toBe(true);
    expect(units.some((u) => u.file.includes("__typefixtures__"))).toBe(false);

    // BACKLOG-2549 — PIN. `recordExportCompletion` is what the two export
    // handlers now write through, so it is the single name that keeps them
    // countable. If its signature is ever rewritten with an INLINE object type
    // in the parameter list, `captureBody` closes before the body opens
    // (BACKLOG-3225), the function reads as having no writes, it drops out of
    // this set, and both handlers silently fall to 0 counted writes — green
    // because the guard went blind, not because the code is atomic. Keep the
    // named `ExportCompletionParams` interface.
    expect(dbLayerWriters().has("recordExportCompletion")).toBe(true);
  });

  it("PRECONDITION: it can tell a wrapped write from an unwrapped one", () => {
    const wrapped = units.filter((u) => unitWrites(u).length >= 2 && wrapsItself(u.body));
    expect(wrapped.length).toBeGreaterThan(0);

    // BACKLOG-2569: the positive half alone passes vacuously if `wrapsItself`
    // ever returns true for everything. Assert the NEGATIVE half too — a body
    // that opens no transaction must not read as wrapped.
    expect(wrapsItself(`dbRun(\`INSERT INTO contacts (id) VALUES (?)\`, [id]);`)).toBe(false);
    expect(wrapsItself(`await dbTransaction(async () => { dbRun(sql, v); });`)).toBe(true);
  });

  function unwrapped(): Fn[] {
    return units
      .filter((u) => unitWrites(u).length >= 2)
      .filter((u) => !wrapsItself(u.body))
      .filter((u) => !writesAreBranchExclusive(u.body, u.isDbWriterCall, u.name))
      .filter((u) => !insideATransaction.has(u.name))
      .filter((u) => !(exemptKey(u) in EXEMPT));
  }

  it("NO NEW multi-write function ships without a transaction", () => {
    const offenders = unwrapped()
      .filter((f) => !(exemptKey(f) in KNOWN_UNWRAPPED))
      .map((f) => `${f.file}:${f.line}  ${f.name}  (${unitWrites(f).length} writes)`);

    // Exact set, not a count — a count cannot tell a new violation from a
    // different one that replaced it.
    expect(offenders).toEqual([]);
  });

  it("the known list may only SHRINK — an entry removed without a fix goes red", () => {
    const stillUnwrapped = unwrapped().map(exemptKey).sort();
    const claimed = Object.keys(KNOWN_UNWRAPPED).sort();

    // Anything claimed as known that is no longer unwrapped has been FIXED —
    // delete it from KNOWN_UNWRAPPED. Anything unwrapped and not claimed is a
    // new violation, caught by the test above.
    const fixedButStillListed = claimed.filter((n) => !stillUnwrapped.includes(n));
    expect(fixedButStillListed).toEqual([]);
  });

  it("every known entry says what a crash would leave, in plain terms", () => {
    for (const [name, damage] of Object.entries(KNOWN_UNWRAPPED)) {
      // "data could be inconsistent" is not a description. BACKLOG-2530 asks
      // for the intermediate state named concretely.
      expect(damage.length).toBeGreaterThan(40);
      expect(damage).not.toMatch(/inconsistent state|data integrity issue/i);
      expect(typeof name).toBe("string");
    }
  });

  it("the exemption list stays small and every entry gives a reason", () => {
    for (const [name, reason] of Object.entries(EXEMPT)) {
      expect(reason.length).toBeGreaterThan(20);
      expect(reason).not.toMatch(/^(ok|fine|n\/a|todo)/i);
      expect(typeof name).toBe("string");
    }
    // A growing exemption list is the failure mode of every guard like this.
    expect(Object.keys(EXEMPT).length).toBeLessThanOrEqual(6);
  });
});
