# TASK-004: Messages Database Parser

## Task Info
- **Task ID:** TASK-004
- **Phase:** 2 - Core Services
- **Dependencies:** None (works on backup files, not live device)
- **Can Start:** Immediately
- **Estimated Effort:** 4-5 days

## Goal

Create a parser that reads the iOS Messages database (sms.db) from an iTunes-style backup and extracts conversations and messages.

## Background

iOS stores messages in a SQLite database called `sms.db`. When we create a backup via libimobiledevice, this database is stored with a hashed filename. This service parses that database and returns structured message data.

## Deliverables

1. Messages parser service that reads sms.db from backup
2. TypeScript types for iOS messages
3. Conversation grouping logic
4. Attachment reference extraction

## Technical Requirements

### 1. Create Message Types

Create `electron/types/iosMessages.ts`:

```typescript
export interface iOSMessage {
  id: number;
  guid: string;
  text: string | null;
  handle: string;           // Phone number or email
  isFromMe: boolean;
  date: Date;
  dateRead: Date | null;
  dateDelivered: Date | null;
  service: 'iMessage' | 'SMS';
  attachments: iOSAttachment[];
}

export interface iOSAttachment {
  id: number;
  guid: string;
  filename: string;
  mimeType: string;
  transferName: string;
}

export interface iOSConversation {
  chatId: number;
  chatIdentifier: string;   // Group name or contact
  participants: string[];
  messages: iOSMessage[];
  lastMessage: Date;
  isGroupChat: boolean;
}
```

### 2. Create Messages Parser Service

Create `electron/services/iosMessagesParser.ts`:

```typescript
import Database from 'better-sqlite3';
import path from 'path';
import log from 'electron-log';

export class iOSMessagesParser {
  private db: Database.Database | null = null;

  // The sms.db hash in iOS backups
  static readonly SMS_DB_HASH = '3d0d7e5fb2ce288813306e4d4636395e047a3d28';

  open(backupPath: string): void {
    const dbPath = path.join(backupPath, this.SMS_DB_HASH);
    this.db = new Database(dbPath, { readonly: true });
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  getConversations(): iOSConversation[] {
    // Query chat table joined with chat_handle_join
    // Group messages by chat_id
  }

  getMessages(chatId: number, limit?: number, offset?: number): iOSMessage[] {
    // Query message table with handle join
    // Convert iOS timestamps (nanoseconds since 2001-01-01)
  }

  getAttachments(messageId: number): iOSAttachment[] {
    // Query attachment table via message_attachment_join
  }

  searchMessages(query: string): iOSMessage[] {
    // Full-text search on message text
  }
}
```

### 3. iOS Timestamp Conversion

iOS uses "Apple Cocoa Core Data timestamp" - nanoseconds since 2001-01-01:

```typescript
function convertAppleTimestamp(timestamp: number): Date {
  // Apple epoch is 2001-01-01 00:00:00 UTC
  const APPLE_EPOCH = 978307200000; // in milliseconds

  // iOS stores in nanoseconds, need to convert to milliseconds
  const milliseconds = timestamp / 1000000;

  return new Date(APPLE_EPOCH + milliseconds);
}
```

### 4. Database Schema Reference

Key tables in sms.db:
- `message` - Individual messages
- `handle` - Contact identifiers (phone/email)
- `chat` - Conversations
- `chat_handle_join` - Links chats to handles
- `chat_message_join` - Links chats to messages
- `attachment` - Media attachments
- `message_attachment_join` - Links messages to attachments

## Files to Create

- `electron/types/iosMessages.ts`
- `electron/services/iosMessagesParser.ts`
- `electron/services/__tests__/iosMessagesParser.test.ts`

## Files to Modify

- None (this is a standalone service)

## Dos

- ✅ Open database in readonly mode
- ✅ Handle empty/missing database gracefully
- ✅ Convert all timestamps to JavaScript Date objects
- ✅ Handle NULL values in messages (deleted messages)
- ✅ Support pagination for large conversations
- ✅ Log parsing errors but don't crash

## Don'ts

- ❌ Don't modify the database (readonly)
- ❌ Don't load all messages into memory at once
- ❌ Don't assume all fields are present (schema varies by iOS version)
- ❌ Don't include actual message content in logs

## Testing Instructions

1. Create test fixtures with sample sms.db structure
2. Test with empty database
3. Test with single conversation
4. Test with group chats
5. Test timestamp conversion accuracy

## Sample Test Fixture

Create `electron/services/__tests__/fixtures/sample-sms.db` with:
- 2-3 conversations
- Mix of SMS and iMessage
- At least one group chat
- Messages with attachments

## PR Preparation Checklist

Before completing, ensure:

- [ ] No console.log statements added for debugging
- [ ] Error logging uses electron-log
- [ ] Type check passes: `npm run type-check`
- [ ] Lint check passes: `npm run lint`
- [ ] Tests added with good coverage
- [ ] Merged latest from main branch
- [ ] Created pull request with summary

## Work Summary

> **Instructions:** Update this section when your work is complete.

### Branch Name
```
[FILL IN YOUR BRANCH NAME HERE]
```

### Changes Made
```
[LIST THE FILES YOU MODIFIED AND WHAT YOU CHANGED]
```

### Testing Done
```
[DESCRIBE WHAT TESTING YOU PERFORMED]
```

### Notes/Issues Encountered
```
[ANY ISSUES OR NOTES FOR THE REVIEWER]
```

### PR Link
```
[LINK TO YOUR PULL REQUEST]
```
