/**
 * Mock Email and Message Providers
 *
 * Mock implementations of Gmail, Outlook, and iOS backup providers
 * for integration testing. These simulate the behavior of real providers
 * without making network calls.
 */

import type { FakeEmail } from '../../electron/services/__tests__/fixtures/fake-mailbox/types';
import type {
  MockEmailProviderConfig,
  MockMessageProviderConfig,
  ProcessableEmail,
  SyncResult,
} from './types';

/**
 * Simulates network latency if configured
 */
async function simulateLatency(latencyMs?: number): Promise<void> {
  if (latencyMs && latencyMs > 0) {
    return new Promise((resolve) => setTimeout(resolve, latencyMs));
  }
}

/**
 * Simulates an error based on error rate
 */
function shouldSimulateError(simulateErrors?: boolean, errorRate?: number): boolean {
  if (!simulateErrors) return false;
  const rate = errorRate ?? 0.1; // Default 10% error rate
  return Math.random() < rate;
}

/**
 * Converts a FakeEmail to ProcessableEmail format
 * This simulates what the fetch services would return
 */
export function fakeEmailToProcessable(email: FakeEmail): ProcessableEmail {
  return {
    externalId: email.id,
    threadId: email.thread_id,
    subject: email.subject,
    bodyText: email.body,
    bodyHtml: email.bodyHtml,
    from: email.sender,
    to: email.recipients,
    cc: email.cc,
    bcc: email.bcc,
    labels: email.labels,
    sentAt: new Date(email.sent_at),
    hasAttachments: email.hasAttachments,
    attachmentCount: email.attachmentCount,
    channel: 'email',
  };
}

/**
 * Mock Gmail Provider
 *
 * Simulates Gmail API behavior for testing email sync pipelines.
 */
export class MockGmailProvider {
  private emails: FakeEmail[] = [];
  private config: MockEmailProviderConfig;

  constructor(config: Partial<MockEmailProviderConfig> = {}) {
    this.config = {
      type: 'gmail',
      latencyMs: config.latencyMs ?? 0,
      simulateErrors: config.simulateErrors ?? false,
      errorRate: config.errorRate ?? 0.1,
    };
  }

  /**
   * Load emails into the mock provider
   */
  loadEmails(emails: FakeEmail[]): void {
    // Only load Gmail provider emails
    this.emails = emails.filter((e) => e.provider === 'gmail');
  }

  /**
   * Simulate fetching emails from Gmail
   */
  async fetchEmails(options?: {
    maxResults?: number;
    pageToken?: string;
    query?: string;
  }): Promise<{ emails: ProcessableEmail[]; nextPageToken?: string }> {
    await simulateLatency(this.config.latencyMs);

    if (shouldSimulateError(this.config.simulateErrors, this.config.errorRate)) {
      throw new Error('Simulated Gmail API error: Rate limit exceeded');
    }

    const maxResults = options?.maxResults ?? 100;
    const startIndex = options?.pageToken ? parseInt(options.pageToken, 10) : 0;

    let filteredEmails = [...this.emails];

    // Simple query filtering (simulates Gmail search)
    if (options?.query) {
      const query = options.query.toLowerCase();
      filteredEmails = filteredEmails.filter(
        (e) =>
          e.subject.toLowerCase().includes(query) ||
          e.body.toLowerCase().includes(query) ||
          e.sender.toLowerCase().includes(query)
      );
    }

    const pageEmails = filteredEmails.slice(startIndex, startIndex + maxResults);
    const hasMore = startIndex + maxResults < filteredEmails.length;

    return {
      emails: pageEmails.map(fakeEmailToProcessable),
      nextPageToken: hasMore ? String(startIndex + maxResults) : undefined,
    };
  }

  /**
   * Simulate syncing all emails
   */
  async syncAll(): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      await simulateLatency(this.config.latencyMs);

      if (shouldSimulateError(this.config.simulateErrors, this.config.errorRate)) {
        throw new Error('Simulated Gmail sync error');
      }

      return {
        success: true,
        itemCount: this.emails.length,
        errorCount: 0,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        itemCount: 0,
        errorCount: 1,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Get loaded email count
   */
  getEmailCount(): number {
    return this.emails.length;
  }

  /**
   * Get emails by label
   */
  getEmailsByLabel(label: string): FakeEmail[] {
    return this.emails.filter((e) => e.labels.includes(label));
  }

  /**
   * Get all loaded emails
   */
  getAllEmails(): FakeEmail[] {
    return [...this.emails];
  }
}

/**
 * Mock Outlook Provider
 *
 * Simulates Microsoft Graph API behavior for testing email sync pipelines.
 */
export class MockOutlookProvider {
  private emails: FakeEmail[] = [];
  private config: MockEmailProviderConfig;

  constructor(config: Partial<MockEmailProviderConfig> = {}) {
    this.config = {
      type: 'outlook',
      latencyMs: config.latencyMs ?? 0,
      simulateErrors: config.simulateErrors ?? false,
      errorRate: config.errorRate ?? 0.1,
    };
  }

  /**
   * Load emails into the mock provider
   */
  loadEmails(emails: FakeEmail[]): void {
    // Only load Outlook provider emails
    this.emails = emails.filter((e) => e.provider === 'outlook');
  }

  /**
   * Simulate fetching emails from Outlook/Graph API
   */
  async fetchEmails(options?: {
    top?: number;
    skip?: number;
    filter?: string;
  }): Promise<{ emails: ProcessableEmail[]; hasMore: boolean }> {
    await simulateLatency(this.config.latencyMs);

    if (shouldSimulateError(this.config.simulateErrors, this.config.errorRate)) {
      throw new Error('Simulated Graph API error: Authentication failed');
    }

    const top = options?.top ?? 50;
    const skip = options?.skip ?? 0;

    let filteredEmails = [...this.emails];

    // Simple OData-style filter (simulates Graph API filtering)
    if (options?.filter) {
      const filter = options.filter.toLowerCase();
      filteredEmails = filteredEmails.filter(
        (e) =>
          e.subject.toLowerCase().includes(filter) || e.body.toLowerCase().includes(filter)
      );
    }

    const pageEmails = filteredEmails.slice(skip, skip + top);
    const hasMore = skip + top < filteredEmails.length;

    return {
      emails: pageEmails.map(fakeEmailToProcessable),
      hasMore,
    };
  }

  /**
   * Simulate syncing all emails
   */
  async syncAll(): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      await simulateLatency(this.config.latencyMs);

      if (shouldSimulateError(this.config.simulateErrors, this.config.errorRate)) {
        throw new Error('Simulated Outlook sync error');
      }

      return {
        success: true,
        itemCount: this.emails.length,
        errorCount: 0,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        itemCount: 0,
        errorCount: 1,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Get loaded email count
   */
  getEmailCount(): number {
    return this.emails.length;
  }

  /**
   * Get all loaded emails
   */
  getAllEmails(): FakeEmail[] {
    return [...this.emails];
  }
}

/**
 * Mock iOS Backup Provider
 *
 * Simulates iOS backup/iMessage behavior for testing message sync pipelines.
 * Note: TASK-801 fixtures are not yet available, so this provides the interface
 * for future integration.
 */
export class MockiOSBackupProvider {
  private messages: unknown[] = []; // Will use SMS fixture types from TASK-801
  private contacts: unknown[] = [];
  private config: MockMessageProviderConfig;

  constructor(config: Partial<MockMessageProviderConfig> = {}) {
    this.config = {
      type: 'imessage',
      latencyMs: config.latencyMs ?? 0,
      simulateErrors: config.simulateErrors ?? false,
      errorRate: config.errorRate ?? 0.1,
    };
  }

  /**
   * Load messages into the mock provider
   * Placeholder for TASK-801 integration
   */
  loadMessages(messages: unknown[]): void {
    this.messages = messages;
  }

  /**
   * Load contacts into the mock provider
   * Placeholder for TASK-801 integration
   */
  loadContacts(contacts: unknown[]): void {
    this.contacts = contacts;
  }

  /**
   * Simulate fetching messages from iOS backup
   */
  async fetchMessages(): Promise<{ messages: unknown[]; count: number }> {
    await simulateLatency(this.config.latencyMs);

    if (shouldSimulateError(this.config.simulateErrors, this.config.errorRate)) {
      throw new Error('Simulated iOS backup read error');
    }

    return {
      messages: [...this.messages],
      count: this.messages.length,
    };
  }

  /**
   * Simulate fetching contacts from iOS backup
   */
  async fetchContacts(): Promise<{ contacts: unknown[]; count: number }> {
    await simulateLatency(this.config.latencyMs);

    if (shouldSimulateError(this.config.simulateErrors, this.config.errorRate)) {
      throw new Error('Simulated iOS contacts read error');
    }

    return {
      contacts: [...this.contacts],
      count: this.contacts.length,
    };
  }

  /**
   * Simulate syncing all messages and contacts
   */
  async syncAll(): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      await simulateLatency(this.config.latencyMs);

      if (shouldSimulateError(this.config.simulateErrors, this.config.errorRate)) {
        throw new Error('Simulated iOS backup sync error');
      }

      return {
        success: true,
        itemCount: this.messages.length + this.contacts.length,
        errorCount: 0,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        itemCount: 0,
        errorCount: 1,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Get loaded message count
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Get loaded contact count
   */
  getContactCount(): number {
    return this.contacts.length;
  }
}

/**
 * Create a mock provider factory for easy provider creation
 */
export function createMockProvider(
  type: 'gmail' | 'outlook' | 'imessage',
  config?: Partial<MockEmailProviderConfig> | Partial<MockMessageProviderConfig>
): MockGmailProvider | MockOutlookProvider | MockiOSBackupProvider {
  switch (type) {
    case 'gmail':
      return new MockGmailProvider(config as Partial<MockEmailProviderConfig>);
    case 'outlook':
      return new MockOutlookProvider(config as Partial<MockEmailProviderConfig>);
    case 'imessage':
      return new MockiOSBackupProvider(config as Partial<MockMessageProviderConfig>);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}
