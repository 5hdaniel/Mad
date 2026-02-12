/**
 * Contact Worker Pool (TASK-1956)
 *
 * Singleton that creates ONE persistent Worker at DB init time and reuses it
 * for all contact queries. This eliminates the ~150-450ms main-thread blocking
 * from spawning a new Worker() on every page load.
 *
 * API:
 *   initializePool(dbPath, encryptionKey) — called once after DB init
 *   queryContacts(type, userId, timeout?)  — routes query to persistent worker
 *   shutdownPool()                         — called on app quit
 *   isPoolReady()                          — guard for fallback
 *
 * Deduplication: If same userId:type query is already in-flight, the same
 * Promise is returned to avoid duplicate queries from both handlers.
 */

import { Worker } from "worker_threads";
import path from "path";
import crypto from "crypto";
import logService from "../services/logService";

type QueryType = "external" | "imported" | "backfill";

interface PendingQuery {
  resolve: (data: unknown[]) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

let worker: Worker | null = null;
let ready = false;
let initPromise: Promise<void> | null = null;

// Pending queries by request ID
const pendingQueries = new Map<string, PendingQuery>();

// Deduplication: in-flight queries by "userId:type" key
const inflightQueries = new Map<string, Promise<unknown[]>>();

function getWorkerPath(): string {
  return path.join(__dirname, 'contactQueryWorker.js');
}

function handleWorkerMessage(msg: { type?: string; id?: string; success?: boolean; data?: unknown[]; error?: string }): void {
  // Init response
  if (msg.type === "ready") {
    ready = true;
    logService.info("[ContactWorkerPool] Worker initialized and ready", "ContactWorkerPool");
    return;
  }

  if (msg.type === "error") {
    logService.error("[ContactWorkerPool] Worker init error: " + msg.error, "ContactWorkerPool");
    return;
  }

  // Query response
  if (msg.id) {
    const pending = pendingQueries.get(msg.id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    pendingQueries.delete(msg.id);

    if (msg.success && msg.data) {
      pending.resolve(msg.data);
    } else {
      pending.reject(new Error(msg.error || "Unknown worker error"));
    }
  }
}

/**
 * Initialize the persistent worker pool.
 * Called once after database initialization succeeds.
 */
export function initializePool(dbPath: string, encryptionKey: string): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = new Promise<void>((resolve, reject) => {
    try {
      const workerPath = getWorkerPath();
      worker = new Worker(workerPath);

      worker.on("message", handleWorkerMessage);

      worker.on("error", (err) => {
        logService.error("[ContactWorkerPool] Worker error: " + err.message, "ContactWorkerPool");
        // Reject all pending queries
        for (const [id, pending] of pendingQueries) {
          clearTimeout(pending.timeout);
          pending.reject(err);
          pendingQueries.delete(id);
        }
        inflightQueries.clear();
        ready = false;
      });

      worker.on("exit", (code) => {
        if (code !== 0) {
          logService.warn(`[ContactWorkerPool] Worker exited with code ${code}`, "ContactWorkerPool");
        }
        worker = null;
        ready = false;
        initPromise = null;
        inflightQueries.clear();
        // Reject remaining pending queries
        for (const [id, pending] of pendingQueries) {
          clearTimeout(pending.timeout);
          pending.reject(new Error(`Worker exited with code ${code}`));
          pendingQueries.delete(id);
        }
      });

      // Send init message with DB credentials
      worker.postMessage({
        type: "init",
        dbPath,
        encryptionKey,
      });

      // Wait for ready signal with timeout
      const initTimeout = setTimeout(() => {
        if (!ready) {
          reject(new Error("Worker pool init timed out after 10s"));
          worker?.terminate();
          worker = null;
          initPromise = null;
        }
      }, 10_000);

      // Poll for ready state (the message handler sets ready = true)
      const checkReady = setInterval(() => {
        if (ready) {
          clearInterval(checkReady);
          clearTimeout(initTimeout);
          resolve();
        }
      }, 10);
    } catch (error) {
      initPromise = null;
      reject(error);
    }
  });

  return initPromise;
}

/**
 * Query contacts via the persistent worker.
 * Returns the same Promise for duplicate in-flight queries (deduplication).
 */
export function queryContacts(
  type: QueryType,
  userId: string,
  timeoutMs: number = 30_000,
): Promise<unknown[]> {
  // Deduplication key
  const dedupKey = `${userId}:${type}`;

  // If same query is already in-flight, return the same promise
  const inflight = inflightQueries.get(dedupKey);
  if (inflight) {
    logService.debug(`[ContactWorkerPool] Dedup hit for ${dedupKey}`, "ContactWorkerPool");
    return inflight;
  }

  const promise = new Promise<unknown[]>((resolve, reject) => {
    if (!worker || !ready) {
      reject(new Error("Worker pool not initialized"));
      return;
    }

    const id = crypto.randomUUID();

    const timeout = setTimeout(() => {
      pendingQueries.delete(id);
      inflightQueries.delete(dedupKey);
      reject(new Error(`Contact query timed out after ${timeoutMs}ms (type: ${type})`));
    }, timeoutMs);

    pendingQueries.set(id, { resolve, reject, timeout });

    worker.postMessage({ id, type, userId });
  });

  // Store for deduplication, clean up when resolved/rejected
  inflightQueries.set(dedupKey, promise);
  promise.finally(() => {
    inflightQueries.delete(dedupKey);
  });

  return promise;
}

/**
 * Shutdown the worker pool. Called on app quit.
 */
export function shutdownPool(): void {
  if (worker) {
    try {
      worker.postMessage({ type: "shutdown" });
    } catch {
      // Worker may already be terminated
    }
    // Give it a moment to clean up, then force terminate
    setTimeout(() => {
      if (worker) {
        worker.terminate();
        worker = null;
      }
    }, 500);
  }
  ready = false;
  initPromise = null;
  inflightQueries.clear();

  // Clean up pending queries
  for (const [id, pending] of pendingQueries) {
    clearTimeout(pending.timeout);
    pending.reject(new Error("Worker pool shutting down"));
    pendingQueries.delete(id);
  }
}

/**
 * Check if the worker pool is ready for queries.
 */
export function isPoolReady(): boolean {
  return ready && worker !== null;
}
