# Integration Testing Framework

This directory contains the integration testing framework for Magic Audit. It enables end-to-end testing of sync, detection, and extraction pipelines without external dependencies.

## Overview

The integration testing framework uses fake email fixtures (from `electron/services/__tests__/fixtures/fake-mailbox/`) to simulate real-world email data. Tests run completely offline with deterministic results.

## Architecture

```
tests/integration/
  setup.ts           # Global test setup (fake timers, fixed date)
  types.ts           # TypeScript types for the framework
  mockProviders.ts   # Mock Gmail, Outlook, and iOS providers
  testSandbox.ts     # Main test orchestrator
  pipelineTests.test.ts  # Integration test suite
  README.md          # This file
```

## Quick Start

### Basic Usage

```typescript
import { createTestSandbox } from './testSandbox';

describe('My Integration Test', () => {
  let sandbox: TestSandbox;

  beforeAll(async () => {
    sandbox = await createTestSandbox({ fixtures: 'email' });
  });

  afterAll(async () => {
    await sandbox.teardown();
  });

  it('should sync and detect transactions', async () => {
    // Sync emails from all providers
    await sandbox.syncAllEmails();

    // Run the detection pipeline
    const result = await sandbox.runDetection();

    expect(result.transactionsDetected).toBeGreaterThan(0);
  });
});
```

### Available Options

```typescript
interface TestSandboxOptions {
  fixtures?: 'email' | 'sms' | 'both';  // Which fixtures to load
  fixedDate?: Date;                      // Fixed date for deterministic tests
  userId?: string;                       // Test user ID
}
```

## TestSandbox API

### Setup and Teardown

- `setup()` - Initialize the sandbox with fixtures
- `teardown()` - Clean up sandbox state

### Email Sync

- `syncEmails(provider: 'gmail' | 'outlook')` - Sync from a specific provider
- `syncAllEmails()` - Sync from all email providers
- `syncMessages()` - Sync from iOS backup (SMS/iMessage)

### Classification and Detection

- `runClassification()` - Classify all synced emails
- `runDetection()` - Run transaction detection pipeline
- `compareClassifications()` - Compare results against expected values

### Data Access

- `getStats()` - Get sandbox statistics
- `getEmails(filter?)` - Get emails with optional filtering
- `getTransactionEmails()` - Get transaction-related emails
- `getSpamEmails()` - Get spam emails
- `getNormalEmails()` - Get normal (non-transaction, non-spam) emails
- `getSyncedEmails()` - Get all synced emails
- `getClassificationResults()` - Get classification results map
- `getDetectedTransactions()` - Get detected transactions
- `getProviders()` - Get mock provider instances

## Mock Providers

### MockGmailProvider

Simulates Gmail API behavior:

```typescript
const provider = new MockGmailProvider({
  latencyMs: 100,          // Simulate network latency
  simulateErrors: false,   // Whether to simulate errors
  errorRate: 0.1,          // Error rate (0-1)
});

provider.loadEmails(fakeEmails);
const { emails, nextPageToken } = await provider.fetchEmails({ maxResults: 50 });
```

### MockOutlookProvider

Simulates Microsoft Graph API behavior:

```typescript
const provider = new MockOutlookProvider({
  latencyMs: 100,
});

provider.loadEmails(fakeEmails);
const { emails, hasMore } = await provider.fetchEmails({ top: 50, skip: 0 });
```

### MockiOSBackupProvider

Simulates iOS backup/iMessage reading:

```typescript
const provider = new MockiOSBackupProvider();

// Will be populated when TASK-801 fixtures are available
provider.loadMessages(messages);
provider.loadContacts(contacts);
```

## Fixture Data

The email fixtures in `fake-mailbox/emails.json` contain:

- 60 fake emails across transaction, spam, normal, and edge cases
- Gmail and Outlook provider formats
- Various transaction stages (intro, showing, offer, etc.)
- Difficulty levels (easy, medium, hard)
- Expected classification results for validation

### Email Categories

| Category | Count | Description |
|----------|-------|-------------|
| transaction | 30 | Real estate transaction emails |
| spam | 10 | Spam/scam emails |
| normal | 15 | Non-transaction, non-spam emails |
| edge_case | 5 | Ambiguous or difficult cases |

### Difficulty Levels

| Level | Description |
|-------|-------------|
| easy | Clear transaction or spam indicators |
| medium | Some ambiguity, requires context |
| hard | Minimal indicators, edge cases |

## Running Tests

```bash
# Run all integration tests
npm test -- --testPathPattern=integration

# Run with verbose output
npm test -- --testPathPattern=integration --verbose

# Run specific test file
npm test -- tests/integration/pipelineTests.test.ts
```

## Test Performance

The framework is designed for fast, reliable testing:

- **No network calls** - All data is from local fixtures
- **Deterministic** - Fixed timestamps and data
- **Fast** - Full pipeline should complete in < 5 seconds
- **Isolated** - Each test suite gets a fresh sandbox

## Adding New Tests

1. Import the sandbox:
   ```typescript
   import { createTestSandbox, TestSandbox } from './testSandbox';
   ```

2. Create and configure your sandbox in `beforeAll`:
   ```typescript
   sandbox = await createTestSandbox({ fixtures: 'email' });
   ```

3. Always teardown in `afterAll`:
   ```typescript
   await sandbox.teardown();
   ```

4. Use the pipeline methods to sync and detect:
   ```typescript
   await sandbox.syncAllEmails();
   const result = await sandbox.runDetection();
   ```

## Future Enhancements

- **TASK-801 Integration**: SMS/iMessage fixtures for message testing
- **Database Integration**: In-memory SQLite for full service testing
- **AI Mock**: Mock LLM responses for AI detection testing
- **Regression Suite**: Track detection accuracy over time
