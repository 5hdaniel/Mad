/**
 * IPC Request Cache and Deduplication Layer
 *
 * Provides TTL-based caching for IPC handler responses and in-flight request
 * deduplication. This prevents redundant main-process queries when the renderer
 * re-requests the same data within a short window.
 *
 * Features:
 * - TTL-based cache with configurable per-channel expiry
 * - In-flight request deduplication (same request = same promise)
 * - Automatic cache invalidation on write operations
 * - Cache hit/miss logging for debugging
 * - Memory-safe: entries auto-expire, manual clear available
 *
 * Usage in handlers:
 *   import { ipcCache } from '../services/ipcCache';
 *
 *   // In a read handler:
 *   const cacheKey = ipcCache.key('contacts:list', userId, JSON.stringify(filters));
 *   const cached = ipcCache.get(cacheKey);
 *   if (cached) return cached;
 *
 *   const result = await doExpensiveQuery();
 *   ipcCache.set(cacheKey, result, 5000); // 5 second TTL
 *   return result;
 *
 *   // In a write handler:
 *   ipcCache.invalidatePrefix('contacts:');
 */

import log from 'electron-log';

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  invalidations: number;
  size: number;
}

class IpcCache {
  private cache = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<unknown>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    invalidations: 0,
    size: 0,
  };

  /**
   * Default TTL per channel prefix (milliseconds).
   * Override with the ttl parameter in set() or getOrFetch().
   */
  private defaultTtls: Record<string, number> = {
    'contacts:': 5000,      // 5 seconds
    'transactions:': 5000,  // 5 seconds
    'user:': 10000,         // 10 seconds
    'preferences:': 30000,  // 30 seconds
    'license:': 60000,      // 1 minute
    'system:': 15000,       // 15 seconds
  };

  /**
   * Build a cache key from channel name and args.
   * Use this to create consistent keys.
   */
  key(channel: string, ...args: unknown[]): string {
    const argStr = args
      .map((a) => {
        if (a === undefined || a === null) return '';
        if (typeof a === 'string') return a;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(':');
    return argStr ? `${channel}:${argStr}` : channel;
  }

  /**
   * Get a cached value if it exists and hasn't expired.
   * Returns undefined on miss or expired entry.
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      // Entry expired
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size = this.cache.size;
      return undefined;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * Store a value in the cache with TTL.
   * If ttl is not provided, uses the default for the key's channel prefix.
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const resolvedTtl = ttl ?? this.getDefaultTtl(key);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: resolvedTtl,
    });
    this.stats.sets++;
    this.stats.size = this.cache.size;
  }

  /**
   * Get cached value or fetch it, with in-flight deduplication.
   *
   * If the same key is currently being fetched, returns the same promise
   * instead of starting a new fetch. This prevents N+1 queries when
   * multiple React components request the same data simultaneously.
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    // Check cache first
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Check for in-flight request (dedup)
    const existing = this.inflight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    // Start new fetch
    const promise = fetcher()
      .then((data) => {
        this.set(key, data, ttl);
        this.inflight.delete(key);
        return data;
      })
      .catch((error) => {
        this.inflight.delete(key);
        throw error;
      });

    this.inflight.set(key, promise);
    return promise;
  }

  /**
   * Invalidate all cache entries matching a prefix.
   * Call this from write handlers to ensure stale data is cleared.
   *
   * Example: ipcCache.invalidatePrefix('contacts:') clears all contact cache.
   */
  invalidatePrefix(prefix: string): void {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    // Also cancel in-flight requests for this prefix
    for (const key of this.inflight.keys()) {
      if (key.startsWith(prefix)) {
        this.inflight.delete(key);
      }
    }
    if (count > 0) {
      this.stats.invalidations += count;
      this.stats.size = this.cache.size;
      log.debug(`[IpcCache] Invalidated ${count} entries for prefix: ${prefix}`);
    }
  }

  /**
   * Invalidate a specific cache entry.
   */
  invalidate(key: string): void {
    const existed = this.cache.delete(key);
    this.inflight.delete(key);
    if (existed) {
      this.stats.invalidations++;
      this.stats.size = this.cache.size;
    }
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.inflight.clear();
    this.stats.invalidations += size;
    this.stats.size = 0;
    log.debug(`[IpcCache] Cleared ${size} entries`);
  }

  /**
   * Get cache statistics for monitoring/debugging.
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get the hit rate as a percentage (0-100).
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return 0;
    return Math.round((this.stats.hits / total) * 100);
  }

  /**
   * Clean up expired entries. Call periodically if needed.
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }
    this.stats.size = this.cache.size;
    return removed;
  }

  /**
   * Resolve the default TTL for a key based on its channel prefix.
   */
  private getDefaultTtl(key: string): number {
    for (const [prefix, ttl] of Object.entries(this.defaultTtls)) {
      if (key.startsWith(prefix)) {
        return ttl;
      }
    }
    return 5000; // Default: 5 seconds
  }
}

/**
 * Singleton IPC cache instance.
 * Shared across all handlers in the main process.
 */
export const ipcCache = new IpcCache();
export type { CacheStats };
