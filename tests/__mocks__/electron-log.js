/**
 * Jest mock for electron-log module
 */

const mockLog = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  silly: jest.fn(),
  log: jest.fn(),
  transports: {
    file: {
      level: 'info',
      resolvePathFn: jest.fn(),
    },
    console: {
      level: 'debug',
    },
  },
  scope: jest.fn(() => mockLog),
};

module.exports = mockLog;
module.exports.default = mockLog;
