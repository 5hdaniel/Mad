/**
 * Performance Optimizer Tests
 * Tests for caching, pagination, and batch processing utilities
 */

const {
  Cache,
  QueryCache,
  Paginator,
  BatchProcessor,
  debounce,
  throttle,
  memoize,
} = require('../performanceOptimizer');

describe('Cache', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache(1000); // 1 second TTL
  });

  it('should store and retrieve values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return undefined for non-existent keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('should expire entries after TTL', async () => {
    cache.set('key1', 'value1', 100); // 100ms TTL

    expect(cache.get('key1')).toBe('value1');

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(cache.get('key1')).toBeUndefined();
  }, 10000); // 10 second timeout

  it('should check if key exists', () => {
    cache.set('key1', 'value1');
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('key2')).toBe(false);
  });

  it('should delete entries', () => {
    cache.set('key1', 'value1');
    cache.delete('key1');
    expect(cache.get('key1')).toBeUndefined();
  });

  it('should clear all entries', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clear();

    expect(cache.size()).toBe(0);
  });

  it('should clean expired entries', async () => {
    cache.set('key1', 'value1', 100);
    cache.set('key2', 'value2', 10000);

    await new Promise(resolve => setTimeout(resolve, 150));

    const cleaned = cache.cleanExpired();
    expect(cleaned).toBe(1);
    expect(cache.has('key1')).toBe(false);
    expect(cache.has('key2')).toBe(true);
  }, 10000); // 10 second timeout
});

describe('QueryCache', () => {
  let queryCache;

  beforeEach(() => {
    queryCache = new QueryCache();
  });

  it('should generate cache keys from SQL and params', () => {
    const key1 = queryCache.generateKey('SELECT * FROM users WHERE id = ?', ['123']);
    const key2 = queryCache.generateKey('SELECT * FROM users WHERE id = ?', ['456']);

    expect(key1).not.toBe(key2);
  });

  it('should cache and retrieve query results', () => {
    const sql = 'SELECT * FROM users';
    const params = [];
    const result = [{ id: 1, name: 'John' }];

    queryCache.cacheQuery(sql, params, result);

    const cached = queryCache.getCachedQuery(sql, params);
    expect(cached).toEqual(result);
  });

  it('should invalidate cache for table', () => {
    queryCache.cacheQuery('SELECT * FROM users', [], []);
    queryCache.cacheQuery('UPDATE users SET name = ?', ['John'], {});
    queryCache.cacheQuery('SELECT * FROM transactions', [], []);

    const invalidated = queryCache.invalidateTable('users');

    expect(invalidated).toBe(2);
    expect(queryCache.getCachedQuery('SELECT * FROM transactions', [])).toBeDefined();
  });
});

describe('Paginator', () => {
  it('should calculate pagination params', () => {
    const params = Paginator.getPaginationParams(2, 10);

    expect(params).toEqual({
      offset: 10,
      limit: 10,
    });
  });

  it('should create paginated response', () => {
    const items = ['item1', 'item2'];
    const response = Paginator.createPaginatedResponse(items, 100, 2, 10);

    expect(response).toEqual({
      items,
      pagination: {
        currentPage: 2,
        pageSize: 10,
        totalItems: 100,
        totalPages: 10,
        hasNextPage: true,
        hasPrevPage: true,
      },
    });
  });

  it('should paginate array in memory', () => {
    const array = Array.from({ length: 100 }, (_, i) => `item${i}`);
    const result = Paginator.paginateArray(array, 2, 10);

    expect(result.items).toHaveLength(10);
    expect(result.items[0]).toBe('item10');
    expect(result.pagination.totalPages).toBe(10);
  });

  it('should handle last page correctly', () => {
    const array = Array.from({ length: 25 }, (_, i) => `item${i}`);
    const result = Paginator.paginateArray(array, 3, 10);

    expect(result.items).toHaveLength(5);
    expect(result.pagination.hasNextPage).toBe(false);
    expect(result.pagination.hasPrevPage).toBe(true);
  });
});

describe('BatchProcessor', () => {
  it('should process items in batches', async () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const processor = jest.fn(async (batch) => batch.map(x => x * 2));

    const results = await BatchProcessor.processBatch(items, processor, 10);

    expect(results).toHaveLength(25);
    expect(results[0]).toBe(0);
    expect(results[24]).toBe(48);
    expect(processor).toHaveBeenCalledTimes(3); // 10 + 10 + 5
  });

  it('should call progress callback', async () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const processor = jest.fn(async (batch) => batch);
    const onProgress = jest.fn();

    await BatchProcessor.processBatch(items, processor, 10, onProgress);

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenLastCalledWith({
      processed: 25,
      total: 25,
      batchNumber: 3,
      totalBatches: 3,
      percentage: 100,
    });
  });

  it('should handle processor errors', async () => {
    const items = [1, 2, 3];
    const processor = jest.fn(async () => {
      throw new Error('Processing failed');
    });

    await expect(BatchProcessor.processBatch(items, processor, 10))
      .rejects
      .toThrow('Processing failed');
  });
});

describe('Utility Functions', () => {
  describe('debounce', () => {
    jest.useFakeTimers();

    it('should debounce function calls', () => {
      const func = jest.fn();
      const debounced = debounce(func, 100);

      debounced();
      debounced();
      debounced();

      expect(func).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(func).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    jest.useFakeTimers();

    it('should throttle function calls', () => {
      const func = jest.fn();
      const throttled = throttle(func, 100);

      throttled();
      throttled();
      throttled();

      expect(func).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);
      throttled();

      expect(func).toHaveBeenCalledTimes(2);
    });
  });

  describe('memoize', () => {
    it('should memoize function results', () => {
      const expensiveFunc = jest.fn((x) => x * 2);
      const memoized = memoize(expensiveFunc);

      expect(memoized(5)).toBe(10);
      expect(memoized(5)).toBe(10);
      expect(memoized(5)).toBe(10);

      expect(expensiveFunc).toHaveBeenCalledTimes(1);
    });

    it('should use custom key generator', () => {
      const func = jest.fn((obj) => obj.value * 2);
      const memoized = memoize(func, (args) => args[0].id);

      memoized({ id: 1, value: 5 });
      memoized({ id: 1, value: 10 }); // Same ID, should use cache

      expect(func).toHaveBeenCalledTimes(1);
    });
  });
});
