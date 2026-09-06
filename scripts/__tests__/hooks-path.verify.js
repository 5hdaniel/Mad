#!/usr/bin/env node
/**
 * VERIFICATION HARNESS for the hooks path — BACKLOG-3068
 * =============================================================================
 * `core.hooksPath` is a setting that fails SILENTLY IN BOTH DIRECTIONS. A
 * worktree whose hooks do not run reports nothing: the commit is accepted, the
 * push proceeds, exit code 0. And nothing reports that the value was reset —
 * `npm install` rewrites it as a side effect of installing dependencies.
 *
 * That is why this file exists rather than a line in a doc. Every claim the fix
 * rests on is executed here against a real throwaway git repository with a real
 * linked worktree, and each control is written so it can go RED.
 *
 *   C1   relative `.husky/_`, worktree NOT seeded  -> NO hook runs, commit rc=0
 *                                                     (the defect, reproduced)
 *   C2   absolute `<main>/.husky/_`                -> runs the MAIN checkout's
 *                                                     file (BACKLOG-2577)
 *   C3   relative `.husky` (tracked hooks)         -> runs the WORKTREE's OWN
 *                                                     file (the fix)
 *   C4   `.husky` resolves from a SUBDIRECTORY     -> still the worktree's own
 *   C5   install-hooks.mjs after husky wrote `_`   -> core.hooksPath = `.husky`
 *                                                     (the npm-install control)
 *   C6   install-hooks.mjs with HUSKY=0            -> config left UNTOUCHED
 *   C7   the shipped hooks are tracked at 100755   -> the property that makes a
 *                                                     tracked hook executable in
 *                                                     a fresh worktree at all
 *   C8   `set -e` is IN FORCE in the real hooks    -> an unguarded failing
 *                                                     command aborts the hook
 *   C9   the same hooks WITHOUT `set -e`           -> do NOT abort (proves C8
 *                                                     measures errexit, not the
 *                                                     injected command)
 *   C10  hooks-doctor verdicts for all three states
 *
 * ## C8/C9 are the pair that matters
 *
 * Until BACKLOG-3068 the hooks got errexit from husky's wrapper (`sh -e "$s"`).
 * Git executes them directly, and a `#!/bin/sh` shebang carries no `-e`, so
 * `set -e` had to move into the files. `.husky/pre-push` has 4 `|| true` guards
 * and 5 `|| exit_code=$?` runner calls, and `.husky/pre-commit` has 1 `|| true`
 * — all of which are DEAD CODE without errexit. C8 asserts the property; C9 is
 * its control, because an assertion that cannot fail is not evidence.
 *
 * NOTE ON THE SHAPE THAT ABORTS. A failing test on the LEFT of `&&` does not
 * abort under errexit — POSIX exempts every command of an AND-OR list except
 * the last. The shape that aborts is an UNGUARDED failing command, which is
 * what C8 injects.
 *
 * ## Safety
 *
 * Every git and node invocation below passes an explicit `cwd` inside a fresh
 * `mkdtemp` directory, and `runInstallHooks` REFUSES to run outside the system
 * temp dir. This harness writes `core.hooksPath`, so a cwd mistake would edit
 * the developer's own repository config.
 *
 * Run: `npm run verify:hooks-path`
 */

const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "..", "..");
const INSTALL_HOOKS = path.join(REPO_ROOT, "scripts", "install-hooks.mjs");
const HOOKS_DOCTOR = path.join(REPO_ROOT, "scripts", "hooks-doctor.mjs");
const REAL_HOOKS = path.join(REPO_ROOT, ".husky");

const results = [];
const record = (id, name, ok, detail) => results.push({ id, name, ok, detail });

const git = (cwd, args) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/**
 * A throwaway repo shaped like this one: `.husky/pre-commit` and
 * `.husky/pre-push` TRACKED and executable, `.husky/_` present in the main
 * checkout and UNTRACKED, plus a linked worktree that therefore has no `_`.
 * The hook appends its own `$0` to a marker file so we can tell WHICH file ran.
 */
function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hookspath-verify-"));
  const main = path.join(dir, "main");
  fs.mkdirSync(main);
  git(main, ["init", "-q", "-b", "main"]);
  git(main, ["config", "user.email", "verify@example.invalid"]);
  git(main, ["config", "user.name", "verify"]);
  git(main, ["config", "commit.gpgsign", "false"]);

  const husky = path.join(main, ".husky");
  fs.mkdirSync(path.join(husky, "_"), { recursive: true });

  // Tracked user hooks. `main` in the body identifies WHICH checkout's file ran.
  for (const hook of ["pre-commit", "pre-push"]) {
    fs.writeFileSync(
      path.join(husky, hook),
      `#!/bin/sh\necho "RAN=main/$0" >> "$MARKER"\n`,
      { mode: 0o755 },
    );
  }

  // husky's generated runner, reproduced from node_modules/husky/husky (v9.1.7)
  // in the parts that decide WHICH file executes.
  fs.writeFileSync(
    path.join(husky, "_", "h"),
    `#!/usr/bin/env sh\ns=$(dirname "$(dirname "$0")")/$(basename "$0")\n[ ! -f "$s" ] && exit 0\nsh -e "$s" "$@"\n`,
    { mode: 0o755 },
  );
  fs.writeFileSync(path.join(husky, "_", ".gitignore"), "*\n");
  for (const hook of ["pre-commit", "pre-push"]) {
    fs.writeFileSync(
      path.join(husky, "_", hook),
      `#!/usr/bin/env sh\n. "$(dirname "$0")/h"\n`,
      { mode: 0o755 },
    );
  }

  fs.writeFileSync(path.join(main, "f.txt"), "seed\n");
  git(main, ["add", "-A"]);
  git(main, ["commit", "-q", "-m", "init"]);

  // The linked worktree, on its own branch, with its OWN tracked hooks and — by
  // husky's design — no `_` directory.
  const wt = path.join(dir, "wt");
  git(main, ["worktree", "add", "-q", wt, "-b", "wtbranch"]);
  git(wt, ["config", "user.email", "verify@example.invalid"]);
  git(wt, ["config", "user.name", "verify"]);
  git(wt, ["config", "commit.gpgsign", "false"]);
  // Make the worktree's own hooks distinguishable from the main checkout's.
  for (const hook of ["pre-commit", "pre-push"]) {
    fs.writeFileSync(
      path.join(wt, ".husky", hook),
      `#!/bin/sh\necho "RAN=wt/$0" >> "$MARKER"\n`,
      { mode: 0o755 },
    );
  }
  git(wt, ["add", "-A"]);
  git(wt, ["commit", "-q", "-m", "worktree hooks"]);

  return { dir, main, wt };
}

/** Commit in `cwd` and report what the marker file caught. */
function commitAndSee({ dir, cwd }) {
  const marker = path.join(dir, `marker-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(marker, "");
  fs.appendFileSync(path.join(cwd, "f.txt"), `${Math.random()}\n`);
  const env = { ...process.env, MARKER: marker };
  spawnSync("git", ["add", "-A"], { cwd, env });
  const r = spawnSync("git", ["commit", "-q", "-m", "probe"], { cwd, env, encoding: "utf8" });
  return { code: r.status, ran: fs.readFileSync(marker, "utf8").trim() };
}

/**
 * Run the real `prepare` script against a throwaway repo. Refuses to run
 * anywhere but the system temp dir — this call WRITES `core.hooksPath`.
 */
function runInstallHooks(cwd, env = {}) {
  const real = fs.realpathSync(cwd);
  if (!real.startsWith(fs.realpathSync(os.tmpdir()))) {
    throw new Error(`refusing to run install-hooks outside the temp dir: ${real}`);
  }
  return spawnSync(process.execPath, [INSTALL_HOOKS], {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

// --- C1/C2/C3/C4: which file runs, per hooksPath value -----------------------
{
  const { dir, main, wt } = makeRepo();
  try {
    git(main, ["config", "core.hooksPath", ".husky/_"]);
    const c1 = commitAndSee({ dir, cwd: wt });
    record(
      "C1",
      "relative `.husky/_`, worktree not seeded -> NO hook runs, commit accepted",
      c1.code === 0 && c1.ran === "",
      `commit rc=${c1.code}, marker=${JSON.stringify(c1.ran)} (the defect: silent, exit 0)`,
    );

    git(main, ["config", "core.hooksPath", path.join(main, ".husky", "_")]);
    const c2 = commitAndSee({ dir, cwd: wt });
    record(
      "C2",
      "absolute `<main>/.husky/_` -> runs the MAIN checkout's file (BACKLOG-2577)",
      c2.code === 0 && c2.ran.startsWith("RAN=main/"),
      `marker=${JSON.stringify(c2.ran)}`,
    );

    git(main, ["config", "core.hooksPath", ".husky"]);
    const c3 = commitAndSee({ dir, cwd: wt });
    record(
      "C3",
      "relative `.husky` (tracked hooks) -> runs the WORKTREE's OWN file (the fix)",
      c3.code === 0 && c3.ran.startsWith("RAN=wt/"),
      `marker=${JSON.stringify(c3.ran)}`,
    );

    const deep = path.join(wt, "deep", "er");
    fs.mkdirSync(deep, { recursive: true });
    fs.writeFileSync(path.join(deep, "g.txt"), "x\n");
    const marker = path.join(dir, "marker-subdir");
    fs.writeFileSync(marker, "");
    const env = { ...process.env, MARKER: marker };
    spawnSync("git", ["add", "-A"], { cwd: deep, env });
    const r4 = spawnSync("git", ["commit", "-q", "-m", "subdir"], { cwd: deep, env, encoding: "utf8" });
    const ran4 = fs.readFileSync(marker, "utf8").trim();
    record(
      "C4",
      "relative `.husky` resolves from a SUBDIRECTORY of the worktree",
      r4.status === 0 && ran4.startsWith("RAN=wt/"),
      `marker=${JSON.stringify(ran4)} (git runs hooks with cwd = worktree top level)`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// --- C5/C6: the prepare script -----------------------------------------------
{
  const { dir, main, wt } = makeRepo();
  try {
    // Put the repo in the state husky leaves it in, then run the real prepare.
    git(main, ["config", "core.hooksPath", ".husky/_"]);
    const r = runInstallHooks(main);
    const after = git(main, ["config", "--get", "core.hooksPath"]);
    const c5 = commitAndSee({ dir, cwd: wt });
    record(
      "C5",
      "install-hooks after husky wrote `_` -> core.hooksPath = `.husky`, worktree protected",
      r.status === 0 && after === ".husky" && c5.ran.startsWith("RAN=wt/"),
      `exit=${r.status}, core.hooksPath=${JSON.stringify(after)}, marker=${JSON.stringify(c5.ran)}`,
    );

    git(main, ["config", "core.hooksPath", "SENTINEL-untouched"]);
    const r6 = runInstallHooks(main, { HUSKY: "0" });
    const after6 = git(main, ["config", "--get", "core.hooksPath"]);
    record(
      "C6",
      "install-hooks with HUSKY=0 -> exits 0 and leaves core.hooksPath UNTOUCHED",
      r6.status === 0 && after6 === "SENTINEL-untouched",
      `exit=${r6.status}, core.hooksPath=${JSON.stringify(after6)}`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// --- C7: the shipped hooks are tracked, and executable ------------------------
{
  const listed = execFileSync("git", ["ls-files", "-s", ".husky"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [meta, file] = line.split("\t");
      return { mode: meta.split(" ")[0], file };
    });
  const need = [".husky/pre-commit", ".husky/pre-push"];
  const ok = need.every((f) => listed.some((e) => e.file === f && e.mode === "100755"));
  record(
    "C7",
    "the shipped hooks are TRACKED at mode 100755",
    ok,
    listed.map((e) => `${e.mode} ${e.file}`).join(", ") ||
      "nothing tracked under .husky — a fresh worktree would have no hooks at all",
  );
}

// --- C8/C9: is `set -e` actually in force in the real hook files? -------------
/**
 * Takes the REAL hook, injects an unguarded failing command right after its
 * prelude, and stops immediately after. Under errexit the `false` aborts and
 * `exit 0` is never reached. `stripSetE` removes the `set -e` line first, which
 * is the control: if the hook still aborts without it, the probe is measuring
 * something other than errexit.
 */
function probeErrexit(hookName, stripSetE, inject = ["false"]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hookspath-errexit-"));
  try {
    const src = fs.readFileSync(path.join(REAL_HOOKS, hookName), "utf8");
    const lines = src.split("\n");
    const setEIndex = lines.findIndex((l) => l.trim() === "set -e");
    if (setEIndex === -1) return { missing: true };
    const body = stripSetE
      ? [...lines.slice(0, setEIndex), ...lines.slice(setEIndex + 1)]
      : lines.slice();
    const injectAt = stripSetE ? setEIndex : setEIndex + 1;
    body.splice(injectAt, 0, ...inject, 'echo "REACHED_PAST_FAILURE"', "exit 0");
    const file = path.join(dir, hookName);
    fs.writeFileSync(file, body.join("\n"), { mode: 0o755 });
    const r = spawnSync(file, [], { cwd: dir, encoding: "utf8" });
    return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

for (const hook of ["pre-commit", "pre-push"]) {
  const withSetE = probeErrexit(hook, false);
  record(
    `C8.${hook}`,
    `${hook}: \`set -e\` IN FORCE — an unguarded failing command aborts the hook`,
    !withSetE.missing && withSetE.code !== 0 && !withSetE.out.includes("REACHED_PAST_FAILURE"),
    withSetE.missing
      ? "no `set -e` line in the hook — errexit is not in force and every `|| true` guard is dead code"
      : `exit=${withSetE.code}, reached-past-failure=${withSetE.out.includes("REACHED_PAST_FAILURE")}`,
  );

  // The other half, and what makes the "4 `|| true` guards + 5 `|| exit_code=$?`
  // calls are dead code without errexit" claim EXECUTABLE rather than merely
  // stated: under errexit a GUARDED failure must NOT abort. C8 alone would stay
  // green if the guard pattern itself were broken.
  const guarded = probeErrexit(hook, false, ["false || true"]);
  record(
    `C8b.${hook}`,
    `${hook}: under \`set -e\`, a GUARDED failure (\`|| true\`) does NOT abort — the guards work`,
    !guarded.missing && guarded.code === 0 && guarded.out.includes("REACHED_PAST_FAILURE"),
    guarded.missing
      ? "no `set -e` line in the hook"
      : `exit=${guarded.code}, reached-past-failure=${guarded.out.includes("REACHED_PAST_FAILURE")}`,
  );

  const without = probeErrexit(hook, true);
  record(
    `C9.${hook}`,
    `${hook}: control — same hook WITHOUT \`set -e\` does NOT abort`,
    !without.missing && without.code === 0 && without.out.includes("REACHED_PAST_FAILURE"),
    without.missing
      ? "no `set -e` line to strip"
      : `exit=${without.code}, reached-past-failure=${without.out.includes("REACHED_PAST_FAILURE")}`,
  );
}

// --- C10: hooks-doctor tells the three states apart ---------------------------
{
  const { dir, main, wt } = makeRepo();
  try {
    const doctor = (hooksPath) => {
      git(main, ["config", "core.hooksPath", hooksPath]);
      const r = spawnSync(process.execPath, [HOOKS_DOCTOR], { cwd: wt, encoding: "utf8" });
      // eslint-disable-next-line no-control-regex
      return { code: r.status, out: (r.stdout ?? "").replace(/\[[0-9;]*m/g, "") };
    };

    const good = doctor(".husky");
    record(
      "C10a",
      "hooks-doctor: `.husky` -> PROTECTED, exit 0",
      good.code === 0 && good.out.includes("PROTECTED"),
      `exit=${good.code}`,
    );

    const unseeded = doctor(".husky/_");
    record(
      "C10b",
      "hooks-doctor: `.husky/_` with no runner -> UNPROTECTED, exit 1",
      unseeded.code === 1 && unseeded.out.includes("NO HOOK WILL RUN"),
      `exit=${unseeded.code}`,
    );

    const absolute = doctor(path.join(main, ".husky", "_"));
    record(
      "C10c",
      "hooks-doctor: absolute -> WRONG HOOK, exit 1",
      absolute.code === 1 && absolute.out.includes("WRONG HOOK"),
      `exit=${absolute.code}`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// --- report ------------------------------------------------------------------
let failed = 0;
console.log("hooks path — verification harness (BACKLOG-3068)");
console.log("");
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(14)} ${r.name}`);
  console.log(`          ${r.detail}`);
}
console.log("");
console.log(`  ${results.length - failed}/${results.length} controls passed`);
process.exit(failed ? 1 : 0);
