/**
 * Tests for IPC Request Cache and Deduplication Layer
 */
import { ipcCache } from '../ipcCache';

// Mock electron-log
jest.mock('electron-log', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('IpcCache', () => {
  beforeEach(() => {
    ipcCache.clear();
  });

  describe('key()', () => {
    it('builds key from channel and string args', () => {
      const key = ipcCache.key('contacts:list', 'user-123');
      expect(key).toBe('contacts:list:user-123');
    });

    it('builds key from channel and object args', () => {
      const key = ipcCache.key('contacts:list', 'user-123', { page: 1 });
      expect(key).toBe('contacts:list:user-123:{"page":1}');
    });

    it('handles null/undefined args', () => {
      const key = ipcCache.key('contacts:list', null, undefined);
      expect(key).toBe('contacts:list::');
    });

    it('handles channel-only key', () => {
      const key = ipcCache.key('system:info');
      expect(key).toBe('system:info');
    });
  });

  describe('get() / set()', () => {
    it('returns cached value within TTL', () => {
      ipcCache.set('test-key', { data: 'hello' }, 5000);
      const result = ipcCache.get<{ data: string }>('test-key');
      expect(result).toEqual({ data: 'hello' });
    });

    it('returns undefined for missing key', () => {
      const result = ipcCache.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('returns undefined for expired entry', () => {
      ipcCache.set('test-expired', 'old-data', 1); // 1ms TTL
      // Wait for expiry
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const result = ipcCache.get('test-expired');
          expect(result).toBeUndefined();
          resolve();
        }, 10);
      });
    });

    it('overwrites existing entry', () => {
      ipcCache.set('test-overwrite', 'first', 5000);
      ipcCache.set('test-overwrite', 'second', 5000);
      expect(ipcCache.get('test-overwrite')).toBe('second');
    });
  });

  describe('getOrFetch()', () => {
    it('fetches and caches on miss', async () => {
      const fetcher = jest.fn().mockResolvedValue({ contacts: [1, 2, 3] });
      const result = await ipcCache.getOrFetch('contacts:list:u1', fetcher);
      expect(result).toEqual({ contacts: [1, 2, 3] });
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('returns cached value without calling fetcher', async () => {
      ipcCache.set('contacts:list:u1', { contacts: [1] }, 5000);
      const fetcher = jest.fn().mockResolvedValue({ contacts: [1, 2, 3] });
      const result = await ipcCache.getOrFetch('contacts:list:u1', fetcher);
      expect(result).toEqual({ contacts: [1] }); // Cached value
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('deduplicates in-flight requests', async () => {
      let resolvePromise: (v: string) => void;
      const fetcher = jest.fn().mockImplementation(
        () => new Promise<string>((r) => { resolvePromise = r; })
      );

      // Start two concurrent requests for the same key
      const promise1 = ipcCache.getOrFetch('dedup-key', fetcher);
      const promise2 = ipcCache.getOrFetch('dedup-key', fetcher);

      // Should only call fetcher once (dedup)
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Resolve and verify both get same result
      resolvePromise!('result');
      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe('result');
      expect(result2).toBe('result');
    });

    it('clears inflight on fetch error', async () => {
      const fetcher = jest.fn().mockRejectedValue(new Error('fetch failed'));
      await expect(ipcCache.getOrFetch('error-key', fetcher)).rejects.toThrow('fetch failed');

      // Should be able to retry (inflight cleared)
      const retryFetcher = jest.fn().mockResolvedValue('retry-success');
      const result = await ipcCache.getOrFetch('error-key', retryFetcher);
      expect(result).toBe('retry-success');
    });
  });

  describe('invalidatePrefix()', () => {
    it('removes all entries matching prefix', () => {
      ipcCache.set('contacts:list:u1', 'data1', 5000);
      ipcCache.set('contacts:get:c1', 'data2', 5000);
      ipcCache.set('transactions:list:u1', 'data3', 5000);

      ipcCache.invalidatePrefix('contacts:');

      expect(ipcCache.get('contacts:list:u1')).toBeUndefined();
      expect(ipcCache.get('contacts:get:c1')).toBeUndefined();
      expect(ipcCache.get('transactions:list:u1')).toBe('data3'); // Not invalidated
    });

    it('handles no matching entries gracefully', () => {
      ipcCache.set('test', 'data', 5000);
      ipcCache.invalidatePrefix('nonexistent:');
      expect(ipcCache.get('test')).toBe('data');
    });
  });

  describe('invalidate()', () => {
    it('removes a specific entry', () => {
      ipcCache.set('key1', 'data1', 5000);
      ipcCache.set('key2', 'data2', 5000);

      ipcCache.invalidate('key1');
      expect(ipcCache.get('key1')).toBeUndefined();
      expect(ipcCache.get('key2')).toBe('data2');
    });
  });

  describe('clear()', () => {
    it('removes all entries', () => {
      ipcCache.set('k1', 'd1', 5000);
      ipcCache.set('k2', 'd2', 5000);
      ipcCache.clear();
      expect(ipcCache.get('k1')).toBeUndefined();
      expect(ipcCache.get('k2')).toBeUndefined();
    });
  });

  describe('stats', () => {
    it('tracks hits and misses', () => {
      ipcCache.set('hit-key', 'data', 5000);
      ipcCache.get('hit-key'); // hit
      ipcCache.get('miss-key'); // miss

      const stats = ipcCache.getStats();
      expect(stats.hits).toBeGreaterThanOrEqual(1);
      expect(stats.misses).toBeGreaterThanOrEqual(1);
    });

    it('calculates hit rate', () => {
      ipcCache.set('hr-key', 'data', 5000);
      ipcCache.get('hr-key'); // hit
      ipcCache.get('hr-key'); // hit
      ipcCache.get('miss'); // miss

      const hitRate = ipcCache.getHitRate();
      expect(hitRate).toBeGreaterThan(0);
    });
  });

  describe('cleanup()', () => {
    it('removes expired entries', () => {
      ipcCache.set('fresh', 'data', 60000);
      ipcCache.set('stale', 'old', 1); // 1ms TTL

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const removed = ipcCache.cleanup();
          expect(removed).toBe(1);
          expect(ipcCache.get('fresh')).toBe('data');
          expect(ipcCache.get('stale')).toBeUndefined();
          resolve();
        }, 10);
      });
    });
  });
});
