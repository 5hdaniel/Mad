/**
 * Jest mock for Electron module
 * This mock is automatically used by Jest when tests import 'electron'
 */

module.exports = {
  app: {
    getPath: jest.fn((name) => {
      const paths = {
        userData: '/tmp/test-user-data',
        appData: '/tmp/test-app-data',
        home: '/tmp/test-home',
        temp: '/tmp',
        logs: '/tmp/test-logs',
      };
      return paths[name] || `/tmp/test-${name}`;
    }),
    getName: jest.fn(() => 'Keepr'),
    getVersion: jest.fn(() => '1.1.0'),
    isPackaged: false,
    quit: jest.fn(),
    on: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve()),
  },
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => true),
    encryptString: jest.fn((text) => Buffer.from(`encrypted:${text}`)),
    decryptString: jest.fn((buffer) => {
      const str = buffer.toString();
      return str.replace('encrypted:', '');
    }),
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeHandler: jest.fn(),
  },
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    send: jest.fn(),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    loadFile: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    close: jest.fn(),
    destroy: jest.fn(),
    webContents: {
      send: jest.fn(),
      on: jest.fn(),
      session: {
        webRequest: {
          onHeadersReceived: jest.fn(),
        },
      },
    },
  })),
  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
  shell: {
    openExternal: jest.fn(() => Promise.resolve()),
    openPath: jest.fn(() => Promise.resolve('')),
  },
  dialog: {
    showOpenDialog: jest.fn(() => Promise.resolve({ canceled: false, filePaths: [] })),
    showSaveDialog: jest.fn(() => Promise.resolve({ canceled: false, filePath: '' })),
    showMessageBox: jest.fn(() => Promise.resolve({ response: 0 })),
  },
  Menu: {
    buildFromTemplate: jest.fn(),
    setApplicationMenu: jest.fn(),
  },
  Tray: jest.fn(),
  nativeTheme: {
    shouldUseDarkColors: false,
    themeSource: 'system',
    on: jest.fn(),
  },
  systemPreferences: {
    isTrustedAccessibilityClient: jest.fn(() => true),
    getMediaAccessStatus: jest.fn(() => 'granted'),
  },
};
