/**
 * BACKLOG-3210 (part 2) — the one post-onboarding Full Disk Access explainer,
 * and the proof that reusing the onboarding sheet did not change onboarding.
 *
 * ---------------------------------------------------------------------------
 * TWO THINGS ARE BEING ASSERTED HERE
 * ---------------------------------------------------------------------------
 * 1. `FdaHelpSheet` behaves the way the founder asked: the explanation first,
 *    the macOS pane reachable from inside it, and a plain way out.
 * 2. `FdaSafetySheet`'s DEFAULTS are untouched. The new props are optional and
 *    `PermissionsStep` was not modified, so the onboarding sheet must still
 *    render "Let's go" / "Skip for now" and still close on a backdrop click.
 *    Without (2), "additive props, onboarding unchanged" is a claim rather than
 *    a measurement.
 *
 * The separate `onClose` is not a nicety and is asserted as such: in onboarding
 * `onLetsGo` doubles as the backdrop handler, which is correct while the
 * primary action IS "close". Point the primary at "open System Settings" — as
 * this component does — and a stray backdrop click would open a System
 * Settings window the user never asked for.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FdaHelpSheet } from "../FdaHelpSheet";
import { FdaSafetySheet } from "../../onboarding/steps/FdaSafetySheet";

const mockOpenFullDiskAccessSettings = jest.fn();
jest.mock("../../../services", () => ({
  systemService: {
    openFullDiskAccessSettings: (...args: unknown[]) =>
      mockOpenFullDiskAccessSettings(...args),
  },
}));

const mockLoggerError = jest.fn();
jest.mock("../../../utils/logger", () => ({
  __esModule: true,
  default: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockOpenFullDiskAccessSettings.mockResolvedValue({ success: true });
});

describe("FdaHelpSheet — the post-onboarding explainer (BACKLOG-3210 part 2)", () => {
  it("carries the onboarding explanation verbatim, not a paraphrase of it", () => {
    render(<FdaHelpSheet onClose={jest.fn()} />);

    // The reason this reuses FdaSafetySheet rather than writing new copy: the
    // privacy pledge is founder-approved and must not drift between surfaces.
    expect(
      screen.getByText("Your messages stay on this Mac. Period.")
    ).toBeInTheDocument();
    expect(screen.getByText(/nothing is uploaded, ever/)).toBeInTheDocument();
  });

  it("does NOT open System Settings just by being shown", () => {
    render(<FdaHelpSheet onClose={jest.fn()} />);
    expect(mockOpenFullDiskAccessSettings).not.toHaveBeenCalled();
  });

  it("STATE 6 — the primary button opens the macOS pane, exactly once", async () => {
    render(<FdaHelpSheet onClose={jest.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open System Settings" })
    );

    await waitFor(() =>
      expect(mockOpenFullDiskAccessSettings).toHaveBeenCalledTimes(1)
    );
  });

  it("stays open after opening the pane — the user needs it when they come back", async () => {
    const onClose = jest.fn();
    render(<FdaHelpSheet onClose={onClose} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open System Settings" })
    );

    await waitFor(() =>
      expect(mockOpenFullDiskAccessSettings).toHaveBeenCalled()
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("runs the caller's follow-up after the pane opens (Settings re-checks its status)", async () => {
    const onOpenedSettings = jest.fn();
    render(
      <FdaHelpSheet onClose={jest.fn()} onOpenedSettings={onOpenedSettings} />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open System Settings" })
    );

    await waitFor(() => expect(onOpenedSettings).toHaveBeenCalledTimes(1));
  });

  it("keeps the explainer up and logs when the pane will not open", async () => {
    mockOpenFullDiskAccessSettings.mockResolvedValue({
      success: false,
      error: "no handler",
    });
    const onClose = jest.fn();
    render(<FdaHelpSheet onClose={onClose} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open System Settings" })
    );

    await waitFor(() => expect(mockLoggerError).toHaveBeenCalledTimes(1));
    // Closing a failed explainer would leave the user with nothing at all.
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("fda-help-sheet")).toBeInTheDocument();
  });

  it("'Not now' closes without touching System Settings", () => {
    const onClose = jest.fn();
    render(<FdaHelpSheet onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockOpenFullDiskAccessSettings).not.toHaveBeenCalled();
  });

  it("a backdrop click DISMISSES — it does not open System Settings", () => {
    // The reason FdaSafetySheet needed an `onClose` separate from `onLetsGo`.
    // Without it the backdrop inherits the primary action, and a misclick opens
    // a System Settings window out of nowhere.
    const onClose = jest.fn();
    render(<FdaHelpSheet onClose={onClose} />);

    fireEvent.click(screen.getByTestId("fda-help-sheet"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockOpenFullDiskAccessSettings).not.toHaveBeenCalled();
  });

  it("does not offer 'Skip for now' — outside onboarding there is no step to skip", () => {
    render(<FdaHelpSheet onClose={jest.fn()} />);
    expect(screen.queryByText("Skip for now")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Skipping only pauses text-message capture/)
    ).not.toBeInTheDocument();
  });
});

/**
 * The onboarding call site (`PermissionsStep`) passes only `onLetsGo` and
 * `onSkip` and was not modified. These assertions are the control on that
 * claim: every new prop is optional, and its default is the old behaviour.
 */
describe("FdaSafetySheet defaults are unchanged by the new props (BACKLOG-3210 part 2)", () => {
  it("still renders the onboarding labels and footer", () => {
    render(<FdaSafetySheet onLetsGo={jest.fn()} onSkip={jest.fn()} />);

    expect(
      screen.getByRole("button", { name: "Let’s go" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Skip for now" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Skipping only pauses text-message capture/)
    ).toBeInTheDocument();
  });

  it("still routes a backdrop click to onLetsGo when no onClose is given", () => {
    const onLetsGo = jest.fn();
    const onSkip = jest.fn();
    const { container } = render(
      <FdaSafetySheet onLetsGo={onLetsGo} onSkip={onSkip} />
    );

    // The overlay is the outermost element ResponsiveModal renders.
    fireEvent.click(container.firstElementChild as Element);

    expect(onLetsGo).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("still keeps the two onboarding testids the PermissionsStep suite asserts on", () => {
    render(<FdaSafetySheet onLetsGo={jest.fn()} onSkip={jest.fn()} />);

    expect(screen.getByTestId("fda-safety-lets-go")).toBeInTheDocument();
    expect(screen.getByTestId("fda-safety-skip")).toBeInTheDocument();
  });
});
