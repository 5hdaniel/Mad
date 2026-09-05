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

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("../installNativeCapabilities");
  });

  jest.dontMock("electron");
  jest.dontMock("../../capabilities/secretStoreProvider");
  return { showErrorBox, exit };
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
    const { showErrorBox, exit } = loadCompositionRoot({ install: true });

    expect(showErrorBox).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });
});
