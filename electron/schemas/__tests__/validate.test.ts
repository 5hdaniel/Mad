/**
 * Tests for Zod validation utilities.
 */
import { z } from 'zod/v4';
import { validateResponse, safeValidate, validateArray } from '../validate';

// Mock electron-log
jest.mock('electron-log', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const TestSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number().optional(),
});

describe('validateResponse', () => {
  it('returns validated data for valid input', () => {
    const data = { id: '123', name: 'Alice', age: 30 };
    const result = validateResponse(TestSchema, data, 'test');
    expect(result).toEqual(data);
  });

  it('strips extra fields from valid input', () => {
    const data = { id: '123', name: 'Alice', extra: 'field' };
    const result = validateResponse(TestSchema, data, 'test');
    // Zod v4 strips unknown keys by default
    expect(result.id).toBe('123');
    expect(result.name).toBe('Alice');
  });

  it('returns original data on validation failure (graceful degradation)', () => {
    const invalidData = { id: 123, name: null }; // id should be string, name should be string
    const result = validateResponse(TestSchema, invalidData, 'test.graceful');
    // Should return original data as-is (graceful degradation)
    expect(result).toEqual(invalidData);
  });

  it('logs warning on validation failure', () => {
    const log = require('electron-log').default;
    const invalidData = { id: 123 };
    validateResponse(TestSchema, invalidData, 'test.logging');
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('[Validation] test.logging')
    );
  });

  it('handles null input gracefully', () => {
    const result = validateResponse(TestSchema, null, 'test.null');
    expect(result).toBeNull();
  });

  it('handles undefined input gracefully', () => {
    const result = validateResponse(TestSchema, undefined, 'test.undefined');
    expect(result).toBeUndefined();
  });
});

describe('safeValidate', () => {
  it('returns success for valid data', () => {
    const data = { id: '123', name: 'Bob' };
    const result = safeValidate(TestSchema, data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('123');
    }
  });

  it('returns error for invalid data', () => {
    const result = safeValidate(TestSchema, { id: 123, name: null });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('does NOT do graceful degradation', () => {
    const result = safeValidate(TestSchema, { broken: true });
    expect(result.success).toBe(false);
  });
});

describe('validateArray', () => {
  it('validates an array of valid items', () => {
    const items = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];
    const result = validateArray(TestSchema, items, 'test.array');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
  });

  it('returns all items even when some are invalid (graceful degradation)', () => {
    const items = [
      { id: '1', name: 'Alice' },
      { id: 123, name: null }, // Invalid
      { id: '3', name: 'Charlie' },
    ];
    const result = validateArray(TestSchema, items, 'test.array.mixed');
    expect(result).toHaveLength(3);
  });

  it('logs warnings for invalid items', () => {
    const log = require('electron-log').default;
    log.warn.mockClear();
    const items = [
      { id: 123 }, // Invalid
    ];
    validateArray(TestSchema, items, 'test.array.warn');
    expect(log.warn).toHaveBeenCalled();
  });

  it('handles empty array', () => {
    const result = validateArray(TestSchema, [], 'test.array.empty');
    expect(result).toHaveLength(0);
  });
});
