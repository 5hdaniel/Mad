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
 *    `app.whenReady()` and therefore before the window opens. The `catch`
 *    below turns that throw into a named error box and a non-zero exit — see
 *    "WHAT HAPPENS WHEN IT FIRES".
 * 2. `electron/capabilities/__tests__/compositionRootGuard.test.ts` is the
 *    STATIC guard: it AST-matches every `installFunction` in
 *    `NATIVE_CAPABILITIES` — **and the `assertNativeCapabilitiesInstalled()`
 *    call itself** — against this file, and asserts `main.ts` still imports it.
 *    Deleting the assertion line below takes that test red.
 *
 * WHAT HAPPENS WHEN IT FIRES — and why the handling is HERE
 * ---------------------------------------------------------
 * Founder decision, BACKLOG-2962: the app must say what is missing and then
 * DIE, rather than sit in the Dock with no window.
 *
 * Before this `catch` existed, the throw left this module during `main.ts`'s
 * evaluation at its line 12, and:
 *
 *   - `main.ts`'s own `process.on("uncaughtException")` could not run. It is
 *     registered at `main.ts:259`, BELOW the import at line 12, so at this
 *     point it does not exist yet — and its body would not have helped: it
 *     logs, and says in its own comments not to exit and not to show a dialog.
 *   - Electron's single default `uncaughtException` listener, installed before
 *     the main script loads, handled it instead: `App threw an error during
 *     load` plus the stack on stderr, then a modal error box reached through
 *     an async `import("electron")` — several seconds after the throw — and
 *     then a process that KEPT RUNNING, windowless, before and after OK.
 *
 * All of that was MEASURED on this repo's own Electron binary by SR's review of
 * PR #2515 (probes A, B and C), not traced.
 *
 * The assertion's throw no longer escapes, so neither handler is involved and
 * the behaviour does not depend on how much of `main.ts` has evaluated. Only
 * the assertion's: `installSecretStore(new ElectronSecretStore())` sits outside
 * the `try` deliberately, because a constructor that throws is a different
 * failure with a different message, and swallowing it into this box would
 * mislabel it. That is
 * also why the handling lives here rather than in `main.ts`: a TypeScript
 * `import` statement cannot be wrapped in `try`/`catch`, so catching there
 * would mean rewriting `main.ts:12` as a `require()` call — which rule E1 does
 * not recognise as an entry import, taking this item's own static guard red.
 *
 * `dialog.showErrorBox` is the one dialog API usable before `app.whenReady()`.
 * Measured rather than assumed, though not by me: SR's probe C watched
 * Electron's own default handler render a `showErrorBox` at this same point in
 * the lifecycle, while `whenReady()` was never reached. That box was Electron's
 * own, titled "A JavaScript error occurred in the main process" — so what is
 * established is the API working pre-ready, not this call site's box. Visual
 * confirmation of THIS box is the founder's launch test, not something any
 * instrument here has shown. `app.exit(1)` rather than `app.quit()` — quit runs
 * `before-quit` handlers and can be cancelled, while exit ends the process
 * immediately with the code, so crash reporting and the updater see a failed
 * launch.
 *
 * @module electron/bootstrap/installNativeCapabilities
 */

import { app, dialog } from "electron";
import log from "electron-log";

import { installLogger } from "../capabilities/loggerProvider";
import { ElectronLogger } from "../capabilities/electron/electronLogger";
import { installSecretStore } from "../capabilities/secretStoreProvider";
import { ElectronSecretStore } from "../capabilities/electron/electronSecretStore";
import { assertNativeCapabilitiesInstalled } from "../capabilities/nativeCapabilities";

/** Title of the error box shown when a capability is missing at launch. */
export const STARTUP_FAILURE_TITLE = "Keepr cannot start";

// Logger FIRST, so that anything a later installer's constructor might log
// reaches the file transport rather than the silent default. Nothing logs
// during construction today; installing first is what keeps that cheap to stay
// true. `installAppDataPaths` (main.ts:6) has already pointed electron-log at
// the right directory, so the first line written from here lands in the right
// file.
installLogger(new ElectronLogger());
installSecretStore(new ElectronSecretStore());

// LAST — every capability above must now answer `isInstalled()`.
try {
  assertNativeCapabilitiesInstalled();
} catch (error) {
  // `error.message` names every uninstalled capability, and is passed through
  // verbatim: the whole value of this guard is that whoever reads the box is
  // told WHICH capability is missing.
  const message = error instanceof Error ? error.message : String(error);
  // TEXT FIRST, and both sinks. The box is dismissed and gone; a support report
  // needs something that stays. `console.error` reaches the terminal running
  // `npm run dev`, and any unattended launch that nobody is there to dismiss the
  // box for; `log.error` reaches the log file, which by now points at the right
  // directory because `installAppDataPaths` (main.ts:6) ran first. The whole
  // `error` is passed, not just `message`, so both sinks carry the stack.
  //
  // This mirrors `main.ts:261-262`, the app's only other fatal path, down to the
  // order. It deliberately does NOT use `logService`: `main.ts` does not either,
  // and that wrapper only writes a file once a `logDirectory` is configured,
  // which nothing has done at this point in startup.
  console.error("[FATAL] Native capability missing:", error);
  log.error("[FATAL] Native capability missing:", error);
  // Box after the text, exit after the box. Exiting first ends the process
  // before the box is reached — SR measured both orders on the real binary.
  dialog.showErrorBox(STARTUP_FAILURE_TITLE, message);
  app.exit(1);
}
