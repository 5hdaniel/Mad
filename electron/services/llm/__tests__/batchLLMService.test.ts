import {
  createBatches,
  estimateEmailTokens,
  formatBatchPrompt,
  DEFAULT_BATCH_CONFIG,
} from '../batchLLMService';
import type { MessageInput } from '../../extraction/types';

// Helper to create test emails
function createEmail(overrides: Partial<MessageInput> = {}): MessageInput {
  return {
    id: 'test-id',
    subject: 'Test Subject',
    body: 'Test body content',
    sender: 'sender@example.com',
    recipients: ['recipient@example.com'],
    date: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('batchLLMService', () => {
  describe('estimateEmailTokens', () => {
    it('should estimate tokens based on content length', () => {
      const email = createEmail({
        subject: 'Test', // 4 chars
        body: 'x'.repeat(300), // 300 chars
      });

      const tokens = estimateEmailTokens(email);

      // With metadata (~50 chars) and 3:1 ratio, expect ~120 tokens
      expect(tokens).toBeGreaterThan(100);
      expect(tokens).toBeLessThan(200);
    });

    it('should handle empty subject and body', () => {
      const email = createEmail({
        subject: '',
        body: '',
      });

      const tokens = estimateEmailTokens(email);

      // Should still count metadata
      expect(tokens).toBeGreaterThan(0);
    });

    it('should truncate long bodies to 2000 chars', () => {
      const shortEmail = createEmail({ body: 'x'.repeat(1000) });
      const longEmail = createEmail({ body: 'x'.repeat(10000) });

      const shortTokens = estimateEmailTokens(shortEmail);
      const longTokens = estimateEmailTokens(longEmail);

      // Long email should be truncated, so difference should be limited
      expect(longTokens - shortTokens).toBeLessThan(500);
    });
  });

  describe('createBatches', () => {
    it('should create batches within token limits', () => {
      const emails = Array(50)
        .fill(null)
        .map((_, i) =>
          createEmail({
            id: `email_${i}`,
            body: 'x'.repeat(1000), // ~333 tokens each
          })
        );

      const result = createBatches(emails, {
        maxTokensPerBatch: 5000,
        maxEmailsPerBatch: 30,
        avgTokensPerEmail: 333,
      });

      expect(result.batches.length).toBeGreaterThan(1);
      result.batches.forEach((batch) => {
        expect(batch.estimatedTokens).toBeLessThanOrEqual(5000);
      });
    });

    it('should respect max emails per batch', () => {
      const emails = Array(100)
        .fill(null)
        .map((_, i) =>
          createEmail({
            id: `email_${i}`,
            body: 'Short',
          })
        );

      const result = createBatches(emails, {
        maxTokensPerBatch: 100000,
        maxEmailsPerBatch: 30,
        avgTokensPerEmail: 10,
      });

      result.batches.forEach((batch) => {
        expect(batch.emails.length).toBeLessThanOrEqual(30);
      });
    });

    it('should handle empty email array', () => {
      const result = createBatches([]);

      expect(result.batches).toEqual([]);
      expect(result.stats.totalEmails).toBe(0);
      expect(result.stats.totalBatches).toBe(0);
      expect(result.stats.avgEmailsPerBatch).toBe(0);
      expect(result.stats.estimatedTotalTokens).toBe(0);
    });

    it('should create single batch for small email list', () => {
      const emails = Array(5)
        .fill(null)
        .map((_, i) => createEmail({ id: `email_${i}` }));

      const result = createBatches(emails);

      expect(result.batches.length).toBe(1);
      expect(result.batches[0].emails.length).toBe(5);
    });

    it('should calculate correct stats', () => {
      const emails = Array(45)
        .fill(null)
        .map((_, i) => createEmail({ id: `email_${i}` }));

      const result = createBatches(emails, {
        ...DEFAULT_BATCH_CONFIG,
        maxEmailsPerBatch: 20,
      });

      expect(result.stats.totalEmails).toBe(45);
      expect(result.stats.totalBatches).toBe(3); // 20 + 20 + 5
      expect(result.stats.avgEmailsPerBatch).toBe(15); // 45 / 3
    });

    it('should assign unique batch IDs', () => {
      const emails = Array(60)
        .fill(null)
        .map((_, i) => createEmail({ id: `email_${i}` }));

      const result = createBatches(emails, {
        ...DEFAULT_BATCH_CONFIG,
        maxEmailsPerBatch: 20,
      });

      const batchIds = result.batches.map((b) => b.batchId);
      const uniqueIds = new Set(batchIds);

      expect(uniqueIds.size).toBe(batchIds.length);
    });

    it('should preserve email order within batches', () => {
      const emails = Array(10)
        .fill(null)
        .map((_, i) => createEmail({ id: `email_${i}` }));

      const result = createBatches(emails, {
        ...DEFAULT_BATCH_CONFIG,
        maxEmailsPerBatch: 5,
      });

      expect(result.batches[0].emails.map((e) => e.id)).toEqual([
        'email_0',
        'email_1',
        'email_2',
        'email_3',
        'email_4',
      ]);
      expect(result.batches[1].emails.map((e) => e.id)).toEqual([
        'email_5',
        'email_6',
        'email_7',
        'email_8',
        'email_9',
      ]);
    });
  });

  describe('formatBatchPrompt', () => {
    it('should format batch with all email details', () => {
      const batch = {
        batchId: 'test-batch',
        emails: [
          createEmail({
            id: 'email-1',
            subject: 'Property at 123 Main St',
            sender: 'agent@realty.com',
            recipients: ['client@email.com'],
            date: '2024-01-15T10:00:00Z',
            body: 'Interested in this property?',
          }),
        ],
        estimatedTokens: 100,
      };

      const prompt = formatBatchPrompt(batch);

      expect(prompt).toContain('Analyze the following 1 emails');
      expect(prompt).toContain('EMAIL 1 (ID: email-1)');
      expect(prompt).toContain('Subject: Property at 123 Main St');
      expect(prompt).toContain('From: agent@realty.com');
      expect(prompt).toContain('To: client@email.com');
      expect(prompt).toContain('Interested in this property?');
    });

    it('should handle multiple emails in batch', () => {
      const batch = {
        batchId: 'test-batch',
        emails: [
          createEmail({ id: 'email-1', subject: 'First' }),
          createEmail({ id: 'email-2', subject: 'Second' }),
          createEmail({ id: 'email-3', subject: 'Third' }),
        ],
        estimatedTokens: 300,
      };

      const prompt = formatBatchPrompt(batch);

      expect(prompt).toContain('Analyze the following 3 emails');
      expect(prompt).toContain('EMAIL 1 (ID: email-1)');
      expect(prompt).toContain('EMAIL 2 (ID: email-2)');
      expect(prompt).toContain('EMAIL 3 (ID: email-3)');
    });

    it('should handle missing email fields gracefully', () => {
      const batch = {
        batchId: 'test-batch',
        emails: [
          createEmail({
            id: 'email-1',
            subject: '',
            sender: '',
            recipients: [],
            date: '',
            body: '',
          }),
        ],
        estimatedTokens: 50,
      };

      const prompt = formatBatchPrompt(batch);

      expect(prompt).toContain('Subject: (no subject)');
      expect(prompt).toContain('From: unknown');
      expect(prompt).toContain('To: unknown');
    });

    it('should include JSON format instructions', () => {
      const batch = {
        batchId: 'test-batch',
        emails: [createEmail({ id: 'email-1' })],
        estimatedTokens: 100,
      };

      const prompt = formatBatchPrompt(batch);

      expect(prompt).toContain('JSON array');
      expect(prompt).toContain('"isRealEstateRelated"');
      expect(prompt).toContain('"confidence"');
      expect(prompt).toContain('"transactionType"');
      expect(prompt).toContain('"propertyAddress"');
    });

    it('should truncate long bodies', () => {
      const longBody = 'x'.repeat(5000);
      const batch = {
        batchId: 'test-batch',
        emails: [createEmail({ id: 'email-1', body: longBody })],
        estimatedTokens: 700,
      };

      const prompt = formatBatchPrompt(batch);

      // Should be truncated to 2000 chars
      const bodyMatch = prompt.match(/Body:\n(x+)/);
      expect(bodyMatch).toBeTruthy();
      expect(bodyMatch![1].length).toBe(2000);
    });
  });
});
