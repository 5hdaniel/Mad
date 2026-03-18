/**
 * Format utility tests
 * TASK-2254: Tests for admin-portal date formatting utilities
 */

import { describe, it, expect } from 'vitest';
import { formatDate, formatTimestamp } from '../format';

describe('formatDate', () => {
  it('should format ISO date string as short date', () => {
    const result = formatDate('2024-03-15T10:30:00Z');
    // Output depends on locale but should contain month, day, year
    expect(result).toContain('2024');
    expect(result).toContain('15');
  });

  it('should return "Unknown" for null input', () => {
    expect(formatDate(null)).toBe('Unknown');
  });

  it('should return "Unknown" for undefined input', () => {
    expect(formatDate(undefined)).toBe('Unknown');
  });

  it('should return "Unknown" for empty string input', () => {
    expect(formatDate('')).toBe('Unknown');
  });

  it('should use custom fallback when provided', () => {
    expect(formatDate(null, 'N/A')).toBe('N/A');
    expect(formatDate(undefined, '-')).toBe('-');
  });

  it('should handle date-only strings', () => {
    const result = formatDate('2024-12-25');
    expect(result).toContain('2024');
  });
});

describe('formatTimestamp', () => {
  it('should format ISO date string as full timestamp', () => {
    const result = formatTimestamp('2024-03-15T10:30:00Z');
    // Should contain date and time components
    expect(result).toContain('2024');
    expect(result).toContain('15');
  });

  it('should return "Unknown" for null input', () => {
    expect(formatTimestamp(null)).toBe('Unknown');
  });

  it('should return "Unknown" for undefined input', () => {
    expect(formatTimestamp(undefined)).toBe('Unknown');
  });

  it('should return "Unknown" for empty string input', () => {
    expect(formatTimestamp('')).toBe('Unknown');
  });

  it('should use custom fallback when provided', () => {
    expect(formatTimestamp(null, 'No timestamp')).toBe('No timestamp');
  });
});
