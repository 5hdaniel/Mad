# Contact Deletion Prevention - Test Documentation

This document describes the test suite for the contact deletion prevention feature.

## Test Files Created

### 1. Database Service Tests
**File:** `electron/services/__tests__/databaseService.contactDeletion.test.js`

**Purpose:** Unit tests for the `getTransactionsByContact()` method in DatabaseService

**Test Coverage:**

#### Basic Functionality
- ✅ Returns empty array when contact has no associated transactions
- ✅ Finds transactions via direct FK references (buyer_agent_id, seller_agent_id, etc.)
- ✅ Finds transactions via junction table (transaction_contacts)
- ✅ Finds transactions via JSON array (other_contacts)

#### Advanced Scenarios
- ✅ Deduplicates transactions found in multiple sources
- ✅ Combines multiple roles from the same transaction
- ✅ Handles multiple transactions across different sources
- ✅ Handles json_each failure and falls back to LIKE query
- ✅ Handles invalid JSON gracefully in fallback query

#### SQL Parameter Validation
- ✅ Passes correct SQL parameters for all queries (8 params for direct FK, 1 for junction, 1 for JSON)

#### Role Handling
- ✅ Uses specific_role when available
- ✅ Falls back to role_category when specific_role is null
- ✅ Uses "Associated Contact" as final fallback

#### Transaction Details
- ✅ Handles all transaction types (purchase, sale)
- ✅ Handles all statuses (active, closed)
- ✅ Preserves property address, closing date, and other metadata

### 2. UI Component Tests
**File:** `src/components/__tests__/Contacts.deletionPrevention.test.jsx`

**Purpose:** Integration tests for the Contacts component blocking modal and user flow

**Test Coverage:**

#### Deletion Without Transactions
- ✅ Allows deletion when contact has no transactions
- ✅ Shows confirmation dialog before deletion
- ✅ Does not delete if user cancels confirmation
- ✅ Calls checkCanDelete API before deletion
- ✅ Reloads contacts after successful deletion

#### Deletion With Transactions (Blocking)
- ✅ Shows blocking modal when contact has associated transactions
- ✅ Displays transaction count correctly
- ✅ Lists all transaction details (address, roles, type, status, date)
- ✅ Does NOT call delete API when blocking
- ✅ Shows correct transaction type badges (Purchase/Sale)
- ✅ Shows correct status badges (Active/Closed)
- ✅ Displays contact roles in each transaction

#### Modal Interaction
- ✅ Closes blocking modal when close button is clicked
- ✅ Shows "... and X more transactions" when count exceeds 20
- ✅ Only displays first 20 transactions in the list

#### Error Handling
- ✅ Shows error alert if checkCanDelete API fails
- ✅ Shows error alert if checkCanDelete throws exception
- ✅ Does not proceed with deletion on error

#### Text Formatting
- ✅ Uses singular "transaction" when count is 1
- ✅ Uses plural "transactions" when count > 1

### 3. Test Setup Updates
**File:** `tests/setup.js`

**Changes:**
- Added `checkCanDelete` mock to window.api.contacts
- Added `remove` mock to window.api.contacts

## Running the Tests

### Run All Tests
```bash
npm test
```

### Run Database Service Tests Only
```bash
npm test -- databaseService.contactDeletion.test.js
```

### Run UI Component Tests Only
```bash
npm test -- Contacts.deletionPrevention.test.jsx
```

### Run with Coverage
```bash
npm run test:coverage
```

### Watch Mode (for development)
```bash
npm run test:watch
```

## Expected Test Results

### Database Service Tests
- **Total Tests:** 14
- **Expected Pass Rate:** 100%
- **Estimated Runtime:** < 1 second

### UI Component Tests
- **Total Tests:** 15
- **Expected Pass Rate:** 100%
- **Estimated Runtime:** 2-5 seconds

## Test Dependencies

All required dependencies are already in `package.json`:
- `jest` - Test runner
- `@testing-library/react` - React component testing utilities
- `@testing-library/jest-dom` - Custom Jest matchers
- `babel-jest` - Babel integration for JSX
- `jest-environment-jsdom` - DOM environment for React tests

## Key Testing Patterns Used

### 1. Mocking Database Calls
```javascript
mockDb.all
  .mockResolvedValueOnce([directTxn])  // First call
  .mockResolvedValueOnce([junctionTxn]) // Second call
  .mockResolvedValueOnce([jsonTxn]);    // Third call
```

### 2. Testing Async User Interactions
```javascript
fireEvent.click(screen.getByText('Remove Contact'));

await waitFor(() => {
  expect(screen.getByText('Cannot Delete Contact')).toBeInTheDocument();
});
```

### 3. Testing Modal Rendering
```javascript
await waitFor(() => {
  expect(screen.getByText('Cannot Delete Contact')).toBeInTheDocument();
});

expect(screen.getByText('123 Main St')).toBeInTheDocument();
```

## Continuous Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: npm test

- name: Upload Coverage
  run: npm run test:coverage
```

## Troubleshooting

### Test Failures

1. **"Cannot find module" errors:**
   - Run `npm install` to ensure all dependencies are installed

2. **"jest-environment-jsdom not found":**
   - Ensure `jest-environment-jsdom` is installed: `npm install --save-dev jest-environment-jsdom`

3. **Mock not working:**
   - Check that `tests/setup.js` is being loaded (configured in jest.config.js)
   - Verify mock functions are cleared in `beforeEach`: `jest.clearAllMocks()`

4. **Async test timeout:**
   - Increase timeout in jest.config.js or use `jest.setTimeout(10000)` in test file

## Code Coverage Goals

According to `jest.config.js`, the project aims for:
- **Branches:** 50%
- **Functions:** 50%
- **Lines:** 50%
- **Statements:** 50%

The contact deletion prevention feature should help achieve these goals with comprehensive test coverage.

## Future Test Improvements

1. **E2E Tests:** Add Playwright/Cypress tests for full user flows
2. **Performance Tests:** Test query performance with large datasets (10,000+ transactions)
3. **Accessibility Tests:** Ensure blocking modal meets WCAG standards
4. **Visual Regression Tests:** Capture screenshots of blocking modal for visual comparison
