/**
 * THE COMPOSITION-ROOT GUARD, static half (BACKLOG-2962).
 *
 * THE DEFECT THIS EXISTS FOR, reproduced on this branch before it was written:
 * deleting `electron/main.ts:12` — `import "./bootstrap/installNativeCapabilities";`
 * — left 41 affected suites (815 tests) identically green,
 * `tsc -p tsconfig.electron.json` at exit 0 and `check:native-capabilities` at
 * exit 0. Nothing in the repository could observe it, and the app would have
 * launched and never shown a window.
 *
 * `guards the real tree` below is the test that mutation now reds.
 *
 * The planted cases are not padding. Half of them assert the guard stays
 * GREEN — on a different install order, a different-but-valid import path, a
 * namespace import, an alias, a `require()`. A guard that only ever fires on
 * the one mutation it was written against is a name-matcher, and this repo has
 * shipped seven of those.
 *
 * WHAT THIS FILE DOES NOT COVER is stated in full in
 * `tests/helpers/compositionRootStatic.ts`'s header — read it there rather than
 * inferring coverage from the case list below. In short: no re-exports, no
 * wrapper functions, no dynamic import, no default-import form, no ordering, no
 * bundler, and `installAppDataPaths` is out of scope rather than covered.
 */

import * as fs from "fs";
import * as path from "path";

import {
  checkCompositionRoot,
  resolveSpecifier,
  type Finding,
  type RequiredCall,
} from "../../../tests/helpers/compositionRootStatic";
import {
  COMPOSITION_ROOT,
  NATIVE_CAPABILITIES,
  REQUIRED_COMPOSITION_ROOT_CALLS,
  SHELL_ENTRY,
} from "../nativeCapabilities";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

/** Read a repo-relative POSIX path off disk. */
function readRepo(relPosix: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, ...relPosix.split("/")), "utf8");
}

/**
 * Every call the real composition root must make: one per registered
 * capability, plus the runtime self-check itself.
 */
const REQUIRED: RequiredCall[] = [
  ...NATIVE_CAPABILITIES.map((c) => ({
    name: c.name,
    providerModule: c.providerModule,
    installFunction: c.installFunction,
  })),
  ...REQUIRED_COMPOSITION_ROOT_CALLS,
];

const REAL_ENTRY_SOURCE = readRepo(SHELL_ENTRY);
const REAL_ROOT_SOURCE = readRepo(`${COMPOSITION_ROOT}.ts`);

/**
 * A minimal entry module that satisfies E1.
 *
 * Every case below that is about C1 uses THIS rather than the real `main.ts`,
 * so each case proves one rule and nothing else. That is deliberate: with the
 * real entry source shared everywhere, deleting `main.ts:12` reddened fourteen
 * tests instead of one, and a fourteen-test failure says less about what broke
 * than a single precisely-named one does. `guards the real tree` is the only
 * case that reads the real `main.ts`, and it is the one control 2 mutates.
 */
const VALID_ENTRY = `import "./bootstrap/installNativeCapabilities";\n`;

/** Run the guard over supplied sources. */
function check(over: {
  entrySource?: string;
  compositionRootSource?: string;
  requiredCalls?: RequiredCall[];
}): Finding[] {
  return checkCompositionRoot({
    entryFile: SHELL_ENTRY,
    entrySource: over.entrySource ?? VALID_ENTRY,
    compositionRoot: COMPOSITION_ROOT,
    compositionRootSource: over.compositionRootSource ?? REAL_ROOT_SOURCE,
    requiredCalls: over.requiredCalls ?? REQUIRED,
  });
}

const subjects = (findings: Finding[]): string[] => findings.map((f) => f.subject);
const rules = (findings: Finding[]): string[] => findings.map((f) => f.rule);

// ===========================================================================
// THE REAL TREE — this is what control 2 mutates
// ===========================================================================

describe("composition-root guard: the real tree (BACKLOG-2962)", () => {
  it("guards the real tree: main.ts imports the composition root and it installs every registered capability", () => {
    const findings = check({ entrySource: REAL_ENTRY_SOURCE });
    // Print the detail, not just a count: a bare `toHaveLength(0)` failure tells
    // the next engineer nothing about which rule fired.
    expect(findings.map((f) => `${f.rule} ${f.subject}: ${f.detail}`)).toEqual([]);
  });

  it("the registry is not empty, so the assertion above cannot pass vacuously", () => {
    // A guard over an empty required-call list passes trivially. If a future
    // refactor empties NATIVE_CAPABILITIES, every C1 case in this file becomes
    // a no-op and the suite would still be green. This is that trip-wire.
    expect(NATIVE_CAPABILITIES.length).toBeGreaterThan(0);
    expect(REQUIRED.map((r) => r.name)).toEqual(["secretStore", "the runtime self-check"]);
  });

  it("names the capabilities it is actually checking", () => {
    // Enumerated, not counted — a count cannot tell a renamed capability from a
    // deleted one.
    expect(NATIVE_CAPABILITIES.map((c) => c.name)).toEqual(["secretStore"]);
    expect(NATIVE_CAPABILITIES.map((c) => c.installFunction)).toEqual(["installSecretStore"]);
    expect(NATIVE_CAPABILITIES.map((c) => c.providerModule)).toEqual([
      "electron/capabilities/secretStoreProvider",
    ]);
  });
});

// ===========================================================================
// MUST FIRE
// ===========================================================================

describe("composition-root guard: must fire", () => {
  it("E1 — the entry module does not import the composition root at all", () => {
    const stripped = REAL_ENTRY_SOURCE.split("\n")
      .filter((l) => !l.includes(`bootstrap/installNativeCapabilities`))
      .join("\n");
    const findings = check({ entrySource: stripped });

    expect(rules(findings)).toContain("E1");
    expect(findings[0].detail).toContain(COMPOSITION_ROOT);
  });

  it("E1 — a dynamic import() is not recognised, at any position (a conservative false positive, documented)", () => {
    const findings = check({
      entrySource: [
        `function lazyBoot() {`,
        `  import("./bootstrap/installNativeCapabilities");`,
        `}`,
        `lazyBoot();`,
      ].join("\n"),
    });
    expect(rules(findings)).toContain("E1");
  });

  it("E1 — a same-basename module in another directory does not satisfy it", () => {
    // `electron/installNativeCapabilities` is NOT `electron/bootstrap/installNativeCapabilities`.
    // A basename or `endsWith` matcher would wave this through.
    const findings = check({ entrySource: `import "./installNativeCapabilities";\n` });
    expect(rules(findings)).toContain("E1");
  });

  it("C1 — the install call is deleted from the composition root, and secretStore is named", () => {
    const findings = check({
      compositionRootSource: REAL_ROOT_SOURCE.split("\n")
        .filter((l) => !l.trimStart().startsWith("installSecretStore("))
        .join("\n"),
    });
    expect(subjects(findings)).toEqual(["secretStore"]);
    expect(findings[0].rule).toBe("C1");
  });

  it("C1 — deleting the RUNTIME guard's own call is caught, so the guard guards its guard", () => {
    const findings = check({
      compositionRootSource: REAL_ROOT_SOURCE.split("\n")
        .filter((l) => !l.trimStart().startsWith("assertNativeCapabilitiesInstalled("))
        .join("\n"),
    });
    expect(subjects(findings)).toEqual(["the runtime self-check"]);
  });

  it("C1 — a LOCALLY DECLARED function of the same name does not count (not a name-string match)", () => {
    const findings = check({
      compositionRootSource: [
        `import { ElectronSecretStore } from "../capabilities/electron/electronSecretStore";`,
        `import { assertNativeCapabilitiesInstalled } from "../capabilities/nativeCapabilities";`,
        ``,
        `function installSecretStore(_s: unknown): void { /* not the provider's */ }`,
        `installSecretStore(new ElectronSecretStore());`,
        `assertNativeCapabilitiesInstalled();`,
      ].join("\n"),
    });
    expect(subjects(findings)).toEqual(["secretStore"]);
  });

  it("C1 — the name appearing only in a comment or a string literal does not count", () => {
    // The exact defect that mis-measured this item three times: a mention
    // counted as a call.
    const findings = check({
      compositionRootSource: [
        `import { assertNativeCapabilitiesInstalled } from "../capabilities/nativeCapabilities";`,
        `// installSecretStore(new ElectronSecretStore());`,
        `/** calls installSecretStore() at boot */`,
        `const note = "installSecretStore(new ElectronSecretStore())";`,
        `void note;`,
        `assertNativeCapabilitiesInstalled();`,
      ].join("\n"),
    });
    expect(subjects(findings)).toEqual(["secretStore"]);
  });

  it("C1 — an import of the right NAME from the WRONG module does not count", () => {
    const findings = check({
      compositionRootSource: [
        `import { installSecretStore } from "../capabilities/someOtherProvider";`,
        `import { assertNativeCapabilitiesInstalled } from "../capabilities/nativeCapabilities";`,
        `installSecretStore(null);`,
        `assertNativeCapabilitiesInstalled();`,
      ].join("\n"),
    });
    expect(subjects(findings)).toEqual(["secretStore"]);
  });

  it("C1 — a type-only import cannot satisfy it (it is erased and calls nothing)", () => {
    const findings = check({
      compositionRootSource: [
        `import type { installSecretStore } from "../capabilities/secretStoreProvider";`,
        `import { assertNativeCapabilitiesInstalled } from "../capabilities/nativeCapabilities";`,
        `assertNativeCapabilitiesInstalled();`,
      ].join("\n"),
    });
    expect(subjects(findings)).toEqual(["secretStore"]);
  });

  // ---- CONTROL 4: a second capability, registered with no installer ----
  it("C1 — a SECOND capability with no installer is named SPECIFICALLY, and secretStore is not", () => {
    // A guard that reports "something is missing" is a name-matcher for the one
    // case it was built against. This proves it discriminates between two.
    const withDummy: RequiredCall[] = [
      ...REQUIRED,
      {
        name: "messageIngestion",
        providerModule: "electron/capabilities/messageIngestionProvider",
        installFunction: "installMessageIngestion",
      },
    ];
    const findings = check({ requiredCalls: withDummy });

    expect(subjects(findings)).toEqual(["messageIngestion"]);
    expect(subjects(findings)).not.toContain("secretStore");
    expect(findings[0].detail).toContain("installMessageIngestion");
    expect(findings[0].detail).toContain("electron/capabilities/messageIngestionProvider");
  });

  it("C1 — with TWO capabilities uninstalled, BOTH are named, in registry order", () => {
    const two: RequiredCall[] = [
      { name: "alpha", providerModule: "electron/capabilities/alpha", installFunction: "installAlpha" },
      { name: "beta", providerModule: "electron/capabilities/beta", installFunction: "installBeta" },
    ];
    expect(subjects(check({ requiredCalls: two }))).toEqual(["alpha", "beta"]);
  });
});

// ===========================================================================
// MUST NOT FIRE — valid shapes the guard has to accept
// ===========================================================================

describe("composition-root guard: must not fire", () => {
  it("a different-but-valid import path in the entry module (resolved, not string-compared)", () => {
    expect(
      check({ entrySource: `import "./bootstrap/../bootstrap/installNativeCapabilities";\n` }),
    ).toEqual([]);
  });

  it("an explicit source extension on the specifier", () => {
    expect(check({ entrySource: `import "./bootstrap/installNativeCapabilities.js";\n` })).toEqual([]);
  });

  it("the entry import placed LAST rather than first — position is not the contract", () => {
    expect(
      check({
        entrySource: [
          `import { app } from "electron";`,
          `void app;`,
          `import "./bootstrap/installNativeCapabilities";`,
        ].join("\n"),
      }),
    ).toEqual([]);
  });

  it("two capabilities installed in EITHER order", () => {
    const two: RequiredCall[] = [
      { name: "alpha", providerModule: "electron/capabilities/alpha", installFunction: "installAlpha" },
      { name: "beta", providerModule: "electron/capabilities/beta", installFunction: "installBeta" },
    ];
    const forwards = [
      `import { installAlpha } from "../capabilities/alpha";`,
      `import { installBeta } from "../capabilities/beta";`,
      `installAlpha();`,
      `installBeta();`,
    ].join("\n");
    const backwards = [
      `import { installBeta } from "../capabilities/beta";`,
      `import { installAlpha } from "../capabilities/alpha";`,
      `installBeta();`,
      `installAlpha();`,
    ].join("\n");

    expect(check({ compositionRootSource: forwards, requiredCalls: two })).toEqual([]);
    expect(check({ compositionRootSource: backwards, requiredCalls: two })).toEqual([]);
  });

  it("a namespace import — p.installSecretStore(...)", () => {
    expect(
      check({
        compositionRootSource: [
          `import * as provider from "../capabilities/secretStoreProvider";`,
          `import * as caps from "../capabilities/nativeCapabilities";`,
          `import { ElectronSecretStore } from "../capabilities/electron/electronSecretStore";`,
          `provider.installSecretStore(new ElectronSecretStore());`,
          `caps.assertNativeCapabilitiesInstalled();`,
        ].join("\n"),
      }),
    ).toEqual([]);
  });

  it("an aliased named import — { installSecretStore as install }", () => {
    expect(
      check({
        compositionRootSource: [
          `import { installSecretStore as install } from "../capabilities/secretStoreProvider";`,
          `import { assertNativeCapabilitiesInstalled as verify } from "../capabilities/nativeCapabilities";`,
          `import { ElectronSecretStore } from "../capabilities/electron/electronSecretStore";`,
          `install(new ElectronSecretStore());`,
          `verify();`,
        ].join("\n"),
      }),
    ).toEqual([]);
  });

  it("a require() destructure — the repo already uses lazy require elsewhere", () => {
    expect(
      check({
        compositionRootSource: [
          `const { installSecretStore } = require("../capabilities/secretStoreProvider");`,
          `const caps = require("../capabilities/nativeCapabilities");`,
          `installSecretStore({});`,
          `caps.assertNativeCapabilitiesInstalled();`,
        ].join("\n"),
      }),
    ).toEqual([]);
  });

  it("a call nested inside a block or a try — C1 is a reachability floor, not a control-flow proof", () => {
    // Stated plainly because it is a LIMIT, not a feature: C1 asks whether the
    // call expression exists, not whether it executes. The runtime layer is
    // what answers "did it actually install".
    expect(
      check({
        compositionRootSource: [
          `import { installSecretStore } from "../capabilities/secretStoreProvider";`,
          `import { assertNativeCapabilitiesInstalled } from "../capabilities/nativeCapabilities";`,
          `import { ElectronSecretStore } from "../capabilities/electron/electronSecretStore";`,
          `try { installSecretStore(new ElectronSecretStore()); } catch { /* */ }`,
          `assertNativeCapabilitiesInstalled();`,
        ].join("\n"),
      }),
    ).toEqual([]);
  });
});

// ===========================================================================
// The resolver itself — the piece a line matcher would get wrong
// ===========================================================================

describe("resolveSpecifier", () => {
  it.each([
    ["electron/main.ts", "./bootstrap/installNativeCapabilities", "electron/bootstrap/installNativeCapabilities"],
    ["electron/main.ts", "./bootstrap/../bootstrap/installNativeCapabilities", "electron/bootstrap/installNativeCapabilities"],
    ["electron/main.ts", "./bootstrap/installNativeCapabilities.ts", "electron/bootstrap/installNativeCapabilities"],
    ["electron/bootstrap/installNativeCapabilities.ts", "../capabilities/secretStoreProvider", "electron/capabilities/secretStoreProvider"],
    ["electron/bootstrap/installNativeCapabilities.ts", "../capabilities/secretStoreProvider/index", "electron/capabilities/secretStoreProvider"],
  ])("%s + %s -> %s", (from, spec, expected) => {
    expect(resolveSpecifier(from, spec)).toBe(expected);
  });

  it("returns null for bare and aliased specifiers, which it does not claim to resolve", () => {
    expect(resolveSpecifier("electron/main.ts", "electron")).toBeNull();
    expect(resolveSpecifier("electron/main.ts", "@electron/bootstrap/installNativeCapabilities")).toBeNull();
  });
});
