/**
 * Mock Email and Message Providers
 *
 * Mock implementations of Gmail, Outlook, and iOS backup providers
 * for integration testing. These simulate the behavior of real providers
 * without making network calls.
 */

import type { FakeEmail } from '../../electron/services/__tests__/fixtures/fake-mailbox/types';
import type {
  FakeMessage,
  FakeContact,
  FakeHandle,
  FakeChat,
} from '../../electron/services/__tests__/fixtures/fake-ios-backup/types';
import type {
  MockEmailProviderConfig,
  MockMessageProviderConfig,
  ProcessableEmail,
  ProcessableMessage,
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
 * Convert a FakeMessage to ProcessableMessage format
 * This simulates what the iOS backup parser would return
 */
export function fakeMessageToProcessable(
  message: FakeMessage,
  handles: FakeHandle[],
  contacts: FakeContact[]
): ProcessableMessage {
  // Find the handle for this message
  const handle = handles.find((h) => h.id === message.handleId);
  const senderIdentifier = handle?.identifier ?? 'unknown';

  // Try to find a contact for this handle
  let senderName: string | undefined;
  if (handle) {
    const contact = contacts.find((c) =>
      c.phoneNumbers.some((p) => p.normalizedNumber === handle.identifier)
    );
    if (contact) {
      senderName = contact.displayName;
    }
  }

  // Convert Apple timestamp to Date
  const APPLE_EPOCH = 978307200000;
  const sentAt = new Date(message.date / 1_000_000 + APPLE_EPOCH);

  return {
    messageId: message.id,
    chatId: message.chatIds[0] ?? 0,
    text: message.text ?? '',
    isFromMe: message.isFromMe,
    senderIdentifier,
    senderName,
    sentAt,
    service: message.service,
    hasAttachments: message.attachmentIds.length > 0,
    channel: 'sms',
  };
}

/**
 * Mock iOS Backup Provider
 *
 * Simulates iOS backup/iMessage behavior for testing message sync pipelines.
 * Uses TASK-801 fixtures for realistic test data.
 */
export class MockiOSBackupProvider {
  private messages: FakeMessage[] = [];
  private contacts: FakeContact[] = [];
  private handles: FakeHandle[] = [];
  private chats: FakeChat[] = [];
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
   */
  loadMessages(messages: FakeMessage[]): void {
    this.messages = messages;
  }

  /**
   * Load handles into the mock provider
   */
  loadHandles(handles: FakeHandle[]): void {
    this.handles = handles;
  }

  /**
   * Load chats into the mock provider
   */
  loadChats(chats: FakeChat[]): void {
    this.chats = chats;
  }

  /**
   * Load contacts into the mock provider
   */
  loadContacts(contacts: FakeContact[]): void {
    this.contacts = contacts;
  }

  /**
   * Load all fixture data at once
   */
  loadFixtures(data: {
    messages: FakeMessage[];
    handles: FakeHandle[];
    chats: FakeChat[];
    contacts: FakeContact[];
  }): void {
    this.messages = data.messages;
    this.handles = data.handles;
    this.chats = data.chats;
    this.contacts = data.contacts;
  }

  /**
   * Simulate fetching messages from iOS backup
   */
  async fetchMessages(options?: {
    limit?: number;
    chatId?: number;
    service?: 'iMessage' | 'SMS';
  }): Promise<{ messages: ProcessableMessage[]; count: number }> {
    await simulateLatency(this.config.latencyMs);

    if (shouldSimulateError(this.config.simulateErrors, this.config.errorRate)) {
      throw new Error('Simulated iOS backup read error');
    }

    let filteredMessages = [...this.messages];

    // Apply filters
    if (options?.chatId !== undefined) {
      filteredMessages = filteredMessages.filter((m) =>
        m.chatIds.includes(options.chatId!)
      );
    }

    if (options?.service) {
      filteredMessages = filteredMessages.filter((m) => m.service === options.service);
    }

    if (options?.limit && options.limit > 0) {
      filteredMessages = filteredMessages.slice(0, options.limit);
    }

    const processableMessages = filteredMessages.map((m) =>
      fakeMessageToProcessable(m, this.handles, this.contacts)
    );

    return {
      messages: processableMessages,
      count: processableMessages.length,
    };
  }

  /**
   * Simulate fetching contacts from iOS backup
   */
  async fetchContacts(): Promise<{ contacts: FakeContact[]; count: number }> {
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

  /**
   * Get loaded handle count
   */
  getHandleCount(): number {
    return this.handles.length;
  }

  /**
   * Get loaded chat count
   */
  getChatCount(): number {
    return this.chats.length;
  }

  /**
   * Get all loaded messages (raw fixture data)
   */
  getAllMessages(): FakeMessage[] {
    return [...this.messages];
  }

  /**
   * Get all loaded contacts
   */
  getAllContacts(): FakeContact[] {
    return [...this.contacts];
  }

  /**
   * Get all loaded handles
   */
  getAllHandles(): FakeHandle[] {
    return [...this.handles];
  }

  /**
   * Get all loaded chats
   */
  getAllChats(): FakeChat[] {
    return [...this.chats];
  }

  /**
   * Get transaction-related messages
   */
  getTransactionMessages(): FakeMessage[] {
    return this.messages.filter((m) => m.expected.isTransactionRelated);
  }

  /**
   * Get messages by category
   */
  getMessagesByCategory(category: FakeMessage['category']): FakeMessage[] {
    return this.messages.filter((m) => m.category === category);
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
