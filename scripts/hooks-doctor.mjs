#!/usr/bin/env node
/**
 * hooks-doctor — BACKLOG-2577, updated by BACKLOG-3068
 *
 * Answers one question for the CURRENT worktree: "when I commit or push, which
 * hook runs, and is it mine?"
 *
 * Why this exists. `.git/config` sets `core.hooksPath`, and that value is shared
 * by every worktree. Three states, and this script distinguishes them:
 *
 *   `.husky`   (relative, TRACKED hooks — what `prepare` now writes)
 *              each worktree runs its OWN branch's hook, with nothing to seed,
 *              because the hooks are tracked at mode 100755 and arrive with
 *              every checkout. This is the PROTECTED state.
 *
 *   `.husky/_` (relative, husky's GENERATED runner — what bare husky writes)
 *              each worktree runs its own, but a worktree with no `.husky/_`
 *              runs NOTHING and git reports that with silence and exit 0.
 *              Measured on the filing machine: 5 of 79 worktrees had it.
 *
 *   absolute   every worktree runs ONE checkout's hook, whatever branch that
 *              checkout holds — which is how a worktree ends up running a hook
 *              missing a check its own branch added (BACKLOG-2577).
 *
 * This script turns each silent state into a non-zero exit.
 *
 * It is a DIAGNOSTIC. It reads git config and copies files; it never writes git
 * config. Setting `core.hooksPath` belongs to `scripts/install-hooks.mjs` (the
 * `prepare` script), which is why `--seed` exists here instead.
 *
 *   node scripts/hooks-doctor.mjs           diagnose, exit non-zero if unprotected
 *   node scripts/hooks-doctor.mjs --seed    LEGACY. Copies the main checkout's
 *                                           .husky/_ into this worktree. Needed
 *                                           only while core.hooksPath still
 *                                           points at `_`; a no-op otherwise.
 *
 * @module scripts/hooks-doctor
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SEED = process.argv.includes("--seed");
const HOOKS = ["pre-push", "pre-commit"];
/** Files husky generates in `_` that a worktree needs in order to run any hook. */
const SEED_FILES = ["h", ".gitignore", ...HOOKS];

const bold = (s) => `[1m${s}[0m`;
const red = (s) => `[31m${s}[0m`;
const green = (s) => `[32m${s}[0m`;
const yellow = (s) => `[33m${s}[0m`;

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function md5(file) {
  try {
    return createHash("md5").update(fs.readFileSync(file)).digest("hex").slice(0, 8);
  } catch {
    return null;
  }
}

const problems = [];
const fail = (msg, detail) => problems.push({ msg, detail });

// ---------------------------------------------------------------------------
// Locate this worktree and the main checkout
// ---------------------------------------------------------------------------
const worktreeRoot = git(["rev-parse", "--show-toplevel"]);
if (!worktreeRoot) {
  console.error(red("hooks-doctor: not inside a git working tree."));
  process.exit(1);
}
// --git-common-dir points at the MAIN checkout's .git for every linked worktree.
const commonDir = git(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
const mainRoot = commonDir ? path.dirname(commonDir) : worktreeRoot;
const isMain = path.resolve(mainRoot) === path.resolve(worktreeRoot);

// ---------------------------------------------------------------------------
// --seed: give this worktree its own .husky/_ by copying the main checkout's
// ---------------------------------------------------------------------------
if (SEED) {
  // BACKLOG-3068: seeding exists to give a worktree the GENERATED `_` runner.
  // When core.hooksPath is the tracked `.husky`, git runs the hook files that
  // every checkout already has, and there is nothing to seed. Say so and stop —
  // copying `_` in would be inert, and an inert command that reports success is
  // how the seed instruction outlived its mechanism in the first place.
  const currentPath = git(["config", "--get", "core.hooksPath"]);
  if (currentPath && !currentPath.split("/").includes("_")) {
    console.log(
      green(`--seed is not needed: core.hooksPath is '${currentPath}', the tracked hooks directory.\n`) +
        "Every worktree already has those files — they are tracked. Nothing copied.\n" +
        "Running the diagnosis anyway:\n"
    );
  } else {
  const from = path.join(mainRoot, ".husky", "_");
  const to = path.join(worktreeRoot, ".husky", "_");
  // A failed seed must still be loud — this is the ACTION failing, which is the
  // one thing --seed's exit code reports (see the exit-code contract below).
  if (!fs.existsSync(from)) {
    console.error(red(`hooks-doctor --seed: ${from} does not exist.`));
    console.error(`Run 'npm install' (or 'npx husky') in ${mainRoot} first — it regenerates .husky/_.`);
    process.exit(1);
  }
  fs.mkdirSync(to, { recursive: true });
  let copied = 0;
  for (const f of SEED_FILES) {
    const src = path.join(from, f);
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, path.join(to, f));
    if (f !== ".gitignore") fs.chmodSync(path.join(to, f), 0o755);
    copied += 1;
  }
  console.log(green(`seeded ${copied} file(s) into ${to}`));
  console.log(
    "These copies are deliberately UNTRACKED: the GENERATED runner directory\n" +
      "must stay branch-independent, and tracking is definitionally branch-\n" +
      "dependence (a checkout of a branch without them would delete it).\n" +
      "The hooks themselves — .husky/pre-commit, .husky/pre-push — ARE tracked,\n" +
      "which is what BACKLOG-3068 points core.hooksPath at.\n"
  );
  }
}

// ---------------------------------------------------------------------------
// Resolve what git + husky will actually execute
// ---------------------------------------------------------------------------
const hooksPath = git(["config", "--get", "core.hooksPath"]);
const scope = hooksPath ? git(["config", "--show-origin", "--get", "core.hooksPath"]).split("\t")[0] : "(unset)";

console.log(bold("\nhooks-doctor — BACKLOG-2577\n"));
console.log(`  worktree        ${worktreeRoot}${isMain ? "  (main checkout)" : ""}`);
console.log(`  branch          ${git(["rev-parse", "--abbrev-ref", "HEAD"]) || "(detached)"}`);
console.log(`  main checkout   ${mainRoot}`);
console.log(`  core.hooksPath  ${hooksPath || red("(unset — husky is not installed)")}   ${scope}`);

if (!hooksPath) {
  fail(
    "core.hooksPath is unset, so husky hooks do not run at all.",
    `Run 'npm install' in ${mainRoot}.`
  );
} else {
  const absolute = path.isAbsolute(hooksPath);
  const shimDir = absolute ? hooksPath : path.join(worktreeRoot, hooksPath);
  console.log(`  path style      ${absolute ? yellow("ABSOLUTE — shared by every worktree") : green("relative — resolves per worktree")}`);
  console.log("");

  // Which layout is core.hooksPath pointing at? Decided by MECHANISM, not by
  // the directory's name: husky's generated runner directory is the one holding
  // the `h` dispatcher, and every shim in it is `. "$(dirname "$0")/h"`. A
  // directory without `h` holds the hooks themselves, and git runs them directly.
  const viaHuskyRunner = fs.existsSync(path.join(shimDir, "h"));
  console.log(
    `  layout          ${viaHuskyRunner ? "husky runner dir (_/h dispatches to ../<hook>)" : "hooks executed directly by git"}`
  );
  console.log("");

  for (const hook of HOOKS) {
    // What git invokes.
    const entry = path.join(shimDir, hook);
    // What ultimately executes: through the runner, husky's `_/h` resolves the
    // user hook as dirname(dirname($0))/$(basename $0); executed directly, the
    // entry point IS the user hook.
    const userHook = viaHuskyRunner
      ? path.join(path.dirname(path.dirname(entry)), hook)
      : entry;
    const ownHook = path.join(worktreeRoot, ".husky", hook);

    const entryExists = fs.existsSync(entry);
    const userExists = fs.existsSync(userHook);
    const isOwn = path.resolve(userHook) === path.resolve(ownHook);

    console.log(bold(`  ${hook}`));
    console.log(`    git invokes   ${entry}`);
    console.log(`    resolves to   ${userHook}`);
    console.log(`    exists        ${userExists ? green("yes") : red("NO")}   md5 ${md5(userHook) ?? red("n/a")}`);
    console.log(`    this worktree ${ownHook}`);
    console.log(`                  ${fs.existsSync(ownHook) ? `md5 ${md5(ownHook)}` : red("ABSENT")}`);

    if (!entryExists) {
      console.log(`    verdict       ${red("NO HOOK WILL RUN — this is NOT a passing state")}`);
      fail(
        `${hook}: ${shimDir} has no '${hook}', so git finds no hook and commits/pushes proceed unchecked (exit 0, no warning).`,
        viaHuskyRunner
          ? `This worktree has no .husky/_ runner. Fix: npm run install-hooks (or 'npm install'), which points core.hooksPath at the TRACKED .husky (BACKLOG-3068).`
          : `This branch has no .husky/${hook}.`
      );
    } else if (!userExists) {
      console.log(`    verdict       ${red("NO HOOK WILL RUN (the runner exits 0 silently)")}`);
      fail(
        `${hook}: husky's _/h exits 0 when the user hook is missing, so this worktree is unprotected in silence.`,
        `This branch has no .husky/${hook}.`
      );
    } else if (!isOwn) {
      console.log(`    verdict       ${red("WRONG HOOK — running another checkout's file")}`);
      fail(
        `${hook}: resolves to ${userHook}, not this worktree's ${ownHook}.`,
        `core.hooksPath is absolute, so every worktree runs one checkout's hook whatever branch it holds (BACKLOG-2577). Fix: 'npm run prepare' in ${mainRoot} sets the relative, tracked '.husky' (BACKLOG-3068).`
      );
    } else {
      console.log(`    verdict       ${green("OK — this worktree's own hook")}`);
    }
    console.log("");
  }
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------
if (problems.length === 0) {
  console.log(green(bold("PROTECTED — pushes from this worktree run this worktree's own hooks.\n")));
  process.exit(0);
}

console.log(red(bold(`UNPROTECTED — ${problems.length} problem(s):\n`)));
for (const { msg, detail } of problems) {
  console.log(`  - ${msg}`);
  if (detail) console.log(`    ${detail}`);
}
console.log(
  "\n" +
    yellow("A hookless worktree loses LOCAL FAST FEEDBACK, not correctness — CI\n") +
    yellow("remains the gate, so nothing bad merges because of this.\n")
);
if (!SEED) {
  console.log(`Fix:\n\n  npm run prepare        (in ${mainRoot})\n\n` +
    "which sets core.hooksPath to the tracked '.husky' for every worktree at once\n" +
    "(BACKLOG-3068). It writes git config, so it is the repo owner's command to run.\n");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Exit-code contract (--seed): the ACTION's result, not the diagnosis's.
//
// --seed was the MANDATORY step in the canonical worktree-creation snippet
// while core.hooksPath pointed at the GENERATED `.husky/_`. In that state WRONG
// HOOK was the correct verdict for every worktree, so exiting non-zero here
// would have failed that snippet every time, aborted `set -e` flows, and
// trained readers to ignore a non-zero exit from this script.
//
// BACKLOG-3068 removed the reason: core.hooksPath is the TRACKED `.husky`, the
// snippet no longer calls --seed, and the bare diagnostic passes. The contract
// is kept anyway, because --seed still exists for the legacy state and its exit
// code should keep meaning one thing: whether the SEED worked. The bare
// `hooks:doctor` keeps strict semantics and is the diagnostic.
// ---------------------------------------------------------------------------
console.log(
  bold("--seed reports the SEED, not the diagnosis above — so this exits 0.\n") +
    "For the strict check, run:\n\n  npm run hooks:doctor\n"
);
process.exit(0);
