/**
 * Supabase Service Tests
 * Tests cloud database operations and sync
 */

const SupabaseService = require('../supabaseService');

// Mock @supabase/supabase-js
const mockClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockClient),
}));

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

describe('SupabaseService', () => {
  let supabaseService;
  let mockQuery;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

    // Setup mock query chain
    mockQuery = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: {}, error: null }),
    };

    mockClient.from.mockReturnValue(mockQuery);
    mockClient.rpc.mockResolvedValue({ data: null, error: null });

    supabaseService = new SupabaseService();
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
  });

  describe('initialize', () => {
    it('should initialize Supabase client with credentials', () => {
      supabaseService.initialize();

      expect(supabaseService.initialized).toBe(true);
      expect(supabaseService.client).toBeDefined();
    });

    it('should throw error when credentials are missing', () => {
      delete process.env.SUPABASE_URL;

      expect(() => supabaseService.initialize()).toThrow('Supabase credentials not configured');
    });

    it('should not reinitialize if already initialized', () => {
      const { createClient } = require('@supabase/supabase-js');

      supabaseService.initialize();
      const callCount = createClient.mock.calls.length;

      supabaseService.initialize();

      expect(createClient).toHaveBeenCalledTimes(callCount);
    });

    it('should configure client with auth settings', () => {
      const { createClient } = require('@supabase/supabase-js');

      supabaseService.initialize();

      expect(createClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-service-key',
        expect.objectContaining({
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        })
      );
    });
  });

  describe('syncUser', () => {
    const mockUserData = {
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      display_name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg',
      oauth_provider: 'google',
      oauth_id: 'google-123',
    };

    it('should create new user when user does not exist', async () => {
      // Mock user not found
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' }, // Not found error
      });

      // Mock successful insert
      const createdUser = { id: 'user-123', ...mockUserData };
      mockQuery.single.mockResolvedValueOnce({
        data: createdUser,
        error: null,
      });

      const result = await supabaseService.syncUser(mockUserData);

      expect(result).toEqual(createdUser);
      expect(mockClient.from).toHaveBeenCalledWith('users');
      expect(mockQuery.insert).toHaveBeenCalled();
    });

    it('should update existing user when user exists', async () => {
      const existingUser = { id: 'user-123', ...mockUserData };

      // Mock user found
      mockQuery.single.mockResolvedValueOnce({
        data: existingUser,
        error: null,
      });

      // Mock successful update
      const updatedUser = { ...existingUser, display_name: 'Updated Name' };
      mockQuery.single.mockResolvedValueOnce({
        data: updatedUser,
        error: null,
      });

      const result = await supabaseService.syncUser({
        ...mockUserData,
        display_name: 'Updated Name',
      });

      expect(result).toEqual(updatedUser);
      expect(mockQuery.update).toHaveBeenCalled();
      expect(mockClient.rpc).toHaveBeenCalledWith('increment', expect.any(Object));
    });

    it('should increment login count for existing users', async () => {
      const existingUser = { id: 'user-123', ...mockUserData };

      mockQuery.single.mockResolvedValueOnce({ data: existingUser, error: null });
      mockQuery.single.mockResolvedValueOnce({ data: existingUser, error: null });

      await supabaseService.syncUser(mockUserData);

      expect(mockClient.rpc).toHaveBeenCalledWith('increment', {
        row_id: 'user-123',
        x: 1,
        table_name: 'users',
        column_name: 'login_count',
      });
    });

    it('should set trial period for new users', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      let insertedData;
      mockQuery.insert.mockImplementation((data) => {
        insertedData = data;
        return mockQuery;
      });

      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'user-123', ...mockUserData },
        error: null,
      });

      await supabaseService.syncUser(mockUserData);

      expect(insertedData.subscription_status).toBe('trial');
      expect(insertedData.trial_ends_at).toBeDefined();
    });

    it('should handle sync errors', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: new Error('Database connection failed'),
      });

      await expect(supabaseService.syncUser(mockUserData)).rejects.toThrow();
    });
  });

  describe('getUserById', () => {
    it('should retrieve user by ID', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'Test User',
      };

      mockQuery.single.mockResolvedValue({
        data: mockUser,
        error: null,
      });

      const result = await supabaseService.getUserById('user-123');

      expect(result).toEqual(mockUser);
      expect(mockClient.from).toHaveBeenCalledWith('users');
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'user-123');
    });

    it('should handle user not found', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(supabaseService.getUserById('non-existent')).rejects.toThrow();
    });
  });

  describe('syncTransaction', () => {
    const mockTransaction = {
      user_id: 'user-123',
      property_address: '123 Main St, City, CA 90210',
      transaction_type: 'purchase',
      sale_price: 500000,
    };

    it('should sync transaction to cloud', async () => {
      const createdTransaction = { id: 'txn-123', ...mockTransaction };

      mockQuery.single.mockResolvedValue({
        data: createdTransaction,
        error: null,
      });

      const result = await supabaseService.syncTransaction(mockTransaction);

      expect(result).toEqual(createdTransaction);
      expect(mockClient.from).toHaveBeenCalledWith('transactions');
    });

    it('should handle transaction sync errors', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: new Error('Sync failed'),
      });

      await expect(supabaseService.syncTransaction(mockTransaction)).rejects.toThrow();
    });
  });

  describe('getTransactions', () => {
    it('should retrieve all transactions for a user', async () => {
      const mockTransactions = [
        { id: 'txn-1', property_address: '123 Main St' },
        { id: 'txn-2', property_address: '456 Oak Ave' },
      ];

      mockQuery.single.mockResolvedValue({
        data: mockTransactions,
        error: null,
      });

      const result = await supabaseService.getTransactions('user-123');

      expect(mockClient.from).toHaveBeenCalledWith('transactions');
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123');
    });
  });

  describe('deleteTransaction', () => {
    it('should delete transaction from cloud', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await supabaseService.deleteTransaction('txn-123');

      expect(mockClient.from).toHaveBeenCalledWith('transactions');
      expect(mockQuery.delete).toHaveBeenCalled();
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'txn-123');
    });

    it('should handle delete errors', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: new Error('Delete failed'),
      });

      await expect(supabaseService.deleteTransaction('txn-123')).rejects.toThrow();
    });
  });

  describe('_ensureInitialized', () => {
    it('should initialize if not already initialized', () => {
      const service = new SupabaseService();
      expect(service.initialized).toBe(false);

      service._ensureInitialized();

      expect(service.initialized).toBe(true);
    });

    it('should not reinitialize if already initialized', () => {
      supabaseService.initialize();
      const { createClient } = require('@supabase/supabase-js');
      const callCount = createClient.mock.calls.length;

      supabaseService._ensureInitialized();

      expect(createClient).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockQuery.single.mockRejectedValue(new Error('Network error'));

      await expect(
        supabaseService.syncUser({
          email: 'test@example.com',
          oauth_provider: 'google',
          oauth_id: '123',
        })
      ).rejects.toThrow('Network error');
    });

    it('should handle malformed data', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { message: 'Invalid data format' },
      });

      await expect(supabaseService.syncUser({})).rejects.toThrow();
    });
  });
});
