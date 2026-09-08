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
const KNOWN_UNWRAPPED: Record<string, string> = {
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
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      out.push(...sourceFiles(p));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      out.push(p);
    }
  }
  return out;
}

/** Brace-matched body of the function starting at `startLine`. */
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

function exportedFunctions(): Fn[] {
  const fns: Fn[] = [];
  for (const file of sourceFiles(DB_DIR)) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/.exec(lines[i]);
      if (!m) continue;
      fns.push({
        file: path.relative(REPO_ROOT, file).split(path.sep).join("/"),
        name: m[1],
        line: i + 1,
        body: captureBody(lines, i),
      });
    }
  }
  return fns;
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

function writesAreBranchExclusive(body: string): boolean {
  const src = stripComments(body);
  const depths = braceDepths(src);

  // Writes and exits as one offset-ordered stream. A write at the same offset
  // as an exit sorts first, preserving the old `else if` precedence where a
  // line containing a write was never also read as an exit.
  const tokens: { at: number; isWrite: boolean; depth: number; isReturn: boolean }[] = [];
  for (const m of src.matchAll(new RegExp(WRITE_PATTERN, "gi"))) {
    const at = m.index ?? 0;
    tokens.push({ at, isWrite: true, depth: depths[at] ?? 0, isReturn: false });
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

/** Every identifier called inside some `dbTransaction(() => { ... })` anywhere in the db layer. */
function namesCalledInsideATransaction(): Set<string> {
  const inside = new Set<string>();
  for (const file of sourceFiles(DB_DIR)) {
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

describe("a multi-statement write may not ship without a transaction (BACKLOG-2530)", () => {
  const fns = exportedFunctions();
  const insideATransaction = namesCalledInsideATransaction();

  it("PRECONDITION: the scan actually finds the db layer", () => {
    expect(fns.length).toBeGreaterThan(50);
    // If this ever drops to zero the guard below passes vacuously — which is
    // the failure mode every check in this repo is now written to avoid.
    expect(fns.some((f) => f.name === "createContact")).toBe(true);
  });

  it("PRECONDITION: it can tell a wrapped write from an unwrapped one", () => {
    const wrapped = fns.filter((f) => writeCount(f.body) >= 2 && wrapsItself(f.body));
    expect(wrapped.length).toBeGreaterThan(0);

    // BACKLOG-2569: the positive half alone passes vacuously if `wrapsItself`
    // ever returns true for everything. Assert the NEGATIVE half too — a body
    // that opens no transaction must not read as wrapped.
    expect(wrapsItself(`dbRun(\`INSERT INTO contacts (id) VALUES (?)\`, [id]);`)).toBe(false);
    expect(wrapsItself(`await dbTransaction(async () => { dbRun(sql, v); });`)).toBe(true);
  });

  function unwrapped(): Fn[] {
    return fns
      .filter((f) => writeCount(f.body) >= 2)
      .filter((f) => !wrapsItself(f.body))
      .filter((f) => !writesAreBranchExclusive(f.body))
      .filter((f) => !insideATransaction.has(f.name))
      .filter((f) => !(exemptKey(f) in EXEMPT));
  }

  it("NO NEW multi-write function ships without a transaction", () => {
    const offenders = unwrapped()
      .filter((f) => !(f.name in KNOWN_UNWRAPPED))
      .map((f) => `${f.file}:${f.line}  ${f.name}  (${writeCount(f.body)} writes)`);

    // Exact set, not a count — a count cannot tell a new violation from a
    // different one that replaced it.
    expect(offenders).toEqual([]);
  });

  it("the known list may only SHRINK — an entry removed without a fix goes red", () => {
    const stillUnwrapped = unwrapped().map((f) => f.name).sort();
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
