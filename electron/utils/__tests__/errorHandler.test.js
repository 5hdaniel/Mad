/**
 * Error Handler Tests
 * Tests for standardized error handling utilities
 */

const {
  AppError,
  ValidationError,
  NotFoundError,
  DatabaseError,
  ErrorHandler,
  createValidator,
  withErrorHandling,
} = require('../errorHandler');

describe('ErrorHandler', () => {
  describe('Error Classes', () => {
    it('should create ValidationError with field', () => {
      const error = new ValidationError('Invalid email', 'email');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Invalid email');
      expect(error.field).toBe('email');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
    });

    it('should create NotFoundError with resource info', () => {
      const error = new NotFoundError('User', '123');

      expect(error.message).toBe('User with id 123 not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.resource).toBe('User');
      expect(error.id).toBe('123');
    });

    it('should create DatabaseError with original error', () => {
      const original = new Error('Connection failed');
      const error = new DatabaseError('Database operation failed', original);

      expect(error.originalError).toBe(original);
      expect(error.code).toBe('DATABASE_ERROR');
    });
  });

  describe('handle()', () => {
    it('should handle AppError with full details', () => {
      const error = new ValidationError('Invalid input', 'username');
      const response = ErrorHandler.handle(error, 'TestContext');

      expect(response).toEqual({
        success: false,
        error: {
          message: 'Invalid input',
          code: 'VALIDATION_ERROR',
          field: 'username',
          statusCode: 400,
        },
      });
    });

    it('should handle unknown errors safely', () => {
      const error = new Error('Unknown error');
      const response = ErrorHandler.handle(error, 'TestContext');

      expect(response).toEqual({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          statusCode: 500,
        }),
      });
    });
  });

  describe('validate()', () => {
    it('should not throw when condition is true', () => {
      expect(() => {
        ErrorHandler.validate(true, 'Should not throw');
      }).not.toThrow();
    });

    it('should throw ValidationError when condition is false', () => {
      expect(() => {
        ErrorHandler.validate(false, 'Validation failed', 'field');
      }).toThrow(ValidationError);
    });
  });

  describe('assertExists()', () => {
    it('should not throw when resource exists', () => {
      expect(() => {
        ErrorHandler.assertExists({ id: 1 }, 'User', '1');
      }).not.toThrow();
    });

    it('should throw NotFoundError when resource is null', () => {
      expect(() => {
        ErrorHandler.assertExists(null, 'User', '123');
      }).toThrow(NotFoundError);
    });

    it('should throw NotFoundError when resource is undefined', () => {
      expect(() => {
        ErrorHandler.assertExists(undefined, 'Transaction');
      }).toThrow(NotFoundError);
    });
  });

  describe('retry()', () => {
    it('should succeed on first try', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await ErrorHandler.retry(operation, 3, 100);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const result = await ErrorHandler.retry(operation, 3, 10);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(ErrorHandler.retry(operation, 2, 10))
        .rejects
        .toThrow(/Operation failed after 2 retries/);

      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('asyncHandler()', () => {
    it('should wrap successful async function', async () => {
      const handler = async (data) => ({ data: data * 2 });
      const wrapped = ErrorHandler.asyncHandler(handler, 'Test');

      const result = await wrapped(5);

      expect(result).toEqual({
        success: true,
        data: 10,
      });
    });

    it('should catch and format errors', async () => {
      const handler = async () => {
        throw new ValidationError('Invalid data');
      };

      const wrapped = ErrorHandler.asyncHandler(handler, 'Test');
      const result = await wrapped();

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Invalid data',
        }),
      });
    });
  });

  describe('createValidator()', () => {
    it('should validate required fields', () => {
      const validator = createValidator({
        email: { required: true },
        name: { required: true },
      });

      expect(() => {
        validator({ email: 'test@example.com' });
      }).toThrow(ValidationError);

      expect(() => {
        validator({ email: 'test@example.com', name: 'John' });
      }).not.toThrow();
    });

    it('should validate field types', () => {
      const validator = createValidator({
        age: { type: 'number' },
        name: { type: 'string' },
      });

      expect(() => {
        validator({ age: '25', name: 'John' });
      }).toThrow(ValidationError);

      expect(() => {
        validator({ age: 25, name: 'John' });
      }).not.toThrow();
    });

    it('should validate min/max length', () => {
      const validator = createValidator({
        username: { minLength: 3, maxLength: 20 },
      });

      expect(() => {
        validator({ username: 'ab' });
      }).toThrow(ValidationError);

      expect(() => {
        validator({ username: 'a'.repeat(21) });
      }).toThrow(ValidationError);

      expect(() => {
        validator({ username: 'validuser' });
      }).not.toThrow();
    });

    it('should validate with regex pattern', () => {
      const validator = createValidator({
        email: { pattern: /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/ },
      });

      expect(() => {
        validator({ email: 'invalid-email' });
      }).toThrow(ValidationError);

      expect(() => {
        validator({ email: 'valid@example.com' });
      }).not.toThrow();
    });

    it('should validate with custom function', () => {
      const validator = createValidator({
        age: {
          custom: (value) => value >= 18,
          customMessage: 'Must be 18 or older',
        },
      });

      expect(() => {
        validator({ age: 17 });
      }).toThrow('Must be 18 or older');

      expect(() => {
        validator({ age: 18 });
      }).not.toThrow();
    });
  });
});
