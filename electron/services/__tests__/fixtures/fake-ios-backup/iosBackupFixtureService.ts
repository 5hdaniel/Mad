/**
 * iOS Backup Fixture Service
 * Utilities for loading, filtering, and working with fake iOS backup fixtures
 */

import messagesData from './messages.json';
import contactsData from './contacts.json';
import type {
  FakeMessage,
  FakeHandle,
  FakeChat,
  FakeAttachment,
  FakeContact,
  MessageFixtureData,
  ContactFixtureData,
  MessageFixtureFilter,
  ContactFixtureFilter,
  MessageFixtureStats,
  ContactFixtureStats,
  MessageCategory,
  MessageService,
  DifficultyLevel,
} from './types';

// Type assertions for imported JSON
const messageFixtureData = messagesData as MessageFixtureData;
const contactFixtureData = contactsData as ContactFixtureData;

// ============================================================================
// Message Fixture Functions
// ============================================================================

/**
 * Get all messages from the fixture
 */
export function getAllMessages(): FakeMessage[] {
  return messageFixtureData.messages;
}

/**
 * Get all handles from the fixture
 */
export function getAllHandles(): FakeHandle[] {
  return messageFixtureData.handles;
}

/**
 * Get all chats from the fixture
 */
export function getAllChats(): FakeChat[] {
  return messageFixtureData.chats;
}

/**
 * Get all attachments from the fixture
 */
export function getAllAttachments(): FakeAttachment[] {
  return messageFixtureData.attachments;
}

/**
 * Get message fixture metadata
 */
export function getMessageMetadata(): MessageFixtureData['metadata'] {
  return messageFixtureData.metadata;
}

/**
 * Filter messages based on criteria
 */
export function filterMessages(filter: MessageFixtureFilter): FakeMessage[] {
  let result = [...messageFixtureData.messages];

  if (filter.service) {
    result = result.filter((m) => m.service === filter.service);
  }

  if (filter.category) {
    result = result.filter((m) => m.category === filter.category);
  }

  if (filter.difficulty) {
    result = result.filter((m) => m.difficulty === filter.difficulty);
  }

  if (filter.chatId !== undefined) {
    result = result.filter((m) => m.chatIds.includes(filter.chatId!));
  }

  if (filter.handleId !== undefined) {
    result = result.filter((m) => m.handleId === filter.handleId);
  }

  if (filter.isTransactionRelated !== undefined) {
    result = result.filter(
      (m) => m.expected.isTransactionRelated === filter.isTransactionRelated
    );
  }

  if (filter.isFromMe !== undefined) {
    result = result.filter((m) => m.isFromMe === filter.isFromMe);
  }

  if (filter.limit && filter.limit > 0) {
    result = result.slice(0, filter.limit);
  }

  return result;
}

/**
 * Get messages by category
 */
export function getMessagesByCategory(category: MessageCategory): FakeMessage[] {
  return filterMessages({ category });
}

/**
 * Get messages by service type (iMessage or SMS)
 */
export function getMessagesByService(service: MessageService): FakeMessage[] {
  return filterMessages({ service });
}

/**
 * Get messages by difficulty level
 */
export function getMessagesByDifficulty(difficulty: DifficultyLevel): FakeMessage[] {
  return filterMessages({ difficulty });
}

/**
 * Get messages for a specific chat
 */
export function getMessagesForChat(chatId: number): FakeMessage[] {
  return filterMessages({ chatId });
}

/**
 * Get messages from a specific handle
 */
export function getMessagesFromHandle(handleId: number): FakeMessage[] {
  return filterMessages({ handleId });
}

/**
 * Get transaction-related messages only
 */
export function getTransactionMessages(): FakeMessage[] {
  return filterMessages({ isTransactionRelated: true });
}

/**
 * Get non-transaction messages
 */
export function getNormalMessages(): FakeMessage[] {
  return messageFixtureData.messages.filter(
    (m) => m.category === 'normal' || !m.expected.isTransactionRelated
  );
}

/**
 * Get spam messages only
 */
export function getSpamMessages(): FakeMessage[] {
  return filterMessages({ category: 'spam' });
}

/**
 * Get edge case messages for testing
 */
export function getEdgeCaseMessages(): FakeMessage[] {
  return filterMessages({ category: 'edge_case' });
}

/**
 * Get messages sent by the device owner
 */
export function getOutgoingMessages(): FakeMessage[] {
  return filterMessages({ isFromMe: true });
}

/**
 * Get messages received from others
 */
export function getIncomingMessages(): FakeMessage[] {
  return filterMessages({ isFromMe: false });
}

/**
 * Get a message by ID
 */
export function getMessageById(id: number): FakeMessage | undefined {
  return messageFixtureData.messages.find((m) => m.id === id);
}

/**
 * Get a chat by ID
 */
export function getChatById(id: number): FakeChat | undefined {
  return messageFixtureData.chats.find((c) => c.id === id);
}

/**
 * Get a handle by ID
 */
export function getHandleById(id: number): FakeHandle | undefined {
  return messageFixtureData.handles.find((h) => h.id === id);
}

/**
 * Get a handle by identifier (phone or email)
 */
export function getHandleByIdentifier(identifier: string): FakeHandle | undefined {
  return messageFixtureData.handles.find((h) => h.identifier === identifier);
}

/**
 * Get group chats only
 */
export function getGroupChats(): FakeChat[] {
  return messageFixtureData.chats.filter((c) => c.chatType === 'group');
}

/**
 * Get individual chats only
 */
export function getIndividualChats(): FakeChat[] {
  return messageFixtureData.chats.filter((c) => c.chatType === 'individual');
}

/**
 * Get attachments for a message
 */
export function getAttachmentsForMessage(messageId: number): FakeAttachment[] {
  const message = getMessageById(messageId);
  if (!message || message.attachmentIds.length === 0) {
    return [];
  }
  return messageFixtureData.attachments.filter((a) =>
    message.attachmentIds.includes(a.id)
  );
}

/**
 * Get a random sample of messages
 */
export function getRandomMessageSample(count: number): FakeMessage[] {
  const shuffled = [...messageFixtureData.messages].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get message fixture statistics
 */
export function getMessageStats(): MessageFixtureStats {
  const messages = messageFixtureData.messages;
  const chats = messageFixtureData.chats;

  const byCategory: Record<MessageCategory, number> = {
    transaction: 0,
    normal: 0,
    spam: 0,
    edge_case: 0,
  };

  const byService: Record<MessageService, number> = {
    iMessage: 0,
    SMS: 0,
  };

  const byDifficulty: Record<DifficultyLevel, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
  };

  for (const message of messages) {
    byCategory[message.category]++;
    byService[message.service]++;
    byDifficulty[message.difficulty]++;
  }

  return {
    total: messages.length,
    byCategory,
    byService,
    byDifficulty,
    conversations: chats.length,
    groupConversations: chats.filter((c) => c.chatType === 'group').length,
  };
}

// ============================================================================
// Contact Fixture Functions
// ============================================================================

/**
 * Get all contacts from the fixture
 */
export function getAllContacts(): FakeContact[] {
  return contactFixtureData.contacts;
}

/**
 * Get contact fixture metadata
 */
export function getContactMetadata(): ContactFixtureData['metadata'] {
  return contactFixtureData.metadata;
}

/**
 * Filter contacts based on criteria
 */
export function filterContacts(filter: ContactFixtureFilter): FakeContact[] {
  let result = [...contactFixtureData.contacts];

  if (filter.role) {
    result = result.filter((c) => c.role === filter.role);
  }

  if (filter.hasPhone !== undefined) {
    result = result.filter((c) =>
      filter.hasPhone ? c.phoneNumbers.length > 0 : c.phoneNumbers.length === 0
    );
  }

  if (filter.hasEmail !== undefined) {
    result = result.filter((c) =>
      filter.hasEmail ? c.emails.length > 0 : c.emails.length === 0
    );
  }

  if (filter.limit && filter.limit > 0) {
    result = result.slice(0, filter.limit);
  }

  return result;
}

/**
 * Get contacts by role
 */
export function getContactsByRole(role: FakeContact['role']): FakeContact[] {
  return filterContacts({ role });
}

/**
 * Get contacts with phone numbers
 */
export function getContactsWithPhones(): FakeContact[] {
  return filterContacts({ hasPhone: true });
}

/**
 * Get contacts with email addresses
 */
export function getContactsWithEmails(): FakeContact[] {
  return filterContacts({ hasEmail: true });
}

/**
 * Get a contact by ID
 */
export function getContactById(id: number): FakeContact | undefined {
  return contactFixtureData.contacts.find((c) => c.id === id);
}

/**
 * Get a contact by phone number (normalized)
 */
export function getContactByPhone(normalizedPhone: string): FakeContact | undefined {
  return contactFixtureData.contacts.find((c) =>
    c.phoneNumbers.some((p) => p.normalizedNumber === normalizedPhone)
  );
}

/**
 * Get a contact by email
 */
export function getContactByEmail(email: string): FakeContact | undefined {
  const lowerEmail = email.toLowerCase();
  return contactFixtureData.contacts.find((c) =>
    c.emails.some((e) => e.email.toLowerCase() === lowerEmail)
  );
}

/**
 * Get real estate professional contacts (agents, lenders, title, inspectors, attorneys)
 */
export function getRealEstateProfessionals(): FakeContact[] {
  const professionalRoles: Array<FakeContact['role']> = [
    'agent',
    'lender',
    'title',
    'inspector',
    'attorney',
  ];
  return contactFixtureData.contacts.filter(
    (c) => c.role && professionalRoles.includes(c.role)
  );
}

/**
 * Get contact fixture statistics
 */
export function getContactStats(): ContactFixtureStats {
  const contacts = contactFixtureData.contacts;

  const byRole: Record<NonNullable<FakeContact['role']> | 'none', number> = {
    agent: 0,
    buyer: 0,
    seller: 0,
    lender: 0,
    title: 0,
    inspector: 0,
    attorney: 0,
    other: 0,
    none: 0,
  };

  let withPhones = 0;
  let withEmails = 0;

  for (const contact of contacts) {
    if (contact.role) {
      byRole[contact.role]++;
    } else {
      byRole.none++;
    }

    if (contact.phoneNumbers.length > 0) {
      withPhones++;
    }

    if (contact.emails.length > 0) {
      withEmails++;
    }
  }

  return {
    total: contacts.length,
    byRole,
    withPhones,
    withEmails,
  };
}

// ============================================================================
// Cross-Reference Functions
// ============================================================================

/**
 * Get the contact associated with a handle (if any)
 */
export function getContactForHandle(handleId: number): FakeContact | undefined {
  const handle = getHandleById(handleId);
  if (!handle) return undefined;

  // Try to find contact by phone number
  return getContactByPhone(handle.identifier);
}

/**
 * Get the handle associated with a contact's phone (if any)
 */
export function getHandleForContact(contactId: number): FakeHandle | undefined {
  const contact = getContactById(contactId);
  if (!contact || contact.phoneNumbers.length === 0) return undefined;

  // Try to find handle by any of the contact's phone numbers
  for (const phone of contact.phoneNumbers) {
    const handle = getHandleByIdentifier(phone.normalizedNumber);
    if (handle) return handle;
  }

  return undefined;
}

// ============================================================================
// Apple Timestamp Utilities
// ============================================================================

/**
 * Apple epoch constant: milliseconds since Unix epoch for 2001-01-01 00:00:00 UTC
 */
export { APPLE_EPOCH_MS } from './types';

/**
 * Convert a JavaScript Date to Apple timestamp (nanoseconds since 2001-01-01)
 */
export function toAppleTimestamp(date: Date): number {
  const APPLE_EPOCH = 978307200000;
  return (date.getTime() - APPLE_EPOCH) * 1_000_000;
}

/**
 * Convert an Apple timestamp to JavaScript Date
 */
export function fromAppleTimestamp(timestamp: number): Date {
  const APPLE_EPOCH = 978307200000;
  return new Date(timestamp / 1_000_000 + APPLE_EPOCH);
}
