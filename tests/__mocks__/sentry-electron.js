module.exports = {
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  init: jest.fn(),
  setTag: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  withScope: jest.fn((cb) => cb({ setTag: jest.fn(), setExtra: jest.fn() })),
};
