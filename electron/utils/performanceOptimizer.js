/**
 * Performance Optimization Utilities
 * Provides caching, pagination, and query optimization
 */

const log = require('electron-log');

/**
 * In-Memory Cache with TTL
 */
class Cache {
  constructor(defaultTTL = 300000) { // 5 minutes default
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  /**
   * Set cache entry
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  set(key, value, ttl = this.defaultTTL) {
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Get cache entry
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Check if key exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * Delete cache entry
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache size
   * @returns {number}
   */
  size() {
    return this.cache.size;
  }

  /**
   * Clean expired entries
   */
  cleanExpired() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log.info(`[Cache] Cleaned ${cleaned} expired entries`);
    }

    return cleaned;
  }
}

/**
 * Query Result Cache
 * Caches database query results
 */
class QueryCache extends Cache {
  constructor() {
    super(60000); // 1 minute default for queries
  }

  /**
   * Generate cache key from query and params
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {string} Cache key
   */
  generateKey(sql, params = []) {
    const paramsStr = JSON.stringify(params);
    return `${sql}:${paramsStr}`;
  }

  /**
   * Cache query result
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @param {*} result - Query result
   * @param {number} ttl - Time to live
   */
  cacheQuery(sql, params, result, ttl) {
    const key = this.generateKey(sql, params);
    this.set(key, result, ttl);
  }

  /**
   * Get cached query result
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {*} Cached result or undefined
   */
  getCachedQuery(sql, params) {
    const key = this.generateKey(sql, params);
    return this.get(key);
  }

  /**
   * Invalidate cache for table
   * @param {string} tableName - Table name
   */
  invalidateTable(tableName) {
    let invalidated = 0;

    for (const [key] of this.cache.entries()) {
      if (key.includes(`FROM ${tableName}`) || key.includes(`UPDATE ${tableName}`) || key.includes(`INSERT INTO ${tableName}`)) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    log.info(`[QueryCache] Invalidated ${invalidated} entries for table: ${tableName}`);
    return invalidated;
  }
}

/**
 * Pagination Helper
 */
class Paginator {
  /**
   * Create pagination params
   * @param {number} page - Page number (1-indexed)
   * @param {number} pageSize - Items per page
   * @returns {Object} Pagination params
   */
  static getPaginationParams(page = 1, pageSize = 50) {
    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    return { offset, limit };
  }

  /**
   * Create paginated response
   * @param {Array} items - Items array
   * @param {number} totalCount - Total number of items
   * @param {number} page - Current page
   * @param {number} pageSize - Items per page
   * @returns {Object} Paginated response
   */
  static createPaginatedResponse(items, totalCount, page, pageSize) {
    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      items,
      pagination: {
        currentPage: page,
        pageSize,
        totalItems: totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Paginate array in memory
   * @param {Array} array - Array to paginate
   * @param {number} page - Page number
   * @param {number} pageSize - Items per page
   * @returns {Object} Paginated result
   */
  static paginateArray(array, page = 1, pageSize = 50) {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const items = array.slice(startIndex, endIndex);

    return this.createPaginatedResponse(items, array.length, page, pageSize);
  }
}

/**
 * Batch Processor
 * Process large datasets in batches
 */
class BatchProcessor {
  /**
   * Process items in batches
   * @param {Array} items - Items to process
   * @param {Function} processor - Async function to process each batch
   * @param {number} batchSize - Batch size
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Array>} Processing results
   */
  static async processBatch(items, processor, batchSize = 100, onProgress = null) {
    const results = [];
    const totalBatches = Math.ceil(items.length / batchSize);

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      try {
        const batchResults = await processor(batch, batchNumber);
        results.push(...(Array.isArray(batchResults) ? batchResults : [batchResults]));

        if (onProgress) {
          onProgress({
            processed: Math.min(i + batchSize, items.length),
            total: items.length,
            batchNumber,
            totalBatches,
            percentage: Math.round((Math.min(i + batchSize, items.length) / items.length) * 100),
          });
        }
      } catch (error) {
        log.error(`[BatchProcessor] Error processing batch ${batchNumber}/${totalBatches}:`, error);
        throw error;
      }
    }

    return results;
  }
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait = 300) {
  let timeout;

  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit = 300) {
  let inThrottle;

  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Memoize function results
 * @param {Function} func - Function to memoize
 * @param {Function} keyGenerator - Custom key generator
 * @returns {Function} Memoized function
 */
function memoize(func, keyGenerator = JSON.stringify) {
  const cache = new Map();

  return function(...args) {
    const key = keyGenerator(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = func.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Global caches
 */
const queryCache = new QueryCache();
const generalCache = new Cache();

// Clean expired entries every 10 minutes
setInterval(() => {
  queryCache.cleanExpired();
  generalCache.cleanExpired();
}, 600000);

module.exports = {
  Cache,
  QueryCache,
  Paginator,
  BatchProcessor,
  debounce,
  throttle,
  memoize,
  queryCache,
  generalCache,
};
