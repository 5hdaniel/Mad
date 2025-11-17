# Contact Sorting - Test Suite

This document contains comprehensive test cases for the contact sorting and filtering logic.

## Test File: `electron/services/databaseService.js::getContactsSortedByActivity()`

### Test Suite 1: Basic Contact Sorting

#### Test Case 1.1: Sort by Recent Communication
```javascript
// SETUP: Create test data
const userId = 'user-1';
await createContact(userId, { name: 'Alice', email: 'alice@example.com' });
await createContact(userId, { name: 'Bob', email: 'bob@example.com' });
await createContact(userId, { name: 'Charlie', email: 'charlie@example.com' });

// Create communications (most recent first)
await createCommunication(userId, {
  sender: 'bob@example.com',
  sent_at: '2025-01-15T10:00:00',
});
await createCommunication(userId, {
  sender: 'alice@example.com',
  sent_at: '2025-01-10T10:00:00',
});
// Charlie has no communications

// WHEN: Get sorted contacts without property address
const result = await databaseService.getContactsSortedByActivity(userId, null);

// THEN: Contacts should be sorted by recent communication
EXPECT(result[0].name).toBe('Bob'); // Most recent: Jan 15
EXPECT(result[1].name).toBe('Alice'); // Second: Jan 10
EXPECT(result[2].name).toBe('Charlie'); // No communication (NULLS LAST)
EXPECT(result[0].last_communication_at).toBe('2025-01-15T10:00:00');
EXPECT(result[1].last_communication_at).toBe('2025-01-10T10:00:00');
EXPECT(result[2].last_communication_at).toBeNull();
```

#### Test Case 1.2: Sort by Name When No Communications
```javascript
// SETUP: Create contacts with no communications
const userId = 'user-1';
await createContact(userId, { name: 'Zoe', email: 'zoe@example.com' });
await createContact(userId, { name: 'Alice', email: 'alice@example.com' });
await createContact(userId, { name: 'Bob', email: 'bob@example.com' });

// WHEN: Get sorted contacts
const result = await databaseService.getContactsSortedByActivity(userId, null);

// THEN: Contacts should be sorted alphabetically by name
EXPECT(result[0].name).toBe('Alice');
EXPECT(result[1].name).toBe('Bob');
EXPECT(result[2].name).toBe('Zoe');
EXPECT(result.every(c => c.communication_count === 0)).toBe(true);
```

### Test Suite 2: Property Address Relevance

#### Test Case 2.1: Sort by Address Mentions - Subject Line
```javascript
// SETUP: Create contacts and communications
const userId = 'user-1';
const propertyAddress = '123 Main St';

await createContact(userId, { name: 'Alice', email: 'alice@example.com' });
await createContact(userId, { name: 'Bob', email: 'bob@example.com' });

// Alice has 3 emails mentioning the address in subject
await createCommunication(userId, {
  sender: 'alice@example.com',
  subject: 'RE: 123 Main St inspection',
  sent_at: '2025-01-01',
});
await createCommunication(userId, {
  sender: 'alice@example.com',
  subject: 'Update on 123 Main St',
  sent_at: '2025-01-02',
});
await createCommunication(userId, {
  sender: 'alice@example.com',
  subject: '123 Main St closing docs',
  sent_at: '2025-01-03',
});

// Bob has 1 email mentioning the address
await createCommunication(userId, {
  sender: 'bob@example.com',
  subject: 'About 123 Main St',
  sent_at: '2025-01-15', // More recent, but fewer mentions
});

// WHEN: Get sorted contacts with property address
const result = await databaseService.getContactsSortedByActivity(userId, propertyAddress);

// THEN: Alice should be first (3 mentions) despite Bob having more recent communication
EXPECT(result[0].name).toBe('Alice');
EXPECT(result[0].address_mention_count).toBe(3);
EXPECT(result[1].name).toBe('Bob');
EXPECT(result[1].address_mention_count).toBe(1);
```

#### Test Case 2.2: Sort by Address Mentions - Email Body
```javascript
// SETUP: Create contacts and communications
const userId = 'user-1';
const propertyAddress = '456 Oak Ave';

await createContact(userId, { name: 'Alice', email: 'alice@example.com' });
await createContact(userId, { name: 'Bob', email: 'bob@example.com' });

// Alice has address in body_plain
await createCommunication(userId, {
  sender: 'alice@example.com',
  subject: 'Property update',
  body_plain: 'The inspection for 456 Oak Ave is complete.',
  sent_at: '2025-01-01',
});
await createCommunication(userId, {
  sender: 'alice@example.com',
  subject: 'Documents',
  body_plain: 'Here are the docs for 456 Oak Ave property.',
  sent_at: '2025-01-02',
});

// Bob has address in HTML body
await createCommunication(userId, {
  sender: 'bob@example.com',
  subject: 'Closing',
  body: '<p>Closing for 456 Oak Ave is scheduled</p>',
  sent_at: '2025-01-03',
});

// WHEN: Get sorted contacts with property address
const result = await databaseService.getContactsSortedByActivity(userId, propertyAddress);

// THEN: Contacts should be sorted by address mentions
EXPECT(result[0].address_mention_count).toBeGreaterThan(0);
EXPECT(result[1].address_mention_count).toBeGreaterThan(0);
```

#### Test Case 2.3: Address Mentions Take Priority Over Recency
```javascript
// SETUP: Create scenario where older contacts have more address mentions
const userId = 'user-1';
const propertyAddress = '789 Elm St';

await createContact(userId, { name: 'Alice', email: 'alice@example.com' });
await createContact(userId, { name: 'Bob', email: 'bob@example.com' });

// Alice: 5 mentions from 30 days ago
for (let i = 0; i < 5; i++) {
  await createCommunication(userId, {
    sender: 'alice@example.com',
    subject: `Email ${i} about 789 Elm St`,
    sent_at: '2024-12-15',
  });
}

// Bob: 0 mentions, but very recent
await createCommunication(userId, {
  sender: 'bob@example.com',
  subject: 'Different property',
  sent_at: '2025-01-15',
});

// WHEN: Get sorted contacts with property address
const result = await databaseService.getContactsSortedByActivity(userId, propertyAddress);

// THEN: Alice should be first (more relevant despite being older)
EXPECT(result[0].name).toBe('Alice');
EXPECT(result[0].address_mention_count).toBe(5);
EXPECT(result[1].name).toBe('Bob');
EXPECT(result[1].address_mention_count).toBe(0);
```

### Test Suite 3: Communication Count

#### Test Case 3.1: Count All Communications
```javascript
// SETUP: Create contact with multiple communications
const userId = 'user-1';
await createContact(userId, { name: 'Alice', email: 'alice@example.com' });

// Create 10 communications
for (let i = 0; i < 10; i++) {
  await createCommunication(userId, {
    sender: 'alice@example.com',
    subject: `Email ${i}`,
    sent_at: `2025-01-${String(i + 1).padStart(2, '0')}`,
  });
}

// WHEN: Get sorted contacts
const result = await databaseService.getContactsSortedByActivity(userId, null);

// THEN: Communication count should be accurate
EXPECT(result[0].name).toBe('Alice');
EXPECT(result[0].communication_count).toBe(10);
```

#### Test Case 3.2: Count Communications as Recipient
```javascript
// SETUP: Create contact who is a recipient
const userId = 'user-1';
await createContact(userId, { name: 'Alice', email: 'alice@example.com' });

// Create communications where Alice is in recipients
await createCommunication(userId, {
  sender: 'other@example.com',
  recipients: 'alice@example.com',
  sent_at: '2025-01-01',
});
await createCommunication(userId, {
  sender: 'other@example.com',
  recipients: 'alice@example.com, bob@example.com',
  sent_at: '2025-01-02',
});

// WHEN: Get sorted contacts
const result = await databaseService.getContactsSortedByActivity(userId, null);

// THEN: Communications where contact is recipient should be counted
EXPECT(result[0].name).toBe('Alice');
EXPECT(result[0].communication_count).toBe(2);
```

### Test Suite 4: Edge Cases

#### Test Case 4.1: Contact With No Email
```javascript
// SETUP: Create contact without email
const userId = 'user-1';
await createContact(userId, { name: 'Alice', email: null, phone: '555-1234' });

// WHEN: Get sorted contacts
const result = await databaseService.getContactsSortedByActivity(userId, null);

// THEN: Contact should be included with zero communications
EXPECT(result[0].name).toBe('Alice');
EXPECT(result[0].communication_count).toBe(0);
EXPECT(result[0].last_communication_at).toBeNull();
```

#### Test Case 4.2: Special Characters in Address
```javascript
// SETUP: Create communications with special characters in address
const userId = 'user-1';
const propertyAddress = "123 O'Brien St. #2A";

await createContact(userId, { name: 'Alice', email: 'alice@example.com' });

await createCommunication(userId, {
  sender: 'alice@example.com',
  subject: "Property at 123 O'Brien St. #2A",
  sent_at: '2025-01-01',
});

// WHEN: Get sorted contacts with special character address
const result = await databaseService.getContactsSortedByActivity(userId, propertyAddress);

// THEN: Should handle special characters correctly
EXPECT(result[0].address_mention_count).toBe(1);
```

#### Test Case 4.3: Case Insensitive Address Matching
```javascript
// SETUP: Create communications with different cases
const userId = 'user-1';
const propertyAddress = '123 Main St';

await createContact(userId, { name: 'Alice', email: 'alice@example.com' });

await createCommunication(userId, {
  sender: 'alice@example.com',
  subject: '123 MAIN ST - upper case',
  sent_at: '2025-01-01',
});
await createCommunication(userId, {
  sender: 'alice@example.com',
  subject: '123 main st - lower case',
  sent_at: '2025-01-02',
});

// WHEN: Get sorted contacts
const result = await databaseService.getContactsSortedByActivity(userId, propertyAddress);

// THEN: Should match case-insensitively (LIKE is case-insensitive in SQLite)
EXPECT(result[0].address_mention_count).toBe(2);
```

#### Test Case 4.4: Partial Address Matching
```javascript
// SETUP: Create communications with partial address
const userId = 'user-1';
const propertyAddress = '123 Main St';

await createContact(userId, { name: 'Alice', email: 'alice@example.com' });

await createCommunication(userId, {
  sender: 'alice@example.com',
  subject: 'Inspection at 123 Main Street, Anytown, CA',
  sent_at: '2025-01-01',
});

// WHEN: Get sorted contacts
const result = await databaseService.getContactsSortedByActivity(userId, propertyAddress);

// THEN: Should match partial address
EXPECT(result[0].address_mention_count).toBe(1);
```

### Test Suite 5: Performance Tests

#### Test Case 5.1: Large Dataset Performance
```javascript
// SETUP: Create 1000 contacts with varying communications
const userId = 'user-1';

for (let i = 0; i < 1000; i++) {
  await createContact(userId, {
    name: `Contact ${i}`,
    email: `contact${i}@example.com`,
  });

  // Random number of communications (0-10)
  const commCount = Math.floor(Math.random() * 10);
  for (let j = 0; j < commCount; j++) {
    await createCommunication(userId, {
      sender: `contact${i}@example.com`,
      subject: `Email ${j}`,
      sent_at: `2025-01-${String((j % 30) + 1).padStart(2, '0')}`,
    });
  }
}

// WHEN: Get sorted contacts
const startTime = Date.now();
const result = await databaseService.getContactsSortedByActivity(userId, null);
const endTime = Date.now();

// THEN: Should complete in reasonable time (< 1 second)
EXPECT(endTime - startTime).toBeLessThan(1000);
EXPECT(result.length).toBe(1000);
EXPECT(result[0].last_communication_at).toBeGreaterThanOrEqual(result[result.length - 1].last_communication_at);
```

#### Test Case 5.2: Complex Address Matching Performance
```javascript
// SETUP: Create contacts with property address mentions
const userId = 'user-1';
const propertyAddress = '123 Main St';

for (let i = 0; i < 100; i++) {
  await createContact(userId, {
    name: `Contact ${i}`,
    email: `contact${i}@example.com`,
  });

  // 50% chance of address mention
  if (i % 2 === 0) {
    await createCommunication(userId, {
      sender: `contact${i}@example.com`,
      subject: `Email about ${propertyAddress}`,
      sent_at: '2025-01-01',
    });
  }
}

// WHEN: Get sorted contacts with address filtering
const startTime = Date.now();
const result = await databaseService.getContactsSortedByActivity(userId, propertyAddress);
const endTime = Date.now();

// THEN: Should complete efficiently
EXPECT(endTime - startTime).toBeLessThan(500);
EXPECT(result.length).toBe(100);
```

## SQL Query Testing

### Query Test 1: Verify LEFT JOIN Behavior
```sql
-- Test that contacts without communications are still returned
SELECT
  c.*,
  MAX(comm.sent_at) as last_communication_at,
  COUNT(comm.id) as communication_count
FROM contacts c
LEFT JOIN communications comm ON (
  (comm.sender = c.email OR comm.recipients LIKE '%' || c.email || '%')
  AND comm.user_id = c.user_id
)
WHERE c.user_id = 'test-user'
GROUP BY c.id;

-- EXPECT: All contacts returned, even those with zero communications
```

### Query Test 2: Verify NULLS LAST Behavior
```sql
-- Test that contacts with no communications appear last
SELECT *
FROM (
  SELECT 'Alice' as name, '2025-01-10' as last_communication_at
  UNION ALL
  SELECT 'Bob' as name, '2025-01-15' as last_communication_at
  UNION ALL
  SELECT 'Charlie' as name, NULL as last_communication_at
)
ORDER BY last_communication_at DESC NULLS LAST;

-- EXPECT: Bob, Alice, Charlie (NULL last)
```

### Query Test 3: Verify Address Matching Logic
```sql
-- Test LIKE query with % wildcards
SELECT *
FROM communications
WHERE
  subject LIKE '%123 Main St%'
  OR body_plain LIKE '%123 Main St%'
  OR body LIKE '%123 Main St%';

-- EXPECT: All communications mentioning the address
```

## Integration Tests

### Integration Test 1: Full Contact Selection Flow
```javascript
// SCENARIO: User selects contacts for a transaction

// Step 1: Create transaction with property address
const transaction = await createTransaction(userId, {
  property_address: '123 Main St',
});

// Step 2: Get sorted contacts for this address
const contacts = await databaseService.getContactsSortedByActivity(
  userId,
  '123 Main St'
);

// Step 3: Verify most relevant contacts appear first
EXPECT(contacts[0].address_mention_count).toBeGreaterThan(0);
EXPECT(contacts[0].last_communication_at).toBeDefined();

// Step 4: Assign top contacts to transaction
await assignContactToTransaction(transaction.id, contacts[0].id, 'seller_agent');
```

## Manual Testing Checklist

- [ ] Create 3-5 test contacts
- [ ] Send emails mentioning a specific address
- [ ] Open Audit Transaction modal
- [ ] Enter the property address
- [ ] Click "Select Contact" for a role
- [ ] Verify contacts are sorted correctly
- [ ] Verify contacts with address mentions show blue badge
- [ ] Verify "Last contact" date is displayed
- [ ] Search for a contact by name
- [ ] Select multiple contacts (if role allows)
- [ ] Verify selected contacts appear in the role

## How to Run These Tests

1. **Database Setup**: Ensure you have a test database with sample data
2. **Run Queries**: Execute SQL tests in a SQLite browser or CLI
3. **Integration Tests**: Use the app UI to manually verify behavior
4. **Add Automated Tests**: Convert these to Jest tests for CI/CD

### Future: Automated Testing Setup

```bash
# Install testing dependencies
npm install --save-dev jest sqlite3 @databases/sqlite @databases/sqlite-test

# Create test database
npm run test:setup

# Run tests
npm test
```
