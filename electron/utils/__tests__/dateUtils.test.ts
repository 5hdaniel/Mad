/**
 * Unit tests for Date Utilities
 */

import { macTimestampToDate, getYearsAgoTimestamp, formatDateForFilename } from '../dateUtils';
import { MAC_EPOCH } from '../../constants';

describe('dateUtils', () => {
  describe('macTimestampToDate', () => {
    it('should return epoch date for null input', () => {
      const result = macTimestampToDate(null);
      expect(result.getTime()).toBe(0);
    });

    it('should return epoch date for undefined input', () => {
      const result = macTimestampToDate(undefined);
      expect(result.getTime()).toBe(0);
    });

    it('should return epoch date for 0 input', () => {
      const result = macTimestampToDate(0);
      expect(result.getTime()).toBe(0);
    });

    it('should convert macOS timestamp to JavaScript Date', () => {
      // macOS timestamp for 2024-01-01 00:00:00 UTC
      // MAC_EPOCH is 2001-01-01, so 23 years later
      const yearsInNanoseconds = 23 * 365.25 * 24 * 60 * 60 * 1000 * 1000000;
      const result = macTimestampToDate(yearsInNanoseconds);

      // Should be approximately 2024
      expect(result.getFullYear()).toBeGreaterThanOrEqual(2023);
      expect(result.getFullYear()).toBeLessThanOrEqual(2025);
    });

    it('should correctly use MAC_EPOCH in calculation', () => {
      // 0 nanoseconds from MAC_EPOCH should be 2001-01-01
      const result = macTimestampToDate(1); // 1 nanosecond
      const expectedDate = new Date(MAC_EPOCH);

      // Should be very close to MAC_EPOCH
      expect(Math.abs(result.getTime() - expectedDate.getTime())).toBeLessThan(1);
    });

    it('should handle large timestamps', () => {
      // A large but valid timestamp
      const largeTimestamp = 700000000000000000; // ~22 years in nanoseconds
      const result = macTimestampToDate(largeTimestamp);

      expect(result instanceof Date).toBe(true);
      expect(result.getTime()).toBeGreaterThan(MAC_EPOCH);
    });
  });

  describe('getYearsAgoTimestamp', () => {
    it('should return timestamp for 1 year ago', () => {
      const result = getYearsAgoTimestamp(1);
      const expected = Date.now() - (1 * 365 * 24 * 60 * 60 * 1000);

      // Allow 1 second tolerance for test execution time
      expect(Math.abs(result - expected)).toBeLessThan(1000);
    });

    it('should return timestamp for 5 years ago', () => {
      const result = getYearsAgoTimestamp(5);
      const expected = Date.now() - (5 * 365 * 24 * 60 * 60 * 1000);

      expect(Math.abs(result - expected)).toBeLessThan(1000);
    });

    it('should return current timestamp for 0 years', () => {
      const result = getYearsAgoTimestamp(0);
      const expected = Date.now();

      expect(Math.abs(result - expected)).toBeLessThan(1000);
    });

    it('should return future timestamp for negative years', () => {
      const result = getYearsAgoTimestamp(-1);
      const expected = Date.now() + (1 * 365 * 24 * 60 * 60 * 1000);

      expect(Math.abs(result - expected)).toBeLessThan(1000);
    });
  });

  describe('formatDateForFilename', () => {
    it('should format date in YYYYMMDD_HHMMSS format', () => {
      const date = new Date('2024-06-15T14:30:45');
      const result = formatDateForFilename(date);

      expect(result).toBe('20240615_143045');
    });

    it('should pad single digit months and days with zeros', () => {
      const date = new Date('2024-01-05T09:05:03');
      const result = formatDateForFilename(date);

      expect(result).toBe('20240105_090503');
    });

    it('should handle midnight', () => {
      const date = new Date('2024-12-31T00:00:00');
      const result = formatDateForFilename(date);

      expect(result).toBe('20241231_000000');
    });

    it('should handle end of day', () => {
      const date = new Date('2024-12-31T23:59:59');
      const result = formatDateForFilename(date);

      expect(result).toBe('20241231_235959');
    });

    it('should produce valid filename characters', () => {
      const date = new Date();
      const result = formatDateForFilename(date);

      // Should only contain digits and underscore
      expect(result).toMatch(/^\d{8}_\d{6}$/);
    });
  });
});
