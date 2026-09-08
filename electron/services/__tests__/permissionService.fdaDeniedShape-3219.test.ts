/**
 * BACKLOG-3219 — TRANSCRIPTION: what a Full Disk Access denial actually looks
 * like coming out of `permissionService`.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS SUITE IS FOR
 * ---------------------------------------------------------------------------
 * Two other suites (`diagnosticHandlers.fdaIssueAction-3219`, and the renderer
 * banner) assert on this object. They are fed the shared constant in
 * `tests/fixtures/fdaDeniedIssue-3219.ts`. This suite is the only thing tying
 * that constant to the REAL producer: it drives the real
 * `permissionService.checkFullDiskAccess()` against a real (empty) HOME and
 * asserts the result IS the constant. Drift the constant and this reds first;
 * change the producer and this reds first. Neither can go quietly green.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS REAL HERE AND WHAT IS NOT
 * ---------------------------------------------------------------------------
 * REAL: `fs`, the temp directory, the rejection, the catch block, the returned
 * object. The denial is produced by pointing HOME at a directory that has no
 * `Library/Messages/chat.db`, so `fs.access` rejects for real.
 *
 * FAKED: exactly one thing — `os.platform()` returns "darwin", because
 * `checkFullDiskAccess` short-circuits to `hasPermission: true` off macOS and
 * this suite would otherwise be vacuous on the Windows CI leg. Everything else
 * on `os` is the real module.
 *
 * NOT CLAIMED: this is an ENOENT denial, not a TCC EPERM denial. It does not
 * need to be. `checkFullDiskAccess` does not read `error.code` at all — every
 * rejection produces the same object — so ENOENT and EPERM are indistinguishable
 * to the thing this suite measures. (`checkContactsPermission` DOES read the
 * errno; that is BACKLOG-3210's `permissionService.contactsErrno-3210.test.ts`,
 * and it is covered there.) Real TCC EPERM on this path was measured by hand on
 * 2026-09-07 from a process without Full Disk Access.
 *
 * ---------------------------------------------------------------------------
 * THE PREMISE IS ASSERTED, NOT ASSUMED
 * ---------------------------------------------------------------------------
 * The whole of BACKLOG-3210 part 2 rests on the claim that this object carries
 * NO `actionHandler` — that the health banner's Full Disk Access button was
 * dead rather than merely pointed at the wrong place. That is asserted below
 * against the real return value, so it is a measurement.
 */

import path from "path";
import { promises as fsPromises } from "fs";
import realOs from "os";
import permissionService from "../permissionService";
import { FDA_DENIED_PERMISSION_RESULT } from "../../../tests/fixtures/fdaDeniedIssue-3219";

// Force the macOS branch ONLY. `fs` is untouched and real.
jest.mock("os", () => {
  const actual = jest.requireActual("os");
  return { ...actual, platform: () => "darwin" };
});

jest.mock("../logService", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("BACKLOG-3219 — the shape of a Full Disk Access denial (transcribed)", () => {
  const originalHome = process.env.HOME;
  let emptyHome: string;

  beforeAll(async () => {
    emptyHome = await fsPromises.mkdtemp(
      path.join(realOs.tmpdir(), "keepr-fda-3219-")
    );
  });

  afterAll(async () => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    await fsPromises.rm(emptyHome, { recursive: true, force: true });
  });

  beforeEach(() => {
    process.env.HOME = emptyHome;
  });

  it("the probe really is unreadable in this fixture (the premise of every assertion below)", async () => {
    // If this ever passed, the "denied" cases would be measuring a successful
    // read and every assertion after it would be green for the wrong reason.
    await expect(
      fsPromises.access(path.join(emptyHome, "Library/Messages/chat.db"))
    ).rejects.toBeDefined();
  });

  it("returns exactly the shared fixture's fields (minus the machine-specific errno message)", async () => {
    const result = await permissionService.checkFullDiskAccess();

    const { error, ...withoutErrnoMessage } = result as unknown as Record<
      string,
      unknown
    >;

    expect(withoutErrnoMessage).toEqual({ ...FDA_DENIED_PERMISSION_RESULT });
    // The errno message carries an absolute path, so it is asserted as present
    // rather than pinned to a value that differs per machine.
    expect(typeof error).toBe("string");
    expect((error as string).length).toBeGreaterThan(0);
  });

  it("carries NO actionHandler, title or severity — this is why the banner's button did nothing", async () => {
    const result = (await permissionService.checkFullDiskAccess()) as unknown as Record<
      string,
      unknown
    >;

    // `SystemHealthMonitor.handleAction` switches on `actionHandler` and falls
    // through to `default:` (a log line, no action) when it is undefined.
    expect(result).not.toHaveProperty("actionHandler");
    // `SystemHealthMonitor` renders `issue.title || issue.userMessage`, so the
    // banner's headline for this row is the userMessage above.
    expect(result).not.toHaveProperty("title");
    // Absent `severity` renders in the amber (warning) family, not red.
    expect(result).not.toHaveProperty("severity");

    expect(Object.keys(result).sort()).toEqual(
      ["action", "error", "errorCode", "hasPermission", "userMessage"].sort()
    );
  });

  it("the granted path returns no issue fields at all (the control for state 2)", async () => {
    // A HOME where the probe SUCCEEDS must produce a bare success, otherwise
    // "FDA granted -> no banner" would be provable only by the renderer.
    const grantedHome = await fsPromises.mkdtemp(
      path.join(realOs.tmpdir(), "keepr-fda-3219-ok-")
    );
    await fsPromises.mkdir(path.join(grantedHome, "Library/Messages"), {
      recursive: true,
    });
    await fsPromises.writeFile(
      path.join(grantedHome, "Library/Messages/chat.db"),
      ""
    );
    process.env.HOME = grantedHome;

    try {
      const result = await permissionService.checkFullDiskAccess();
      expect(result).toEqual({ hasPermission: true });
    } finally {
      await fsPromises.rm(grantedHome, { recursive: true, force: true });
    }
  });
});
