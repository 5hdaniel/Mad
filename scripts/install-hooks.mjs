#!/usr/bin/env node
/**
 * install-hooks — the `prepare` script. BACKLOG-3068.
 *
 * Points `core.hooksPath` at `.husky` — the TRACKED hooks directory — instead of
 * `.husky/_`, the generated runner directory husky writes.
 *
 * ## Why this exists
 *
 * husky 9.1.7 (`node_modules/husky/index.js:14`) runs, on every `npm install`:
 *
 *     spawnSync('git', ['config', 'core.hooksPath', '.husky/_'])
 *
 * `.husky/_` is generated, and husky writes a `.gitignore` holding `*` into it,
 * so it is untracked BY DESIGN. Git resolves a RELATIVE `core.hooksPath` against
 * each worktree's own root. A linked worktree therefore has no `.husky/_`, git
 * finds no hook, and **the commit or push proceeds with no gate, no message and
 * exit 0** (measured: 5 of 79 worktrees on the filing machine had the directory).
 *
 * The previous remedy (BACKLOG-2577) was `npm run hooks:doctor -- --seed`,
 * documented as MANDATORY at worktree creation. Measured compliance: 6%. A step
 * that 94% of instances skip is a note, not a mechanism.
 *
 * ## Why `.husky` and not an absolute path
 *
 * An absolute path into the main checkout also makes every worktree find A hook —
 * but it is the MAIN CHECKOUT'S file, from whatever branch that checkout happens
 * to hold. That is BACKLOG-2577's original defect, and it is not hypothetical:
 * while this was being written the main checkout sat on a docs branch whose
 * `.husky/pre-push` predated the message-hygiene gate, so every worktree ran a
 * hook missing a check its own branch had.
 *
 * `.husky` is relative, so each worktree resolves its OWN branch's hook; and the
 * hooks there are TRACKED at mode 100755, so they arrive with every checkout,
 * worktree and fresh clone with nothing to seed and nothing to remember.
 *
 * ## What is given up, and why each is safe
 *
 * Git executes `.husky/pre-commit` directly instead of through husky's `_/h`
 * wrapper. That wrapper did five things:
 *
 *   sh -e "$s"                        -> REPLACED: `set -e` now lives in the hook
 *                                        files themselves. LOAD-BEARING — both
 *                                        hooks are authored assuming errexit.
 *   HUSKY=0 skip                      -> PRESERVED: two lines in each hook.
 *   . ~/.config/husky/init.sh         -> dropped; no such file on this machine.
 *   export PATH=node_modules/.bin:... -> dropped; no hook calls a bare binary,
 *                                        every invocation is npx / npm run / node.
 *   "husky - <hook> script failed"    -> dropped; pre-push prints its own verdict.
 *
 * husky itself is still invoked below, so `.husky/_` keeps being generated. That
 * costs nothing, keeps `hooks:doctor --seed` working, and means reverting this
 * file is the whole rollback.
 *
 * @module scripts/install-hooks
 */

import { spawnSync } from "node:child_process";
import husky from "husky";

/** The tracked hooks directory. Relative on purpose — see the header. */
const HOOKS_PATH = ".husky";

/**
 * husky's own escape hatch. Checked BEFORE anything runs: husky returns
 * 'HUSKY=0 skip install' and writes nothing, and it would be incoherent for this
 * script to then set `core.hooksPath` and install the hooks the user just asked
 * to skip.
 */
if (process.env.HUSKY === "0") {
  console.log("install-hooks: HUSKY=0 — skipping (core.hooksPath left untouched).");
  process.exit(0);
}

// Run husky. It regenerates `.husky/_` and sets core.hooksPath to `.husky/_`;
// the override below is what makes the value durable. A non-empty return is
// husky reporting a problem (no .git, no git binary) — surface it and stop
// rather than writing a hooks path into a repo husky could not install into.
const huskyResult = husky();
if (huskyResult) {
  console.error(`install-hooks: husky did not install: ${huskyResult}`);
  process.exit(1);
}

const wrote = spawnSync("git", ["config", "core.hooksPath", HOOKS_PATH], {
  encoding: "utf8",
});
if (wrote.error || wrote.status !== 0) {
  console.error(
    `install-hooks: could not set core.hooksPath: ${wrote.error?.message ?? wrote.stderr ?? `exit ${wrote.status}`}`,
  );
  process.exit(1);
}

// Read it back. `git config --get` is the only thing that proves the write
// landed; the exit code above proves only that git was willing to run.
const readBack = spawnSync("git", ["config", "--get", "core.hooksPath"], {
  encoding: "utf8",
});
const actual = (readBack.stdout ?? "").trim();
if (actual !== HOOKS_PATH) {
  console.error(
    `install-hooks: core.hooksPath reads back as '${actual}', expected '${HOOKS_PATH}'.`,
  );
  process.exit(1);
}

console.log(`install-hooks: core.hooksPath = ${HOOKS_PATH} (tracked hooks; every worktree runs its own).`);
