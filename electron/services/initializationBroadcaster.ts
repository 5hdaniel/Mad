/**
 * InitializationBroadcaster
 *
 * Singleton service that tracks initialization stages and broadcasts
 * stage transitions to renderer processes via IPC events.
 *
 * Part of the event-driven initialization protocol (BACKLOG-1379).
 * Replaces polling-based readiness detection with push-based approach.
 */

import { BrowserWindow } from "electron";
import log from "electron-log";

// ============================================
// TYPE DEFINITIONS
// ============================================

export type InitStage =
  | "idle"
  | "db-opening"
  | "migrating"
  | "db-ready"
  | "creating-user"
  | "complete"
  | "error";

export interface InitStageEvent {
  stage: InitStage;
  progress?: number; // 0-100 for migration progress
  message?: string; // Human-readable status
  error?: { message: string; retryable: boolean }; // Only when stage=error
}

interface StageHistoryEntry {
  stage: InitStage;
  timestamp: string;
  detail?: string;
}

// ============================================
// IPC CHANNEL CONSTANT
// ============================================

export const INIT_STAGE_CHANNEL = "system:init-stage";

// ============================================
// INITIALIZATION BROADCASTER
// ============================================

class InitializationBroadcaster {
  private currentEvent: InitStageEvent = { stage: "idle" };
  private history: StageHistoryEntry[] = [];
  private window: BrowserWindow | null = null;

  /**
   * Set the BrowserWindow reference for broadcasting.
   * Must be called after the main window is created.
   * Safe to call with null (clears the window reference).
   */
  setWindow(win: BrowserWindow | null): void {
    this.window = win;
  }

  /**
   * Get the current initialization stage event.
   * Used by late-joining renderers to catch up on current state.
   */
  getCurrentStage(): InitStageEvent {
    return { ...this.currentEvent };
  }

  /**
   * Get the full stage transition history for diagnostics.
   * Returns a copy to prevent external mutation.
   */
  getHistory(): StageHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Broadcast a stage transition to all renderer windows.
   * Updates internal state and sends IPC event.
   *
   * Safe to call before window is set — the event is recorded
   * in history and getCurrentStage() is updated, but no IPC
   * message is sent.
   */
  broadcast(event: InitStageEvent): void {
    this.currentEvent = { ...event };

    const historyEntry: StageHistoryEntry = {
      stage: event.stage,
      timestamp: new Date().toISOString(),
      detail: event.message,
    };
    this.history.push(historyEntry);

    log.debug(
      `[InitBroadcaster] Stage: ${event.stage}${event.message ? ` — ${event.message}` : ""}`,
    );

    // Broadcast to all windows (supports multi-window scenarios)
    try {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed() && win.webContents) {
          win.webContents.send(INIT_STAGE_CHANNEL, event);
        }
      }
    } catch (err) {
      // Window may not be ready during early initialization — this is expected
      log.debug(
        `[InitBroadcaster] Could not broadcast to windows: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Reset the broadcaster to idle state.
   * Used for testing and re-initialization scenarios.
   */
  reset(): void {
    this.currentEvent = { stage: "idle" };
    this.history = [];
    this.window = null;
  }
}

// Export singleton instance
export const initializationBroadcaster = new InitializationBroadcaster();

// Also export the class for testing
export { InitializationBroadcaster };
