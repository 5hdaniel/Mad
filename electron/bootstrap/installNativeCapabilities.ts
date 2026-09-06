/**
 * The Electron shell's composition root for native capabilities (BACKLOG-2962).
 *
 * Imported for its side effect from `main.ts`, in the same style as
 * `installAppDataPaths` — this is the single place where the Electron shell
 * declares which implementation of each capability the core will get.
 *
 * Import position matters less here than it does for `installAppDataPaths`,
 * because `hostSecretStore` forwards at call time and nothing calls the store
 * during module construction. It still belongs near the top: the rule is
 * "install before anything can call", and the cheapest way to keep that true as
 * the codebase changes is to install first.
 *
 * TWO GUARDS WATCH THIS FILE, AND YOU CANNOT DELETE EITHER QUIETLY
 * ---------------------------------------------------------------
 * 1. `assertNativeCapabilitiesInstalled()` below is the RUNTIME guard: it
 *    throws during `main.ts` module evaluation if this file finished without
 *    installing something the core will demand. That is before
 *    `app.whenReady()` and therefore before the window opens.
 * 2. `electron/capabilities/__tests__/compositionRootGuard.test.ts` is the
 *    STATIC guard: it AST-matches every `installFunction` in
 *    `NATIVE_CAPABILITIES` — **and the `assertNativeCapabilitiesInstalled()`
 *    call itself** — against this file, and asserts `main.ts` still imports it.
 *    Deleting the assertion line below takes that test red.
 *
 * @module electron/bootstrap/installNativeCapabilities
 */

import { installSecretStore } from "../capabilities/secretStoreProvider";
import { ElectronSecretStore } from "../capabilities/electron/electronSecretStore";
import { assertNativeCapabilitiesInstalled } from "../capabilities/nativeCapabilities";

installSecretStore(new ElectronSecretStore());

// LAST — every capability above must now answer `isInstalled()`.
assertNativeCapabilitiesInstalled();
