/**
 * The native-capability registry and the composition root's runtime self-check
 * (BACKLOG-2962).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * PR #2487 put secret storage behind an interface. Reviewing it, SR deleted the
 * one wiring line that installs the implementation —
 * `electron/main.ts:12`, `import "./bootstrap/installNativeCapabilities";` —
 * and **nothing in the repository went red**: 72 suites, the SQL gate and `tsc`
 * all passed, and the app would have launched and never shown a window. The
 * composition root had no guard. Reproduced on this branch before writing a
 * line of it: 41 affected suites / 815 tests identical green with the import
 * deleted, `tsc -p tsconfig.electron.json` exit 0,
 * `check:native-capabilities` exit 0.
 *
 * THE TWO LAYERS, AND WHY NEITHER IS ENOUGH ALONE
 * ------------------------------------------------
 * | mutation                                              | static | runtime |
 * |-------------------------------------------------------|--------|---------|
 * | `main.ts`'s import of the composition root deleted     | RED    | green   |
 * | an install call deleted from the composition root      | RED    | RED     |
 * | install call present but installs nothing at runtime   | green  | RED     |
 * | a capability registered here with no installer         | RED    | RED     |
 *
 * The static layer is `electron/capabilities/__tests__/compositionRootGuard.test.ts`;
 * it reads {@link NATIVE_CAPABILITIES} and matches each `installFunction` in the
 * composition root's AST. The runtime layer is
 * {@link assertNativeCapabilitiesInstalled}, called as the last statement of the
 * composition root. A test only protects against a break someone runs tests
 * for; the assertion protects the launch.
 *
 * THIS MODULE IMPORTS NO PLATFORM. It holds names and predicates, so it stays
 * loadable by any shell — which is the whole point of epic 9.
 *
 * @module electron/capabilities/nativeCapabilities
 */

import { isSecretStoreInstalled } from "./secretStoreProvider";

/**
 * One native capability the core depends on and a host shell must supply.
 *
 * The three string fields are what the STATIC guard matches on; `isInstalled`
 * is what the RUNTIME guard calls. Both read this one array, so there is no
 * second list to drift out of step with it.
 */
export interface NativeCapability {
  /** Stable name. Appears verbatim in the thrown error and in guard failures. */
  readonly name: string;
  /**
   * Repo-relative, extensionless, POSIX-separated path of the module that
   * exports {@link installFunction}. The static guard RESOLVES the composition
   * root's import specifiers to this path — it does not string-compare them —
   * so any spelling that resolves here satisfies the guard.
   */
  readonly providerModule: string;
  /** The named export a shell calls to supply an implementation. */
  readonly installFunction: string;
  /** True once a host shell has installed a real implementation. */
  isInstalled(): boolean;
}

/**
 * Every capability the Electron shell must install before the core runs.
 *
 * ONE entry today. That is not an oversight: BACKLOG-2962's own capability
 * table names four (secret storage, file export/attachments, message ingestion,
 * notifications/update) and only secret storage has shipped behind an
 * interface. SR endorsed deferring the filesystem seam — its 42 files are
 * eleven distinct concerns, not one capability. A capability joins this list
 * when it has an interface, not before; adding a name here with no installer
 * takes both guards red, by design and by planted control.
 */
export const NATIVE_CAPABILITIES: readonly NativeCapability[] = [
  {
    name: "secretStore",
    providerModule: "electron/capabilities/secretStoreProvider",
    installFunction: "installSecretStore",
    isInstalled: isSecretStoreInstalled,
  },
];

/** Repo-relative, extensionless path of the Electron shell's composition root. */
export const COMPOSITION_ROOT = "electron/bootstrap/installNativeCapabilities";

/** Repo-relative path of the Electron shell's entry module. */
export const SHELL_ENTRY = "electron/main.ts";

/**
 * Calls the composition root must make BEYOND installing each capability.
 *
 * Exactly one: the runtime self-check itself. Without this entry, deleting
 * {@link assertNativeCapabilitiesInstalled}'s single call site would silently
 * remove the runtime layer — the very defect this item exists to close, one
 * level up. The guard that does not guard its own guard is the shape SR found.
 */
export const REQUIRED_COMPOSITION_ROOT_CALLS: readonly {
  readonly name: string;
  readonly providerModule: string;
  readonly installFunction: string;
}[] = [
  {
    name: "the runtime self-check",
    providerModule: "electron/capabilities/nativeCapabilities",
    installFunction: "assertNativeCapabilitiesInstalled",
  },
];

/** Thrown when the composition root finishes without installing a capability. */
export class MissingNativeCapabilityError extends Error {
  /** The uninstalled capability names, in registry order. */
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super(
      `Native capability not installed: ${missing.join(", ")}. The host shell's ` +
        "composition root ran without supplying an implementation " +
        `(Electron's is ${COMPOSITION_ROOT}.ts). Each capability's provider ` +
        "throws on first use, so this fails during startup — before the window " +
        "opens — rather than at whatever call site happens to reach it first.",
    );
    this.name = "MissingNativeCapabilityError";
    this.missing = [...missing];
  }
}

/**
 * Throw unless every registered capability has a real implementation installed.
 *
 * Called as the LAST statement of the composition root, so it runs during
 * `main.ts` module evaluation: before `app.whenReady()`, before the
 * `process.on("uncaughtException")` handler registered further down `main.ts`,
 * and therefore before `createWindow()`. A module-scope throw there stops the
 * process rather than becoming the silent unhandled rejection SR traced.
 *
 * @param capabilities injected by tests so a dummy registry can be checked;
 *   production always uses {@link NATIVE_CAPABILITIES}.
 */
export function assertNativeCapabilitiesInstalled(
  capabilities: readonly NativeCapability[] = NATIVE_CAPABILITIES,
): void {
  const missing = capabilities.filter((c) => !c.isInstalled()).map((c) => c.name);
  if (missing.length > 0) {
    throw new MissingNativeCapabilityError(missing);
  }
}
