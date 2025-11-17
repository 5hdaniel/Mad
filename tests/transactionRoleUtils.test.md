# Transaction Role Utilities - Test Suite

This document contains comprehensive test cases for the transaction role filtering logic.

## Test File: `src/utils/transactionRoleUtils.js`

### Test Suite 1: `filterRolesByTransactionType()`

#### Test Case 1.1: Professional Services Step - No Filtering
```javascript
// GIVEN: Professional Services workflow step
const roles = [
  { role: 'inspector', required: false, multiple: true },
  { role: 'appraiser', required: false, multiple: false },
  { role: 'title_company', required: false, multiple: false },
];
const transactionType = 'purchase';
const stepTitle = 'Professional Services';

// WHEN: filterRolesByTransactionType is called
const result = filterRolesByTransactionType(roles, transactionType, stepTitle);

// THEN: All roles should be returned unchanged
EXPECT(result).toEqual(roles);
EXPECT(result.length).toBe(3);
```

#### Test Case 1.2: Client & Agents Step - Purchase Transaction
```javascript
// GIVEN: Client & Agents workflow step with purchase transaction
const roles = [
  { role: 'client', required: true, multiple: false },
  { role: 'buyer_agent', required: false, multiple: false },
  { role: 'seller_agent', required: false, multiple: false },
  { role: 'listing_agent', required: false, multiple: false },
];
const transactionType = 'purchase';
const stepTitle = 'Client & Agents';

// WHEN: filterRolesByTransactionType is called
const result = filterRolesByTransactionType(roles, transactionType, stepTitle);

// THEN: Only client, seller_agent, and listing_agent should be returned
EXPECT(result.length).toBe(3);
EXPECT(result.map(r => r.role)).toContain('client');
EXPECT(result.map(r => r.role)).toContain('seller_agent');
EXPECT(result.map(r => r.role)).toContain('listing_agent');
EXPECT(result.map(r => r.role)).NOT.toContain('buyer_agent');
```

**Rationale**: In a purchase transaction, the user is the buyer's agent, so they need to assign the seller's agent.

#### Test Case 1.3: Client & Agents Step - Sale Transaction
```javascript
// GIVEN: Client & Agents workflow step with sale transaction
const roles = [
  { role: 'client', required: true, multiple: false },
  { role: 'buyer_agent', required: false, multiple: false },
  { role: 'seller_agent', required: false, multiple: false },
  { role: 'listing_agent', required: false, multiple: false },
];
const transactionType = 'sale';
const stepTitle = 'Client & Agents';

// WHEN: filterRolesByTransactionType is called
const result = filterRolesByTransactionType(roles, transactionType, stepTitle);

// THEN: Only client and buyer_agent should be returned
EXPECT(result.length).toBe(2);
EXPECT(result.map(r => r.role)).toContain('client');
EXPECT(result.map(r => r.role)).toContain('buyer_agent');
EXPECT(result.map(r => r.role)).NOT.toContain('seller_agent');
EXPECT(result.map(r => r.role)).NOT.toContain('listing_agent');
```

**Rationale**: In a sale transaction, the user is the seller's agent, so they need to assign the buyer's agent.

#### Test Case 1.4: Client Always Included
```javascript
// GIVEN: Any transaction type
const roles = [
  { role: 'client', required: true, multiple: false },
  { role: 'other_role', required: false, multiple: false },
];

// WHEN: filterRolesByTransactionType is called for purchase
const purchaseResult = filterRolesByTransactionType(roles, 'purchase', 'Client & Agents');

// THEN: Client role should always be included
EXPECT(purchaseResult.some(r => r.role === 'client')).toBe(true);

// WHEN: filterRolesByTransactionType is called for sale
const saleResult = filterRolesByTransactionType(roles, 'sale', 'Client & Agents');

// THEN: Client role should always be included
EXPECT(saleResult.some(r => r.role === 'client')).toBe(true);
```

### Test Suite 2: `getTransactionTypeContext()`

#### Test Case 2.1: Purchase Transaction Context
```javascript
// GIVEN: Purchase transaction type
const transactionType = 'purchase';

// WHEN: getTransactionTypeContext is called
const result = getTransactionTypeContext(transactionType);

// THEN: Correct context should be returned
EXPECT(result.title).toBe('Transaction Type: Purchase');
EXPECT(result.message).toContain('representing the buyer');
EXPECT(result.message).toContain("seller's agent");
```

#### Test Case 2.2: Sale Transaction Context
```javascript
// GIVEN: Sale transaction type
const transactionType = 'sale';

// WHEN: getTransactionTypeContext is called
const result = getTransactionTypeContext(transactionType);

// THEN: Correct context should be returned
EXPECT(result.title).toBe('Transaction Type: Sale');
EXPECT(result.message).toContain('representing the seller');
EXPECT(result.message).toContain("buyer's agent");
```

### Test Suite 3: `validateRoleAssignments()`

#### Test Case 3.1: All Required Roles Assigned
```javascript
// GIVEN: Required roles with assignments
const contactAssignments = {
  client: [{ contactId: 'contact-1', isPrimary: true }],
  seller_agent: [{ contactId: 'contact-2', isPrimary: false }],
};
const roles = [
  { role: 'client', required: true, multiple: false },
  { role: 'seller_agent', required: false, multiple: false },
];

// WHEN: validateRoleAssignments is called
const result = validateRoleAssignments(contactAssignments, roles);

// THEN: Validation should pass
EXPECT(result.isValid).toBe(true);
EXPECT(result.missingRoles.length).toBe(0);
```

#### Test Case 3.2: Missing Required Role
```javascript
// GIVEN: Missing required role
const contactAssignments = {
  seller_agent: [{ contactId: 'contact-2', isPrimary: false }],
};
const roles = [
  { role: 'client', required: true, multiple: false },
  { role: 'seller_agent', required: false, multiple: false },
];

// WHEN: validateRoleAssignments is called
const result = validateRoleAssignments(contactAssignments, roles);

// THEN: Validation should fail
EXPECT(result.isValid).toBe(false);
EXPECT(result.missingRoles).toContain('client');
EXPECT(result.missingRoles.length).toBe(1);
```

#### Test Case 3.3: Empty Assignment Array
```javascript
// GIVEN: Required role with empty assignment array
const contactAssignments = {
  client: [], // Empty array should be treated as missing
};
const roles = [
  { role: 'client', required: true, multiple: false },
];

// WHEN: validateRoleAssignments is called
const result = validateRoleAssignments(contactAssignments, roles);

// THEN: Validation should fail
EXPECT(result.isValid).toBe(false);
EXPECT(result.missingRoles).toContain('client');
```

#### Test Case 3.4: Optional Roles Can Be Missing
```javascript
// GIVEN: Only required roles assigned
const contactAssignments = {
  client: [{ contactId: 'contact-1', isPrimary: true }],
};
const roles = [
  { role: 'client', required: true, multiple: false },
  { role: 'inspector', required: false, multiple: true },
  { role: 'appraiser', required: false, multiple: false },
];

// WHEN: validateRoleAssignments is called
const result = validateRoleAssignments(contactAssignments, roles);

// THEN: Validation should pass
EXPECT(result.isValid).toBe(true);
EXPECT(result.missingRoles.length).toBe(0);
```

## Edge Cases

### Edge Case 1: Unknown Transaction Type
```javascript
// GIVEN: Unknown transaction type
const roles = [
  { role: 'client', required: true, multiple: false },
  { role: 'buyer_agent', required: false, multiple: false },
];
const transactionType = 'unknown';
const stepTitle = 'Client & Agents';

// WHEN: filterRolesByTransactionType is called
const result = filterRolesByTransactionType(roles, transactionType, stepTitle);

// THEN: Only client should be returned (safest default)
EXPECT(result.length).toBe(1);
EXPECT(result[0].role).toBe('client');
```

### Edge Case 2: Empty Roles Array
```javascript
// GIVEN: Empty roles array
const roles = [];
const transactionType = 'purchase';
const stepTitle = 'Client & Agents';

// WHEN: filterRolesByTransactionType is called
const result = filterRolesByTransactionType(roles, transactionType, stepTitle);

// THEN: Empty array should be returned
EXPECT(result.length).toBe(0);
```

## Integration Tests

### Integration Test 1: Full Workflow - Purchase Transaction
```javascript
// SCENARIO: User creates a purchase transaction and assigns contacts

// Step 1: Filter roles for Client & Agents
const step1Roles = filterRolesByTransactionType(
  AUDIT_WORKFLOW_STEPS[0].roles,
  'purchase',
  'Client & Agents'
);

EXPECT(step1Roles.some(r => r.role === 'client')).toBe(true);
EXPECT(step1Roles.some(r => r.role === 'seller_agent')).toBe(true);
EXPECT(step1Roles.some(r => r.role === 'buyer_agent')).toBe(false);

// Step 2: Validate assignments after assigning client
const contactAssignments = {
  client: [{ contactId: 'client-1', isPrimary: true }],
};

const validation1 = validateRoleAssignments(contactAssignments, step1Roles);
EXPECT(validation1.isValid).toBe(true);

// Step 3: Get context message
const context = getTransactionTypeContext('purchase');
EXPECT(context.message).toContain('buyer');
```

### Integration Test 2: Full Workflow - Sale Transaction
```javascript
// SCENARIO: User creates a sale transaction and assigns contacts

// Step 1: Filter roles for Client & Agents
const step1Roles = filterRolesByTransactionType(
  AUDIT_WORKFLOW_STEPS[0].roles,
  'sale',
  'Client & Agents'
);

EXPECT(step1Roles.some(r => r.role === 'client')).toBe(true);
EXPECT(step1Roles.some(r => r.role === 'buyer_agent')).toBe(true);
EXPECT(step1Roles.some(r => r.role === 'seller_agent')).toBe(false);

// Step 2: Validate assignments after assigning client
const contactAssignments = {
  client: [{ contactId: 'client-1', isPrimary: true }],
};

const validation1 = validateRoleAssignments(contactAssignments, step1Roles);
EXPECT(validation1.isValid).toBe(true);

// Step 3: Get context message
const context = getTransactionTypeContext('sale');
EXPECT(context.message).toContain('seller');
```

## Performance Tests

### Performance Test 1: Large Roles Array
```javascript
// GIVEN: Large roles array (100 roles)
const roles = Array.from({ length: 100 }, (_, i) => ({
  role: `role_${i}`,
  required: i % 10 === 0,
  multiple: i % 5 === 0,
}));

// WHEN: filterRolesByTransactionType is called
const startTime = performance.now();
const result = filterRolesByTransactionType(roles, 'purchase', 'Professional Services');
const endTime = performance.now();

// THEN: Should complete in under 10ms
EXPECT(endTime - startTime).toBeLessThan(10);
EXPECT(result.length).toBe(100); // Professional services - no filtering
```

## How to Run Tests

Since this project doesn't have a testing framework set up yet, you can:

1. **Manual Testing**: Use the browser console to run these tests manually
2. **Add Jest**: Install Jest and convert these to actual test files
3. **Integration Testing**: Test through the UI by creating transactions

### To Add Jest (Future):

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
```

Then create actual `.test.js` files from these test cases.
