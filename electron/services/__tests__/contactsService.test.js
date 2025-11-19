/**
 * ContactsService Tests
 * Tests contact loading and resolution from macOS Contacts database
 */

const contactsService = require('../contactsService');
const fs = require('fs').promises;
const { exec } = require('child_process');
const sqlite3 = require('sqlite3');

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
  },
}));
jest.mock('child_process');
jest.mock('sqlite3');

describe('ContactsService', () => {
  describe('getContactNames', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should successfully load contacts from primary database', async () => {
      // Mock finding database files
      const mockExec = jest.fn((cmd, callback) => {
        callback(null, {
          stdout: '/Users/test/Library/Application Support/AddressBook/Sources/ABC/AddressBook.abcddb\n',
        });
      });
      require('child_process').exec = mockExec;

      // Mock database operations
      const mockDb = {
        all: jest.fn(),
        close: jest.fn((callback) => callback()),
      };

      // Mock record count query
      mockDb.all.mockImplementationOnce((query, callback) => {
        callback(null, [{ count: 100 }]);
      });

      // Mock contacts query
      mockDb.all.mockImplementationOnce((query, callback) => {
        callback(null, [
          {
            person_id: 1,
            first_name: 'John',
            last_name: 'Doe',
            phone: '+15551234567',
            email: 'john@example.com',
          },
          {
            person_id: 2,
            first_name: 'Jane',
            last_name: 'Smith',
            phone: '+15559876543',
            email: 'jane@example.com',
          },
        ]);
      });

      sqlite3.Database = jest.fn(() => mockDb);
      fs.access.mockResolvedValue();

      const result = await contactsService.getContactNames();

      expect(result.status.success).toBe(true);
      expect(result.status.contactCount).toBeGreaterThan(0);
      expect(result.contactMap).toBeDefined();
      expect(result.phoneToContactInfo).toBeDefined();
    });

    it('should fallback to default path when no databases found', async () => {
      const mockExec = jest.fn((cmd, callback) => {
        callback(null, { stdout: '' });
      });
      require('child_process').exec = mockExec;

      const mockDb = {
        all: jest.fn(),
        close: jest.fn((callback) => callback()),
      };

      mockDb.all.mockImplementation((query, callback) => {
        if (query.includes('COUNT')) {
          callback(null, [{ count: 50 }]);
        } else {
          callback(null, [
            {
              person_id: 1,
              first_name: 'Test',
              last_name: 'User',
              phone: '+15551111111',
              email: 'test@example.com',
            },
          ]);
        }
      });

      sqlite3.Database = jest.fn(() => mockDb);
      fs.access.mockResolvedValue();

      const result = await contactsService.getContactNames();

      expect(result.status.success).toBe(true);
    });

    it('should return error status when database access fails', async () => {
      const mockExec = jest.fn((cmd, callback) => {
        callback(new Error('Permission denied'));
      });
      require('child_process').exec = mockExec;

      fs.access.mockRejectedValue(new Error('Permission denied'));

      const result = await contactsService.getContactNames();

      expect(result.status.success).toBe(false);
      expect(result.status.error).toBeDefined();
      expect(result.status.userMessage).toContain('Could not load contacts');
      expect(result.contactMap).toEqual({});
    });

    it('should skip databases with insufficient records', async () => {
      const mockExec = jest.fn((cmd, callback) => {
        callback(null, {
          stdout: '/path/to/db1.abcddb\n/path/to/db2.abcddb\n',
        });
      });
      require('child_process').exec = mockExec;

      const mockDb = {
        all: jest.fn(),
        close: jest.fn((callback) => callback()),
      };

      // First database has too few records
      let callCount = 0;
      mockDb.all.mockImplementation((query, callback) => {
        if (query.includes('COUNT')) {
          callCount++;
          if (callCount === 1) {
            callback(null, [{ count: 5 }]); // Too few
          } else {
            callback(null, [{ count: 100 }]); // Enough
          }
        } else {
          callback(null, [
            {
              person_id: 1,
              first_name: 'John',
              last_name: 'Doe',
              phone: '+15551234567',
              email: 'john@example.com',
            },
          ]);
        }
      });

      sqlite3.Database = jest.fn(() => mockDb);
      fs.access.mockResolvedValue();

      const result = await contactsService.getContactNames();

      expect(result.status.success).toBe(true);
    });
  });

  describe('loadContactsFromDatabase', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should load and map contacts correctly', async () => {
      const mockDb = {
        all: jest.fn((query, callback) => {
          callback(null, [
            {
              person_id: 1,
              first_name: 'Alice',
              last_name: 'Johnson',
              phone: '+15551234567',
              email: 'alice@example.com',
            },
            {
              person_id: 1,
              first_name: 'Alice',
              last_name: 'Johnson',
              phone: '+15559876543',
              email: 'alice@example.com',
            },
            {
              person_id: 2,
              first_name: 'Bob',
              last_name: 'Smith',
              phone: '+15555555555',
              email: 'bob@example.com',
            },
          ]);
        }),
        close: jest.fn((callback) => callback()),
      };

      sqlite3.Database = jest.fn(() => mockDb);
      fs.access.mockResolvedValue();

      const result = await contactsService.loadContactsFromDatabase('/path/to/db.abcddb');

      expect(result.contactMap).toBeDefined();
      expect(result.phoneToContactInfo).toBeDefined();

      // Verify phone mapping
      expect(result.contactMap['+15551234567']).toBe('Alice Johnson');
      expect(result.contactMap['alice@example.com']).toBe('Alice Johnson');

      // Verify phoneToContactInfo groups all info for a person
      expect(result.phoneToContactInfo['+15551234567']).toBeDefined();
      expect(result.phoneToContactInfo['+15551234567'].name).toBe('Alice Johnson');
    });

    it('should handle contacts with no last name', async () => {
      const mockDb = {
        all: jest.fn((query, callback) => {
          callback(null, [
            {
              person_id: 1,
              first_name: 'Madonna',
              last_name: null,
              phone: '+15551234567',
              email: 'madonna@example.com',
            },
          ]);
        }),
        close: jest.fn((callback) => callback()),
      };

      sqlite3.Database = jest.fn(() => mockDb);
      fs.access.mockResolvedValue();

      const result = await contactsService.loadContactsFromDatabase('/path/to/db.abcddb');

      expect(result.contactMap['+15551234567']).toBe('Madonna');
    });

    it('should handle contacts with no first name', async () => {
      const mockDb = {
        all: jest.fn((query, callback) => {
          callback(null, [
            {
              person_id: 1,
              first_name: null,
              last_name: 'Company',
              phone: '+15551234567',
              email: 'info@company.com',
            },
          ]);
        }),
        close: jest.fn((callback) => callback()),
      };

      sqlite3.Database = jest.fn(() => mockDb);
      fs.access.mockResolvedValue();

      const result = await contactsService.loadContactsFromDatabase('/path/to/db.abcddb');

      expect(result.contactMap['+15551234567']).toBe('Company');
    });

    it('should normalize phone numbers for mapping', async () => {
      const mockDb = {
        all: jest.fn((query, callback) => {
          callback(null, [
            {
              person_id: 1,
              first_name: 'Test',
              last_name: 'User',
              phone: '(555) 123-4567',
              email: 'test@example.com',
            },
          ]);
        }),
        close: jest.fn((callback) => callback()),
      };

      sqlite3.Database = jest.fn(() => mockDb);
      fs.access.mockResolvedValue();

      const result = await contactsService.loadContactsFromDatabase('/path/to/db.abcddb');

      // Should map both original and normalized formats
      expect(result.contactMap).toBeDefined();
      expect(Object.keys(result.contactMap).length).toBeGreaterThan(0);
    });

    it('should return empty maps when database file does not exist', async () => {
      fs.access.mockRejectedValue(new Error('File not found'));

      const result = await contactsService.loadContactsFromDatabase('/nonexistent/path.abcddb');

      expect(result.contactMap).toEqual({});
      expect(result.phoneToContactInfo).toEqual({});
    });

    it('should handle database query errors gracefully', async () => {
      const mockDb = {
        all: jest.fn((query, callback) => {
          callback(new Error('Database query failed'));
        }),
        close: jest.fn((callback) => callback()),
      };

      sqlite3.Database = jest.fn(() => mockDb);
      fs.access.mockResolvedValue();

      const result = await contactsService.loadContactsFromDatabase('/path/to/db.abcddb');

      expect(result.contactMap).toEqual({});
      expect(result.phoneToContactInfo).toEqual({});
    });

    it('should aggregate multiple phone numbers and emails for same person', async () => {
      const mockDb = {
        all: jest.fn((query, callback) => {
          callback(null, [
            {
              person_id: 1,
              first_name: 'John',
              last_name: 'Doe',
              phone: '+15551111111',
              email: 'john.work@example.com',
            },
            {
              person_id: 1,
              first_name: 'John',
              last_name: 'Doe',
              phone: '+15552222222',
              email: 'john.personal@example.com',
            },
            {
              person_id: 1,
              first_name: 'John',
              last_name: 'Doe',
              phone: '+15553333333',
              email: null,
            },
          ]);
        }),
        close: jest.fn((callback) => callback()),
      };

      sqlite3.Database = jest.fn(() => mockDb);
      fs.access.mockResolvedValue();

      const result = await contactsService.loadContactsFromDatabase('/path/to/db.abcddb');

      // All phone numbers should map to same contact
      expect(result.contactMap['+15551111111']).toBe('John Doe');
      expect(result.contactMap['+15552222222']).toBe('John Doe');
      expect(result.contactMap['+15553333333']).toBe('John Doe');

      // phoneToContactInfo should have all phones for this contact
      const contactInfo = result.phoneToContactInfo['+15551111111'];
      expect(contactInfo).toBeDefined();
      expect(contactInfo.phones).toContain('+15551111111');
      expect(contactInfo.phones).toContain('+15552222222');
      expect(contactInfo.phones).toContain('+15553333333');
      expect(contactInfo.emails).toContain('john.work@example.com');
      expect(contactInfo.emails).toContain('john.personal@example.com');
    });
  });
});
