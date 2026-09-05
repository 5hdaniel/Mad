/**
 * WHAT THE COMPOSITION ROOT DOES WHEN A CAPABILITY IS MISSING (BACKLOG-2962).
 *
 * Founder decision: the app must name what is missing and then DIE. Before the
 * `catch` in `installNativeCapabilities.ts`, it did neither — SR measured, on
 * this repo's own Electron binary, that the throw produced Electron's default
 * error box several seconds late and then a process that kept running with no
 * window until it was force-quit (PR #2515 review, probes A/B/C).
 *
 * These four cases pin the replacement. Two of them are must-not-fire: the
 * happy path must show no box and exit nothing, and the box must come BEFORE
 * the exit — `app.exit(1)` first would end the process before the box could
 * render, turning a loud failure into a silent one. That ordering trap is the
 * reason this file asserts call order rather than just call counts.
 *
 * The failure is provoked by mocking `secretStoreProvider` so that installing
 * does not install: `isSecretStoreInstalled()` stays false, which is exactly
 * the state `assertNativeCapabilitiesInstalled()` exists to catch. Nothing here
 * mutates the real registry — every load happens inside `jest.isolateModules`.
 */

interface Probe {
  showErrorBox: jest.Mock;
  exit: jest.Mock;
  logError: jest.Mock;
  consoleError: jest.Mock;
}

/**
 * Load the real composition root in a fresh registry.
 *
 * @param install false to make `installSecretStore` a no-op, so the registry
 *   reports the capability uninstalled and the assertion fires.
 */
function loadCompositionRoot(options: { install: boolean }): Probe {
  const showErrorBox = jest.fn();
  const exit = jest.fn();
  const logError = jest.fn();
  // Swapped by hand rather than with `jest.spyOn`, and restored in a `finally`
  // below. `jest.spyOn` over an already-spied `console.error` WRAPS the previous
  // spy instead of replacing it, and `jest.restoreAllMocks()` in an `afterEach`
  // did not unwind the chain here — measured: the first case's spy went on
  // recording later cases' calls and this count read 3 instead of 1.
  const consoleError = jest.fn();
  const realConsoleError = console.error;
  console.error = consoleError as unknown as typeof console.error;

  jest.isolateModules(() => {
    // Only three members of the Electron surface are reachable from this
    // module's tree: `safeStorage`, which `ElectronSecretStore` imports, and
    // the `app` and `dialog` the catch below uses. The `safeStorage` shape is
    // transcribed from `tests/__mocks__/electron.js` rather than invented; that
    // file cannot be required here, because jest's `moduleNameMapper` maps
    // "electron" onto it and requiring it by path recurses until the stack
    // blows — measured, not guessed.
    jest.doMock("electron", () => ({
      app: { exit },
      dialog: { showErrorBox },
      safeStorage: {
        isEncryptionAvailable: jest.fn(() => true),
        encryptString: jest.fn((text: string) => Buffer.from(`encrypted:${text}`)),
        decryptString: jest.fn((buffer: Buffer) =>
          buffer.toString().replace("encrypted:", ""),
        ),
      },
    }));

    if (!options.install) {
      jest.doMock("../../capabilities/secretStoreProvider", () => ({
        // Accepts the implementation and drops it — the shape of a shell that
        // wired the call up but not the wiring behind it.
        installSecretStore: jest.fn(),
        isSecretStoreInstalled: (): boolean => false,
        getSecretStore: jest.fn(),
      }));
    }

    // electron-log must be mocked HERE and not left to the global
    // `moduleNameMapper` entry: the catch writes through it, and this test has
    // to hold the same `jest.fn()` the module called in order to assert WHEN it
    // was called. A real transport would also reach `app.getPath`, which the
    // Electron mock above does not supply, and would throw inside the catch —
    // reddening this suite for a reason that has nothing to do with the guard.
    jest.doMock("electron-log", () => {
      const mock = { error: logError };
      return { ...mock, default: mock };
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("../installNativeCapabilities");
  });

  console.error = realConsoleError;
  jest.dontMock("electron");
  jest.dontMock("electron-log");
  jest.dontMock("../../capabilities/secretStoreProvider");
  return { showErrorBox, exit, logError, consoleError };
}

describe("composition root: a missing capability at launch (BACKLOG-2962)", () => {

  it("names the missing capability in the error box", () => {
    const { showErrorBox } = loadCompositionRoot({ install: false });

    expect(showErrorBox).toHaveBeenCalledTimes(1);
    const [title, message] = showErrorBox.mock.calls[0] as [string, string];
    expect(title).toBe("Keepr cannot start");
    // Named, not merely non-empty: a box that says "something went wrong"
    // sends the reader nowhere.
    expect(message).toContain("secretStore");
    expect(message).toContain("composition root");
  });

  it("exits the process with code 1, so a failed launch is observable", () => {
    const { exit } = loadCompositionRoot({ install: false });

    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("writes the error to the log and to stderr BEFORE the box, because the box does not survive", () => {
    // The box is dismissed and gone, and an unattended launch has nobody to
    // dismiss it. Before this write existed, `npm run dev` failed with an empty
    // terminal — a regression, because the throw it replaced at least reached
    // Electron's default handler, which printed a stack.
    //
    // Order is asserted, not just the calls: text after the box would be text
    // nobody reads, and text after `app.exit(1)` would never run at all.
    const { logError, consoleError, showErrorBox } = loadCompositionRoot({ install: false });

    expect(logError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);

    // The whole error object, not the message: that is what carries the stack
    // into both sinks, and it is what `main.ts:261-262` passes on its own fatal
    // path.
    const logged = logError.mock.calls[0][1] as unknown;
    expect(logged).toBeInstanceOf(Error);
    expect((logged as Error).message).toContain("secretStore");
    expect((logged as Error).stack).toBeTruthy();

    expect(consoleError.mock.invocationCallOrder[0]).toBeLessThan(
      showErrorBox.mock.invocationCallOrder[0],
    );
    expect(logError.mock.invocationCallOrder[0]).toBeLessThan(
      showErrorBox.mock.invocationCallOrder[0],
    );

  });

  it("shows the box BEFORE exiting — the other order would suppress it", () => {
    const { showErrorBox, exit } = loadCompositionRoot({ install: false });

    expect(showErrorBox.mock.invocationCallOrder[0]).toBeLessThan(
      exit.mock.invocationCallOrder[0],
    );
  });

  it("does neither when every capability installs, so the cases above are not vacuous", () => {
    // The real provider, the real ElectronSecretStore. If this fired, the three
    // assertions above would be describing the ordinary launch path rather than
    // a failure, and would say nothing.
    const { showErrorBox, exit, logError, consoleError } = loadCompositionRoot({ install: true });

    expect(showErrorBox).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
