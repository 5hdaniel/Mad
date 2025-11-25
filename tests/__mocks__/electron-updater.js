/**
 * Jest mock for electron-updater module
 */

const mockAutoUpdater = {
  checkForUpdatesAndNotify: jest.fn(() => Promise.resolve(null)),
  checkForUpdates: jest.fn(() => Promise.resolve(null)),
  downloadUpdate: jest.fn(() => Promise.resolve([])),
  quitAndInstall: jest.fn(),
  setFeedURL: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  autoDownload: true,
  autoInstallOnAppQuit: true,
  allowDowngrade: false,
  currentVersion: { version: '1.1.0' },
};

module.exports = {
  autoUpdater: mockAutoUpdater,
};
