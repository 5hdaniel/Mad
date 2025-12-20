import { isGmailSpam, isGmailPromotional } from '../spamFilterService';

describe('spamFilterService', () => {
  describe('isGmailSpam', () => {
    it('should detect SPAM label', () => {
      const result = isGmailSpam(['INBOX', 'SPAM']);
      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('SPAM');
    });

    it('should detect TRASH label', () => {
      const result = isGmailSpam(['TRASH']);
      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('TRASH');
    });

    it('should pass normal emails', () => {
      const result = isGmailSpam(['INBOX', 'IMPORTANT']);
      expect(result.isSpam).toBe(false);
    });

    it('should handle empty labels', () => {
      const result = isGmailSpam([]);
      expect(result.isSpam).toBe(false);
    });

    it('should return labels in result', () => {
      const labels = ['INBOX', 'CATEGORY_PRIMARY'];
      const result = isGmailSpam(labels);
      expect(result.labels).toEqual(labels);
    });
  });

  describe('isGmailPromotional', () => {
    it('should detect CATEGORY_PROMOTIONS', () => {
      const result = isGmailPromotional(['CATEGORY_PROMOTIONS']);
      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('CATEGORY_PROMOTIONS');
    });

    it('should detect CATEGORY_SOCIAL', () => {
      const result = isGmailPromotional(['INBOX', 'CATEGORY_SOCIAL']);
      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('CATEGORY_SOCIAL');
    });

    it('should pass primary emails', () => {
      const result = isGmailPromotional(['INBOX', 'CATEGORY_PRIMARY']);
      expect(result.isSpam).toBe(false);
    });

    it('should pass emails without category labels', () => {
      const result = isGmailPromotional(['INBOX', 'IMPORTANT']);
      expect(result.isSpam).toBe(false);
    });
  });
});
