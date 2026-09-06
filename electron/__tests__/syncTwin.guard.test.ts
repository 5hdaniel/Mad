/**
 * @jest-environment node
 *
 * BACKLOG-2960 — A SYNC TWIN IS DERIVED FROM SOURCE, NEVER LISTED.
 *
 * ===========================================================================
 * WHAT A TWIN IS, AND WHY IT EXISTS
 * ===========================================================================
 * The data layer's exports are becoming promise-returning (the export seam,
 * SR ruling 79c3aa69). `better-sqlite3` commits when a transaction callback
 * RETURNS, so a transaction body must stay synchronous — and `dbTransaction`'s
 * type now refuses an async body. But 37 bodies call `db/**` exports from
 * inside, and those calls must stay synchronous too. Each such export therefore
 * keeps a synchronous TWIN, named `<name>Sync`, and the promise-returning
 * export becomes a one-line wrapper over it:
 *
 *     export function updateContactSync(id, fields): void { ...the work... }
 *     export async function updateContact(id, fields): Promise<void> {
 *       return updateContactSync(id, fields);
 *     }
 *
 * THE PRIMITIVE IS THE SYNC ONE. THE WRAPPER IS THE PROMISE ONE. Never the
 * reverse: a wrapper that awaits cannot be called from a body, and an `async`
 * wrapper turns a throw into a rejection the transaction never sees — it
 * COMMITS over the error (79c3aa69 §2a, executed).
 *
 * ===========================================================================
 * WHY DERIVED AND NOT A FROZEN LIST
 * ===========================================================================
 * The first ruling asked for a checked-in list of the 32 twin names with a
 * guard asserting equality — the `sql-boundary-baseline.json` shape. The
 * partition ruling (ffc832ac §6.2) struck that: every conversion PR in the
 * two-lane train would edit the same JSON file, and the train re-serialises
 * on a textual conflict the call graph says need not exist. So this guard
 * READS THE SOURCES AND DERIVES. There is no list to update; a twin is in scope
 * the moment it exists, and a conversion PR that follows the naming rule
 * passes here with no edit to this file. Same shape, same reason, as
 * `transactionMockIntegrity.guard.test.ts`: "It is caught by a machine or it
 * is not caught."
 *
 * ===========================================================================
 * THE RULE, AND WHY THE CANDIDATE SET IS "PAIRED OR REACHED"
 * ===========================================================================
 * For every twin candidate in a `db/**` production module the guard asserts:
 *
 *   (i)   it is PAIRED: the same module exports `<name>` without the suffix;
 *   (ii)  the sibling is PROMISE-RETURNING: `async`, or annotated `Promise<…>`;
 *   (iii) the twin itself is NOT promise-returning (the direction rule above);
 *   (iv)  it is REACHED from at least one transaction body through the
 *         synchronous call graph — a twin nobody calls from a body is dead
 *         weight and should not exist.
 *
 * A "twin candidate" is an exported `*Sync` function that is PAIRED or REACHED.
 * Not simply every `*Sync` export — and this is a deliberate, measured
 * deviation from ffc832ac §6.2.1's literal text, for a reason the tree
 * supplies: at `int/epic9-close` 139913c51 four `*Sync` exports have no
 * sibling and no body reaches them — `fullSync` and `classifyMacOSSync`
 * ("Sync" is the noun), `applyContactBackfillSync` and
 * `createTransactionWithContactsSync` (each CONTAINS a transaction rather than
 * being called from one). "Every `*Sync` export must have a sibling" is red on
 * day one for those four, and the only ways out are a rename that ripples
 * across three services or an allow-list — the shape this guard exists to
 * avoid. "Paired or reached" selects exactly the six real twins and none of
 * the four, from source. An unpaired, unreached `*Sync` is therefore NOT a
 * finding here; an unpaired `*Sync` that a body DOES reach is.
 *
 * ===========================================================================
 * HOW REACHABILITY IS COMPUTED, AND ITS LIMITS — STATED, NOT IMPLIED
 * ===========================================================================
 * Every production file under `electron/` is parsed with the TypeScript parser
 * (no type checker — ~0.5 s for ~460 files). A transaction body is a function
 * literal passed as the first argument to `dbTransaction(...)` or to any
 * `.transaction(...)` property call. From each body's callees the graph is
 * walked by NAME: a call `foo(...)` or `x.foo(...)` is an edge to every
 * function-like declaration named `foo`, and the walk does not enter an
 * `async` function (it is the SYNC call graph — e90659a1's definition). An
 * inline non-async function literal is walked as part of its container.
 *
 *   Name-based edges OVER-connect and never under-connect. A same-named
 *   delegate (`databaseService.updateContactSync` -> `contactDb.updateContactSync`)
 *   is followed, which is wanted; two unrelated functions sharing a name are
 *   also joined, which can only make (iv) EASIER to satisfy. The guard's
 *   strict assertions — (i), (ii), (iii) — do not depend on the graph.
 *
 *   The walk stops at `async` on purpose. A twin reached ONLY through its own
 *   promise-returning sibling is reported as unreached — and that is the
 *   anti-pattern (a body calling the wrapper) surfacing as a red, not a hole.
 *
 *   "Promise-returning" is read from syntax: the `async` keyword or an explicit
 *   `Promise<…>` return annotation. A plain wrapper with no annotation reads as
 *   not promise-returning and goes red under (ii). Annotate it — the ruled
 *   wrapper shape is `function x(): Promise<T> { return Promise.resolve(xSync()) }`.
 *
 *   "Exported" is read from syntax too: `export function …` and `export const …`.
 *   A name exported through an `export { fooSync }` list, an `export { x as
 *   fooSync }` rename, or `export default` is NOT enumerated — it is neither a
 *   candidate nor a sibling. No db/** module exports a function that way at
 *   139913c51; a twin written that way would be invisible here, so do not.
 *
 * Calibration against numbers this file did not produce (SR rulings 79c3aa69 /
 * ffc832ac, both measured with a type-checker-resolved graph): 37 transaction
 * bodies, 16 of them outside `db/**`; the SR-named twins `recordVerdict`,
 * `resolveProposal`, `writeContactOriginInTransaction`, `createLink`,
 * `listPendingProposals`, `getLatestVerdict`, `columnList`, `deleteLiveForceSet`
 * all reached. Both instruments agree.
 */

import fs from "fs";
import path from "path";
import ts from "typescript";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SCAN_ROOT = "electron";
const DB_LAYER = "electron/services/db/";
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "__tests__", "__mocks__", "__typefixtures__"]);

/** Every production TypeScript file under `electron/`, repo-relative, sorted. */
function productionSources(): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
      } else if (/\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
        found.set(path.relative(REPO_ROOT, full).split(path.sep).join("/"), fs.readFileSync(full, "utf8"));
      }
    }
  };
  walk(path.join(REPO_ROOT, SCAN_ROOT));
  return new Map([...found.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

type FnNode = ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression;

interface FnDecl {
  file: string;
  name: string;
  node: FnNode;
}

interface Analysis {
  /** file:line of every transaction body found. */
  bodies: string[];
  /** Every function name reachable from a transaction body through the sync call graph. */
  reached: Set<string>;
  /** Exported `*Sync` functions of db/** modules, with the facts the rule needs. */
  syncExports: SyncExport[];
}

interface SyncExport {
  file: string;
  name: string;
  paired: boolean;
  siblingPromiseReturning: boolean;
  twinPromiseReturning: boolean;
  reached: boolean;
}

function isFnLike(n: ts.Node): n is FnNode {
  return ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n);
}

function hasModifier(n: ts.Node, kind: ts.SyntaxKind): boolean {
  return !!(ts.canHaveModifiers(n) && ts.getModifiers(n)?.some((m) => m.kind === kind));
}

function isAsync(n: FnNode): boolean {
  return hasModifier(n, ts.SyntaxKind.AsyncKeyword);
}

/** `async`, or an explicit `Promise<…>` / `PromiseLike<…>` return annotation. */
function isPromiseReturning(n: FnNode): boolean {
  if (isAsync(n)) return true;
  const annotation = n.type?.getText();
  return !!annotation && /^(Promise|PromiseLike)\b/.test(annotation);
}

/** The declared name of a function-like node, or null for an anonymous literal. */
function declaredName(n: FnNode): string | null {
  if (ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) {
    return n.name && ts.isIdentifier(n.name) ? n.name.text : null;
  }
  const p = n.parent;
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  if (p && ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) return p.name.text;
  return null;
}

/** Is this named function-like node exported from its module? */
function isExported(n: FnNode): boolean {
  if (ts.isFunctionDeclaration(n)) return hasModifier(n, ts.SyntaxKind.ExportKeyword);
  if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
    const decl = n.parent;
    if (!decl || !ts.isVariableDeclaration(decl)) return false;
    const stmt = decl.parent?.parent;
    return !!stmt && ts.isVariableStatement(stmt) && hasModifier(stmt, ts.SyntaxKind.ExportKeyword);
  }
  return false;
}

/**
 * Is this call a transaction call with a literal body? `dbTransaction(() => …)`
 * or `<anything>.transaction(() => …)`. A non-literal argument (the `fn`
 * parameter inside `dbTransaction` itself) is not a body.
 */
function transactionBodyOf(call: ts.CallExpression): FnNode | null {
  const c = call.expression;
  const isTx =
    (ts.isIdentifier(c) && c.text === "dbTransaction") ||
    (ts.isPropertyAccessExpression(c) && c.name.text === "transaction");
  if (!isTx) return null;
  const arg = call.arguments[0];
  return arg && (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) ? arg : null;
}

/**
 * The names this function calls, synchronously. Nested NON-async literals are
 * part of their container (a `for` body's arrow, a `.forEach` callback); a
 * nested `async` literal is a boundary and is not entered.
 */
function calleeNames(fn: FnNode): Set<string> {
  const out = new Set<string>();
  const visit = (n: ts.Node): void => {
    if (n !== fn && isFnLike(n) && isAsync(n)) return;
    if (ts.isCallExpression(n)) {
      const c = n.expression;
      if (ts.isIdentifier(c)) out.add(c.text);
      else if (ts.isPropertyAccessExpression(c)) out.add(c.name.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(fn.body ?? fn);
  return out;
}

/** The derivation, over any set of sources — the tree, or fabricated ones. */
function analyze(sources: Map<string, string>): Analysis {
  const declsByName = new Map<string, FnDecl[]>();
  const exportsByFile = new Map<string, Map<string, FnNode>>();
  const bodies: { at: string; node: FnNode }[] = [];

  for (const [file, text] of sources) {
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2020, true);
    const exported = new Map<string, FnNode>();
    exportsByFile.set(file, exported);

    const visit = (n: ts.Node): void => {
      if (isFnLike(n)) {
        const name = declaredName(n);
        if (name) {
          const list = declsByName.get(name) ?? [];
          list.push({ file, name, node: n });
          declsByName.set(name, list);
          if (isExported(n)) exported.set(name, n);
        }
      }
      if (ts.isCallExpression(n)) {
        const body = transactionBodyOf(n);
        if (body) {
          const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
          bodies.push({ at: `${file}:${line + 1}`, node: body });
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }

  const reached = new Set<string>();
  for (const body of bodies) {
    const queue = [...calleeNames(body.node)];
    while (queue.length > 0) {
      const name = queue.pop() as string;
      if (reached.has(name)) continue;
      reached.add(name);
      for (const decl of declsByName.get(name) ?? []) {
        if (isAsync(decl.node)) continue;
        for (const callee of calleeNames(decl.node)) if (!reached.has(callee)) queue.push(callee);
      }
    }
  }

  const syncExports: SyncExport[] = [];
  for (const [file, exported] of exportsByFile) {
    if (!file.startsWith(DB_LAYER)) continue;
    for (const [name, node] of exported) {
      if (!/Sync$/.test(name) || name === "Sync") continue;
      const sibling = exported.get(name.slice(0, -"Sync".length));
      syncExports.push({
        file,
        name,
        paired: sibling !== undefined,
        siblingPromiseReturning: sibling !== undefined && isPromiseReturning(sibling),
        twinPromiseReturning: isPromiseReturning(node),
        reached: reached.has(name),
      });
    }
  }

  return { bodies: bodies.map((b) => b.at).sort(), reached, syncExports };
}

/** Twin candidates: paired OR reached (see the header for why not "every `*Sync`"). */
function candidates(analysis: Analysis): SyncExport[] {
  return analysis.syncExports.filter((s) => s.paired || s.reached);
}

/** The rule. Every string returned is one violated clause, naming the twin. */
function problemsOf(twin: SyncExport): string[] {
  const base = twin.name.slice(0, -"Sync".length);
  const out: string[] = [];
  if (!twin.paired) out.push(`${twin.file}: ${twin.name} is reached from a transaction body but the module exports no \`${base}\` — a twin without its promise-returning wrapper`);
  else if (!twin.siblingPromiseReturning) out.push(`${twin.file}: ${base} is not promise-returning (neither \`async\` nor annotated \`Promise<…>\`) — the wrapper must be the promise side`);
  if (twin.twinPromiseReturning) out.push(`${twin.file}: ${twin.name} returns a promise — the *Sync twin must be the synchronous primitive, never the wrapper`);
  if (!twin.reached) out.push(`${twin.file}: ${twin.name} is not reached from any transaction body — a dead twin; delete it or call it where the transaction is`);
  return out;
}

function offenders(analysis: Analysis): string[] {
  return candidates(analysis).flatMap(problemsOf).sort();
}

describe("a sync twin is derived from source, never listed (BACKLOG-2960)", () => {
  const tree = analyze(productionSources());

  /**
   * THE GUARD.
   *
   * An exact SET, never a count. When this fails it names the twin and the
   * clause, so the fix is a named function in a named module — not a hunt.
   */
  it("every twin candidate in db/** is paired with a promise-returning sibling, is itself synchronous, and is reached from a transaction body", () => {
    expect(offenders(tree)).toEqual([]);
  });

  /**
   * THE GUARD'S OWN CONTROL — the scan must reach what it is meant to police.
   *
   * A walker that resolved the wrong root, a parser that stopped finding call
   * expressions, or a filter that quietly excluded everything would all leave
   * the assertion above passing over an EMPTY set — indistinguishable from a
   * clean tree. So the bodies are asserted to include one inside `db/**` and one
   * OUTSIDE it (the harder case: sixteen of the 37 live in handlers and
   * services), and the candidate set is anchored on two twins that pre-date
   * the conversion and are in the frozen 32: `updateContactSync` (BACKLOG-2496)
   * and `createTransactionSync` (BACKLOG-2538). If either is renamed, this
   * fails and says so — which is correct, because the guard's scope changed.
   */
  it("PRECONDITION: the scan reaches transaction bodies inside and outside db/**, and the twins that already exist", () => {
    expect(tree.bodies.length).toBeGreaterThanOrEqual(20);
    expect(tree.bodies.some((b) => b.startsWith("electron/services/db/transactionDbService.ts:"))).toBe(true);
    expect(tree.bodies.some((b) => b.startsWith("electron/handlers/contactHandlers.ts:"))).toBe(true);

    const names = candidates(tree).map((c) => c.name);
    expect(names).toContain("updateContactSync");
    expect(names).toContain("createTransactionSync");
    // Reached only transitively (body -> createTransactionSync -> it): proves the
    // walk is a graph walk, not a search of the body's own text.
    expect(names).toContain("getTransactionByIdSync");
  });

  /**
   * PROVES THE RULE CAN SAY NO.
   *
   * Run against fabricated sources rather than the tree, so it keeps working
   * when the tree is clean — which is the state the repo is supposed to be in,
   * and therefore the state in which the assertion above stops discriminating.
   * Each case is one clause of the rule, and one is the shape that must NOT be
   * a finding (the `fullSync` noun), so a future "tighten it to every *Sync"
   * has to come through here.
   */
  it("PRECONDITION: the rule rejects each defective twin shape and accepts the real one", () => {
    const db = (name: string, text: string): [string, string] => [`${DB_LAYER}${name}.ts`, text];
    const svc = (name: string, text: string): [string, string] => [`electron/services/${name}.ts`, text];

    const verdict = (files: [string, string][]): string[] => offenders(analyze(new Map(files)));

    // (a) The real shape: sync primitive + async wrapper, called from a body. Clean.
    expect(
      verdict([
        db("a", `export function createLinkSync(): void {}\nexport async function createLink(): Promise<void> { return createLinkSync(); }`),
        svc("caller", `dbTransaction(() => { createLinkSync(); });`),
      ]),
    ).toEqual([]);

    // (a') The ruled wrapper shape — a PLAIN function annotated Promise<…>. Also clean.
    expect(
      verdict([
        db("a", `export function createLinkSync(): number { return 1; }\nexport function createLink(): Promise<number> { return Promise.resolve(createLinkSync()); }`),
        svc("caller", `dbTransaction(() => { createLinkSync(); });`),
      ]),
    ).toEqual([]);

    // (b) Reached from a body, but no sibling: a twin without its wrapper.
    expect(
      verdict([
        db("b", `export function fooSync(): void {}`),
        svc("caller", `db.transaction(() => { fooSync(); });`),
      ]),
    ).toEqual([`${DB_LAYER}b.ts: fooSync is reached from a transaction body but the module exports no \`foo\` — a twin without its promise-returning wrapper`]);

    // (c) Paired, but no body reaches it: a dead twin.
    expect(
      verdict([
        db("c", `export function barSync(): void {}\nexport async function bar(): Promise<void> { return barSync(); }`),
        svc("caller", `export async function elsewhere() { await bar(); }`),
      ]),
    ).toEqual([`${DB_LAYER}c.ts: barSync is not reached from any transaction body — a dead twin; delete it or call it where the transaction is`]);

    // (d) Paired and reached, but the sibling is synchronous: the wrapper is not a wrapper.
    expect(
      verdict([
        db("d", `export function bazSync(): void {}\nexport function baz(): void { bazSync(); }`),
        svc("caller", `dbTransaction(() => { bazSync(); });`),
      ]),
    ).toEqual([`${DB_LAYER}d.ts: baz is not promise-returning (neither \`async\` nor annotated \`Promise<…>\`) — the wrapper must be the promise side`]);

    // (e) The reverse direction: the *Sync side is the async one.
    expect(
      verdict([
        db("e", `export async function quxSync(): Promise<void> {}\nexport async function qux(): Promise<void> { await quxSync(); }`),
        svc("caller", `dbTransaction(() => { quxSync(); });`),
      ]),
    ).toEqual([`${DB_LAYER}e.ts: quxSync returns a promise — the *Sync twin must be the synchronous primitive, never the wrapper`]);

    // (f) Reached only THROUGH the async sibling — the body calls the wrapper.
    //     The sync walk stops at `async`, so the twin reads as unreached: red.
    expect(
      verdict([
        db("f", `export function readSync(): number { return 1; }\nexport async function read(): Promise<number> { return readSync(); }`),
        svc("caller", `dbTransaction(() => { void read(); });`),
      ]),
    ).toEqual([`${DB_LAYER}f.ts: readSync is not reached from any transaction body — a dead twin; delete it or call it where the transaction is`]);

    // (g) Transitive reach through a sync helper in another file is reach.
    expect(
      verdict([
        db("g", `export function deepSync(): void {}\nexport async function deep(): Promise<void> { return deepSync(); }`),
        svc("helper", `export function viaHelper(): void { deepSync(); }`),
        svc("caller", `dbTransaction(() => { viaHelper(); });`),
      ]),
    ).toEqual([]);

    // (h) The noun: unpaired AND unreached is not a twin and not a finding.
    //     This is `fullSync` / `classifyMacOSSync` / `applyContactBackfillSync` /
    //     `createTransactionWithContactsSync` at 139913c51.
    expect(
      verdict([
        db("h", `export function fullSync(): void { db.transaction(() => { doWork(); })(); }`),
        svc("caller", `export function elsewhere(): void { fullSync(); }`),
      ]),
    ).toEqual([]);

    // (i) Outside db/** nothing is a candidate, whatever it is called.
    expect(
      verdict([
        svc("notDb", `export function thingSync(): void {}`),
        svc("caller", `dbTransaction(() => { thingSync(); });`),
      ]),
    ).toEqual([]);
  });

  /**
   * The scope is the production tree. A test file that mocks a `*Sync` export,
   * or a type fixture that spells the defect on purpose, must not become a twin
   * candidate or a transaction body.
   */
  it("PRECONDITION: test files, mocks and type fixtures are outside the scan", () => {
    const files = [...productionSources().keys()];
    expect(files.length).toBeGreaterThan(300);
    expect(files.filter((f) => /\.test\.ts$/.test(f) || /\/(__tests__|__mocks__|__typefixtures__)\//.test(f))).toEqual([]);
    expect(files).toContain("electron/services/db/core/dbConnection.ts");
  });
});
