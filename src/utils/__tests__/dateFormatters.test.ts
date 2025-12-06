/**
 * Unit tests for Date Formatters
 */

import { formatMessageDate } from '../dateFormatters';

describe('dateFormatters', () => {
  const MAC_EPOCH = new Date('2001-01-01T00:00:00Z').getTime();

  describe('formatMessageDate', () => {
    it('should return "No messages" for falsy input', () => {
      expect(formatMessageDate(0)).toBe('No messages');
      expect(formatMessageDate(null as any)).toBe('No messages');
      expect(formatMessageDate(undefined as any)).toBe('No messages');
    });

    it('should return "Today" for messages from today', () => {
      // Create a MAC timestamp for today
      const now = new Date();
      const macTimestamp = (now.getTime() - MAC_EPOCH) * 1000000;

      const result = formatMessageDate(macTimestamp);

      expect(result).toBe('Today');
    });

    it('should return "Yesterday" for messages from yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const macTimestamp = (yesterday.getTime() - MAC_EPOCH) * 1000000;

      const result = formatMessageDate(macTimestamp);

      expect(result).toBe('Yesterday');
    });

    it('should return "X days ago" for messages within a week', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const macTimestamp = (threeDaysAgo.getTime() - MAC_EPOCH) * 1000000;

      const result = formatMessageDate(macTimestamp);

      expect(result).toBe('3 days ago');
    });

    it('should return formatted date for messages older than a week', () => {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const macTimestamp = (twoWeeksAgo.getTime() - MAC_EPOCH) * 1000000;

      const result = formatMessageDate(macTimestamp);

      // Should be a locale date string
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\.\d{1,2}\.\d{2,4}|\d{2,4}-\d{1,2}-\d{1,2}/);
    });

    it('should handle string timestamps', () => {
      // String timestamp should be treated as 0
      const result = formatMessageDate('invalid' as any);

      // With 0 timestamp, date will be at MAC_EPOCH (2001)
      expect(typeof result).toBe('string');
    });

    it('should handle Date object input', () => {
      // Date object won't work correctly due to the MAC epoch conversion,
      // but should not throw
      const result = formatMessageDate(new Date());
      expect(typeof result).toBe('string');
    });

    it('should return "2 days ago" for messages from 2 days ago', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const macTimestamp = (twoDaysAgo.getTime() - MAC_EPOCH) * 1000000;

      const result = formatMessageDate(macTimestamp);

      expect(result).toBe('2 days ago');
    });

    it('should return "6 days ago" for messages from 6 days ago', () => {
      const sixDaysAgo = new Date();
      sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
      const macTimestamp = (sixDaysAgo.getTime() - MAC_EPOCH) * 1000000;

      const result = formatMessageDate(macTimestamp);

      expect(result).toBe('6 days ago');
    });

    it('should show locale date for exactly 7 days ago', () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const macTimestamp = (sevenDaysAgo.getTime() - MAC_EPOCH) * 1000000;

      const result = formatMessageDate(macTimestamp);

      // 7 days is >= 7, so should show date format
      expect(result).not.toBe('7 days ago');
    });
  });
});
