/**
 * BACKLOG-2748 — a user cancel must survive the trip from the main process to
 * the settings panel, and must not be mistaken for either a failure or a
 * clean finish.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS SUITE EXISTS
 * ---------------------------------------------------------------------------
 * The import reports a cancel in TWO different shapes, because it can be
 * cancelled in two places (`macOSMessagesImportService.ts`):
 *
 *   - during the QUERY phase, before anything is stored:
 *       { success: false, error: "Import cancelled", cancelled: true }
 *   - after it, once messages are already written:
 *       { success: true, messagesImported: <partial>, cancelled: true }
 *
 * The orchestrator's messages sync function throws on any non-success result.
 * So without a cancel branch placed BEFORE that throw, pressing Cancel early
 * paints a red "Import failed" card, and pressing it late paints a green
 * "Successfully imported N new messages" — two wrong answers for one action,
 * neither of them "cancelled".
 *
 * ---------------------------------------------------------------------------
 * WHAT IS AND IS NOT MOCKED
 * ---------------------------------------------------------------------------
 * The REAL registered `messages` sync function runs, driven through the REAL
 * `startSync`, so the queue item the settings panel actually reads is what gets
 * asserted — not the sync function's return value in isolation. The only mocks
 * are at the IPC boundary: `window.api.messages.importMacOSMessages` (whose
 * result shapes are transcribed above from the service's own returns) and
 * `window.api.preferences.get`, which must say `macos-native` or the sync
 * early-returns without importing anything.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@sentry/electron/renderer', () => ({
  addBreadcrumb: jest.fn(),
}));

jest.mock('../../utils/platform', () => ({
  isMacOS: jest.fn(() => true),
}));

/** What `messages:import-macos` resolves to on the run being measured. */
let importResult: Record<string, any> = {};

/** The progress callback the messages sync registers on the IPC bridge. */
let progressHandler: ((data: any) => void) | null = null;

const mockImportMacOSMessages = jest.fn(() => Promise.resolve(importResult));

Object.defineProperty(global, 'window', {
  value: {
    api: {
      preferences: {
        // macOS must be the active source or the messages sync skips the import.
        get: jest.fn(() =>
          Promise.resolve({ success: true, preferences: { messages: { source: 'macos-native' } } })
        ),
      },
      messages: {
        importMacOSMessages: mockImportMacOSMessages,
        // BACKLOG-2776: the sync function owns this listener, so capturing what
        // it registers is how a test drives real progress through the real
        // orchestrator path rather than poking `progress` onto the item.
        onImportProgress: jest.fn((handler: (data: any) => void) => {
          progressHandler = handler;
          return jest.fn();
        }),
      },
      contacts: {
        syncExternal: jest.fn(),
        syncOutlookContacts: jest.fn(),
        syncGoogleContacts: jest.fn(),
        forceReimport: jest.fn(),
      },
      transactions: { scan: jest.fn(), precacheEmails: jest.fn().mockResolvedValue({ success: true }) },
      notification: { send: jest.fn() },
      system: { reindexDatabase: jest.fn() },
      databaseBackup: { backup: jest.fn(), restore: jest.fn() },
      privacy: { exportData: jest.fn(), onExportProgress: jest.fn() },
    },
  },
  writable: true,
});

const { syncOrchestrator } =
  require('../SyncOrchestratorService') as typeof import('../SyncOrchestratorService');
import type { SyncItem } from '../SyncOrchestratorService';

const USER = '550e8400-e29b-41d4-a716-446655440000';

/**
 * The messages queue item as the settings panel would read it, after a full
 * real `startSync` run.
 */
async function runMessagesSync(): Promise<SyncItem | undefined> {
  syncOrchestrator.initializeSyncFunctions();
  await (syncOrchestrator as any).startSync({ types: ['messages'], userId: USER });
  return syncOrchestrator.getState().queue.find((item) => item.type === 'messages');
}

beforeEach(() => {
  syncOrchestrator.reset();
  (syncOrchestrator as any).syncFunctions = new Map();
  (syncOrchestrator as any).initialized = false;
  importResult = {};
  progressHandler = null;
  mockImportMacOSMessages.mockImplementation(() => Promise.resolve(importResult));
  jest.clearAllMocks();
  require('../../utils/platform').isMacOS.mockReturnValue(true);
});

afterEach(() => {
  syncOrchestrator.reset();
});

describe('BACKLOG-2748 — a cancelled import reaches the UI as a cancel', () => {
  it('carries the cancel and the PARTIAL count when messages were already stored', async () => {
    // The late shape: the batch loop broke, what was written is kept.
    importResult = { success: true, messagesImported: 12_431, cancelled: true };

    const item = await runMessagesSync();

    expect(item?.status).toBe('complete');
    expect(item?.cancelled).toBe(true);
    // The real count from the main process, not the number the run was aiming at.
    expect(item?.importedCount).toBe(12_431);
    expect(item?.error).toBeUndefined();
  });

  it('does NOT become an error when the cancel landed during the query phase', async () => {
    // The early shape. `success: false` here is the pre-existing contract, and
    // the throw it would otherwise trigger is exactly what turned the user's own
    // Cancel press into a red "Import failed" card.
    importResult = {
      success: false,
      messagesImported: 0,
      error: 'Import cancelled',
      cancelled: true,
    };

    const item = await runMessagesSync();

    expect(item?.status).toBe('complete');
    expect(item?.status).not.toBe('error');
    expect(item?.cancelled).toBe(true);
    expect(item?.importedCount).toBe(0);
  });

  it('CONTROL: a genuine failure is still an error, not swallowed as a cancel', async () => {
    // The cancel branch is placed before the throw, so it could plausibly eat
    // real failures. It must key on the flag alone, never on the error text.
    importResult = {
      success: false,
      messagesImported: 0,
      error: 'database is locked',
    };

    const item = await runMessagesSync();

    expect(item?.status).toBe('error');
    expect(item?.error).toBe('database is locked');
    expect(item?.cancelled).toBeFalsy();
  });

  it('CONTROL: an uncancelled import completes without the cancel flag', async () => {
    // The distinguishing input for the first test: if `cancelled` were pinned
    // true anywhere on the path, this row would red.
    importResult = { success: true, messagesImported: 500 };

    const item = await runMessagesSync();

    expect(item?.status).toBe('complete');
    expect(item?.cancelled).toBeFalsy();
    expect(item?.importedCount).toBe(500);
  });
});

describe('BACKLOG-2775 — a rolled back force re-import reaches the UI as "nothing changed"', () => {
  it('carries rolledBack alongside the cancel', async () => {
    // The shape a cancelled FORCE re-import returns: the clear and the
    // re-import shared a transaction that rolled back, so the counts are 0 and
    // the store is untouched. The panel needs the flag to say so — with only
    // `cancelled` it would render "Import cancelled." over a run that, as far
    // as the user can tell, may or may not have eaten their messages.
    importResult = {
      success: false,
      messagesImported: 0,
      error: 'Import cancelled',
      cancelled: true,
      rolledBack: true,
    };

    const item = await runMessagesSync();

    expect(item?.status).toBe('complete');
    expect(item?.cancelled).toBe(true);
    expect(item?.rolledBack).toBe(true);
    expect(item?.importedCount).toBe(0);
  });

  it('CONTROL: a cancelled DELTA import carries no rolledBack and keeps its partial count', async () => {
    // The distinguishing input. A `rolledBack` pinned true anywhere on this
    // path would tell a user who cancelled a long delta import that nothing
    // changed, when in fact 12,431 messages had been imported and kept.
    importResult = { success: true, messagesImported: 12_431, cancelled: true };

    const item = await runMessagesSync();

    expect(item?.cancelled).toBe(true);
    expect(item?.rolledBack).toBeFalsy();
    expect(item?.importedCount).toBe(12_431);
  });
});

describe('BACKLOG-2776 — the reported progress freezes when the user asks to cancel', () => {
  /** Start a run that stays in flight until the returned `finish` is called. */
  async function startPausedRun(): Promise<{ finish: () => Promise<void> }> {
    let release: (value: Record<string, any>) => void = () => {};
    mockImportMacOSMessages.mockImplementationOnce(
      () => new Promise((resolve) => { release = resolve; })
    );

    syncOrchestrator.initializeSyncFunctions();
    const run = (syncOrchestrator as any).startSync({ types: ['messages'], userId: USER });

    // Let the sync function get as far as registering its progress listener.
    while (!progressHandler) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    return {
      finish: async () => {
        release({ success: true, messagesImported: 0, cancelled: true, rolledBack: true });
        await run;
      },
    };
  }

  const messagesItem = () =>
    syncOrchestrator.getState().queue.find((item) => item.type === 'messages');

  /**
   * BACKLOG-3128: what this suite watches freeze changed, because what the
   * messages sync REPORTS changed.
   *
   * These two tests used to read `.progress` — the composite percentage the
   * orchestrator synthesised by giving each phase an equal third of the bar.
   * That number is gone: the phases do not take equal time, so it described the
   * phase list rather than the work, and a value that is not known must not
   * render as known (BACKLOG-2886). `progress` is now pinned at 0 for this
   * source, which would make "did it advance?" trivially false for a reason
   * unrelated to cancelling.
   *
   * The BACKLOG-2776 requirement is unchanged and still pinned here: once the
   * user has asked to cancel, the orchestrator stops applying the run's
   * continuing reports to the queue item. Only the observable moved — from the
   * percentage to the phase and its counts, which are what the item carries now.
   */
  const messagesPhase = () => messagesItem()?.phase;
  const messagesCounts = () => {
    const item = messagesItem();
    return { current: item?.current, total: item?.total };
  };

  const emit = async (
    phase: string,
    percent: number,
    counts?: { current: number; total: number }
  ) => {
    progressHandler?.({ phase, percent, ...counts });
    await new Promise((resolve) => setTimeout(resolve, 0));
  };

  it('stops advancing the reported phase and counts after markCancelRequested', async () => {
    // The founder watched the percentage climb 34% -> 35% through a cancel he
    // had already pressed twice, while the service was inside an
    // uninterruptible 35-second delete. The work genuinely continues until the
    // run can stop; reporting it as progress is what made the cancel look
    // ignored.
    const { finish } = await startPausedRun();

    await emit('deleting', 34, { current: 34, total: 100 });
    const atCancel = messagesPhase();
    const countsAtCancel = messagesCounts();
    expect(atCancel).toBe('deleting');
    expect(countsAtCancel.current).toBe(34);

    syncOrchestrator.markCancelRequested('messages');
    expect(messagesItem()?.cancelRequested).toBe(true);

    // The import keeps running and keeps reporting. The UI must not.
    await emit('deleting', 99, { current: 99, total: 100 });
    await emit('importing', 50, { current: 50, total: 100 });

    expect(messagesPhase()).toBe(atCancel);
    expect(messagesCounts()).toEqual(countsAtCancel);

    await finish();
  });

  it('CONTROL: without the cancel the same events DO advance the report', async () => {
    // The distinguishing input: if reports had simply stopped flowing — a
    // detached listener, a dropped event shape — the test above would be green
    // for a reason that has nothing to do with cancelling.
    const { finish } = await startPausedRun();

    await emit('deleting', 34, { current: 34, total: 100 });
    const firstPhase = messagesPhase();
    const firstCounts = messagesCounts();

    await emit('deleting', 99, { current: 99, total: 100 });
    await emit('importing', 50, { current: 50, total: 100 });

    expect(messagesPhase()).not.toBe(firstPhase);
    expect(messagesCounts()).not.toEqual(firstCounts);

    await finish();
  });

  it('clears the flag when the run ends, so the next import is not born frozen', async () => {
    const { finish } = await startPausedRun();

    syncOrchestrator.markCancelRequested('messages');
    await finish();

    const item = syncOrchestrator.getState().queue.find((queued) => queued.type === 'messages');
    expect(item?.status).toBe('complete');
    expect(item?.cancelRequested).toBeFalsy();
  });

  it('ignores a cancel mark for a sync that is not running', async () => {
    // The acknowledgement must describe something real: there is no run to
    // freeze, so there is nothing to say.
    syncOrchestrator.markCancelRequested('messages');

    expect(
      syncOrchestrator.getState().queue.find((item) => item.type === 'messages')
    ).toBeUndefined();
  });
});
