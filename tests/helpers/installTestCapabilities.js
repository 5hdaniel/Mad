/**
 * Install the non-secret native capabilities for a jest "shell"
 * (BACKLOG-2962, seams PR A).
 *
 * WHY THIS FILE EXISTS, BESIDE `installTestSecretStore`
 * ----------------------------------------------------
 * Same premise as its sibling: a jest run is just another host shell, and every
 * host has to say which implementation the core gets. Electron says so in
 * `electron/bootstrap/installNativeCapabilities.ts`; `tests/setup.js` says so
 * here. Without it, every suite that reaches a `hostLogger` call would exercise the
 * uninstalled default instead of the path it was written to test — 22 suites
 * assert on the `electron-log` mock. ErrorReporter and AppPaths join this
 * helper in the two commits after this one.
 *
 * WHY IT RESOLVES THE SDK AT CALL TIME, WHEN `installTestSecretStore` DOES NOT
 * ---------------------------------------------------------------------------
 * `installTestSecretStore` reads `require("electron").safeStorage` at INSTALL
 * time and installs that object, so it must be called again by any suite whose
 * own `jest.mock("electron", …)` factory is registered later — six suites do.
 * The forwarders below instead call `require(…)` inside each method, so they
 * resolve against whatever module registry is in force AT THE MOMENT OF THE
 * CALL. A suite's own factory is therefore honoured with no second call, which
 * is what keeps suites like `electron/schemas/__tests__/validate.test.ts`
 * (`jest.mock('electron-log', …)` + `expect(log.warn).toHaveBeenCalledWith(…)`)
 * passing byte-for-byte unchanged.
 *
 * This is a TEST-shell concession and it lives only here. The production
 * adapters (`electron/capabilities/electron/*.ts`) take ordinary top-level
 * imports; there is one Electron in a real launch and nothing re-registers it.
 *
 * WHAT IT DOES NOT SOLVE
 * ----------------------
 * `jest.resetModules()` throws the registry away, so the next `require` of a
 * provider returns a BRAND NEW module with nothing installed. No jest hook fires
 * after an in-test reset. Suites that reset and then reach one of these
 * capabilities must call this themselves afterwards — exactly as they already
 * do for `installTestSecretStore`.
 */

/** `electron-log`'s default export, however the mock in force exposes it. */
function currentLog() {
  const mod = require("electron-log");
  return mod && mod.default ? mod.default : mod;
}

function installTestCapabilities() {
  const { installLogger } = require("../../electron/capabilities/loggerProvider");

  installLogger({
    debug: (message, ...args) => currentLog().debug(message, ...args),
    info: (message, ...args) => currentLog().info(message, ...args),
    warn: (message, ...args) => currentLog().warn(message, ...args),
    error: (message, ...args) => currentLog().error(message, ...args),
  });
}

module.exports = { installTestCapabilities };
