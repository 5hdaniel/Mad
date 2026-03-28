/**
 * WindowApi Local Sync sub-interface
 * Android companion WiFi sync server control (TASK-1431)
 */

/**
 * Local Sync API for Android companion WiFi message sync
 */
export interface WindowApiLocalSync {
  /** Start the local sync HTTP server */
  startServer: (options: {
    port: number;
    secret: string;
    userId?: string;
  }) => Promise<{ port: number; address: string }>;

  /** Stop the local sync HTTP server */
  stopServer: () => Promise<void>;

  /** Get the current sync server status including statistics */
  getStatus: () => Promise<{
    running: boolean;
    port: number | null;
    address: string | null;
    totalMessagesReceived: number;
    lastSyncTimestamp: number | null;
  }>;
}
