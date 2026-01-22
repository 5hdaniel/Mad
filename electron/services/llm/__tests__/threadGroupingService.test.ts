import {
  groupEmailsByThread,
  getFirstEmailsFromThreads,
  getEmailsToPropagate,
  findThreadByEmailId,
} from '../threadGroupingService';
import type { Message } from '../../../types';

// Helper to create test messages
function createMessage(overrides: Partial<Message>): Message {
  return {
    id: 'test-id',
    account_id: 'account-1',
    provider: 'gmail',
    message_type: 'email',
    subject: 'Test Subject',
    body_plain: 'Test body',
    body_html: null,
    sender: 'sender@example.com',
    recipients: ['recipient@example.com'],
    labels: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as Message;
}

describe('threadGroupingService', () => {
  describe('groupEmailsByThread', () => {
    it('should group emails by thread_id', () => {
      const emails = [
        createMessage({ id: '1', thread_id: 'T1', sent_at: '2024-01-01' }),
        createMessage({ id: '2', thread_id: 'T1', sent_at: '2024-01-02' }),
        createMessage({ id: '3', thread_id: 'T2', sent_at: '2024-01-01' }),
      ];

      const result = groupEmailsByThread(emails);

      expect(result.threads.size).toBe(2);
      expect(result.stats.totalThreads).toBe(2);
      expect(result.stats.totalEmails).toBe(3);
    });

    it('should identify first email by date', () => {
      const emails = [
        createMessage({ id: '2', thread_id: 'T1', sent_at: '2024-01-02' }),
        createMessage({ id: '1', thread_id: 'T1', sent_at: '2024-01-01' }), // Earlier
      ];

      const result = groupEmailsByThread(emails);
      const thread = result.threads.get('T1')!;

      expect(thread.firstEmail.id).toBe('1');
    });

    it('should handle orphan emails (no thread_id)', () => {
      const emails = [
        createMessage({ id: '1', thread_id: 'T1' }),
        createMessage({ id: '2', thread_id: undefined }), // Orphan
      ];

      const result = groupEmailsByThread(emails);

      expect(result.orphanEmails.length).toBe(1);
      expect(result.orphanEmails[0].id).toBe('2');
      expect(result.stats.orphanCount).toBe(1);
    });

    it('should calculate average emails per thread', () => {
      const emails = [
        createMessage({ id: '1', thread_id: 'T1' }),
        createMessage({ id: '2', thread_id: 'T1' }),
        createMessage({ id: '3', thread_id: 'T1' }),
        createMessage({ id: '4', thread_id: 'T2' }),
      ];

      const result = groupEmailsByThread(emails);

      expect(result.stats.avgEmailsPerThread).toBe(2); // 4 emails / 2 threads
    });

    it('should handle empty emails array', () => {
      const result = groupEmailsByThread([]);

      expect(result.threads.size).toBe(0);
      expect(result.orphanEmails.length).toBe(0);
      expect(result.stats.totalEmails).toBe(0);
      expect(result.stats.avgEmailsPerThread).toBe(0);
    });

    it('should use received_at when sent_at is missing', () => {
      const emails = [
        createMessage({
          id: '2',
          thread_id: 'T1',
          sent_at: undefined,
          received_at: '2024-01-02',
        }),
        createMessage({
          id: '1',
          thread_id: 'T1',
          sent_at: undefined,
          received_at: '2024-01-01',
        }),
      ];

      const result = groupEmailsByThread(emails);
      const thread = result.threads.get('T1')!;

      expect(thread.firstEmail.id).toBe('1');
    });
  });

  describe('getFirstEmailsFromThreads', () => {
    it('should return first emails plus orphans', () => {
      const result = groupEmailsByThread([
        createMessage({ id: '1', thread_id: 'T1', sent_at: '2024-01-01' }),
        createMessage({ id: '2', thread_id: 'T1', sent_at: '2024-01-02' }),
        createMessage({ id: '3', thread_id: undefined }), // Orphan
      ]);

      const firstEmails = getFirstEmailsFromThreads(result);

      expect(firstEmails.length).toBe(2); // 1 first email + 1 orphan
      expect(firstEmails.map((e) => e.id).sort()).toEqual(['1', '3']);
    });

    it('should return empty array for empty input', () => {
      const result = groupEmailsByThread([]);
      const firstEmails = getFirstEmailsFromThreads(result);

      expect(firstEmails.length).toBe(0);
    });

    it('should only return orphans when no threads', () => {
      const result = groupEmailsByThread([
        createMessage({ id: '1', thread_id: undefined }),
        createMessage({ id: '2', thread_id: undefined }),
      ]);

      const firstEmails = getFirstEmailsFromThreads(result);

      expect(firstEmails.length).toBe(2);
    });
  });

  // TASK-506: Propagation helper tests
  describe('getEmailsToPropagate', () => {
    it('should return all emails except first in thread', () => {
      const result = groupEmailsByThread([
        createMessage({ id: '1', thread_id: 'T1', sent_at: '2024-01-01' }), // First
        createMessage({ id: '2', thread_id: 'T1', sent_at: '2024-01-02' }),
        createMessage({ id: '3', thread_id: 'T1', sent_at: '2024-01-03' }),
      ]);

      const toPropagate = getEmailsToPropagate(result, 'T1');

      expect(toPropagate.length).toBe(2);
      expect(toPropagate).toContain('2');
      expect(toPropagate).toContain('3');
      expect(toPropagate).not.toContain('1'); // First email excluded
    });

    it('should return empty array for unknown thread', () => {
      const result = groupEmailsByThread([
        createMessage({ id: '1', thread_id: 'T1' }),
      ]);

      const toPropagate = getEmailsToPropagate(result, 'T999');

      expect(toPropagate).toEqual([]);
    });

    it('should return empty array for single-email thread', () => {
      const result = groupEmailsByThread([
        createMessage({ id: '1', thread_id: 'T1' }),
      ]);

      const toPropagate = getEmailsToPropagate(result, 'T1');

      expect(toPropagate).toEqual([]);
    });
  });

  describe('findThreadByEmailId', () => {
    it('should find thread containing email', () => {
      const result = groupEmailsByThread([
        createMessage({ id: '1', thread_id: 'T1' }),
        createMessage({ id: '2', thread_id: 'T1' }),
        createMessage({ id: '3', thread_id: 'T2' }),
      ]);

      expect(findThreadByEmailId(result, '1')).toBe('T1');
      expect(findThreadByEmailId(result, '2')).toBe('T1');
      expect(findThreadByEmailId(result, '3')).toBe('T2');
    });

    it('should return undefined for unknown email', () => {
      const result = groupEmailsByThread([
        createMessage({ id: '1', thread_id: 'T1' }),
      ]);

      expect(findThreadByEmailId(result, 'unknown')).toBeUndefined();
    });

    it('should return undefined for orphan email', () => {
      const result = groupEmailsByThread([
        createMessage({ id: '1', thread_id: undefined }),
      ]);

      expect(findThreadByEmailId(result, '1')).toBeUndefined();
    });
  });
});
