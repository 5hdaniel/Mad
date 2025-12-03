/**
 * Unit tests for DeviceDetectionService
 * Tests iOS device detection functionality via libimobiledevice CLI tools
 */

import { EventEmitter } from 'events';

// Mock child_process before importing the service
const mockSpawn = jest.fn();
const mockExec = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
  exec: (...args: unknown[]) => mockExec(...args),
}));

// Mock electron-log
jest.mock('electron-log', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Import after mocks are set up
import { DeviceDetectionService } from '../deviceDetectionService';
import log from 'electron-log';

// Helper to create a mock process
function createMockProcess() {
  const process = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  process.stdout = new EventEmitter();
  process.stderr = new EventEmitter();
  return process;
}

describe('DeviceDetectionService', () => {
  let service: DeviceDetectionService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    originalEnv = { ...process.env };
    delete process.env.MOCK_DEVICE;
    service = new DeviceDetectionService();
  });

  afterEach(() => {
    service.stop();
    jest.useRealTimers();
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should create instance without mock mode by default', () => {
      expect(service).toBeDefined();
      expect(service.getConnectedDevices()).toEqual([]);
    });

    it('should enable mock mode when MOCK_DEVICE=true', () => {
      process.env.MOCK_DEVICE = 'true';
      const mockService = new DeviceDetectionService();
      expect(log.info).toHaveBeenCalledWith('[DeviceDetection] Running in mock mode');
      mockService.stop();
    });
  });

  describe('checkLibimobiledeviceAvailable', () => {
    it('should return true when idevice_id is available', async () => {
      mockExec.mockImplementation((cmd, callback) => {
        callback(null, { stdout: '1.3.0', stderr: '' });
      });

      const result = await service.checkLibimobiledeviceAvailable();
      expect(result).toBe(true);
      expect(log.info).toHaveBeenCalledWith('[DeviceDetection] libimobiledevice is available');
    });

    it('should return false when idevice_id is not available', async () => {
      mockExec.mockImplementation((cmd, callback) => {
        callback(new Error('command not found'));
      });

      const result = await service.checkLibimobiledeviceAvailable();
      expect(result).toBe(false);
      expect(log.warn).toHaveBeenCalledWith(
        '[DeviceDetection] libimobiledevice is not available - device detection will not work'
      );
    });

    it('should cache the availability check result', async () => {
      mockExec.mockImplementation((cmd, callback) => {
        callback(null, { stdout: '1.3.0', stderr: '' });
      });

      await service.checkLibimobiledeviceAvailable();
      await service.checkLibimobiledeviceAvailable();

      expect(mockExec).toHaveBeenCalledTimes(1);
    });
  });

  describe('start/stop', () => {
    it('should start polling for devices', () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      service.start(2000);

      expect(log.info).toHaveBeenCalledWith(
        '[DeviceDetection] Starting device polling (interval: 2000ms)'
      );

      // Simulate empty device list
      setTimeout(() => {
        mockProcess.stdout.emit('data', '');
        mockProcess.emit('close', 0);
      }, 0);
    });

    it('should enforce minimum polling interval of 2000ms', () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      service.start(500); // Try to start with 500ms

      expect(log.info).toHaveBeenCalledWith(
        '[DeviceDetection] Starting device polling (interval: 2000ms)'
      );
    });

    it('should stop polling when stop is called', () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      service.start();
      service.stop();

      expect(log.info).toHaveBeenCalledWith('[DeviceDetection] Stopping device polling');
    });

    it('should stop existing polling before starting new', () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      service.start();
      service.start();

      expect(log.warn).toHaveBeenCalledWith('[DeviceDetection] Already running, stopping first');
    });
  });

  describe('listDevices', () => {
    it('should return empty array when no devices are connected', async () => {
      // Mock availability check
      mockExec.mockImplementation((cmd, callback) => {
        callback(null, { stdout: '1.3.0', stderr: '' });
      });

      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const promise = service.listDevices();

      // Simulate empty output
      mockProcess.stdout.emit('data', '');
      mockProcess.emit('close', 0);

      const devices = await promise;
      expect(devices).toEqual([]);
    });

    it('should return device UDIDs when devices are connected', async () => {
      // Mock availability check
      mockExec.mockImplementation((cmd, callback) => {
        callback(null, { stdout: '1.3.0', stderr: '' });
      });

      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const promise = service.listDevices();

      // Simulate device list output
      mockProcess.stdout.emit('data', '00000000-0000000000000001\n00000000-0000000000000002\n');
      mockProcess.emit('close', 0);

      const devices = await promise;
      expect(devices).toEqual([
        '00000000-0000000000000001',
        '00000000-0000000000000002',
      ]);
    });

    it('should return mock device in mock mode', async () => {
      process.env.MOCK_DEVICE = 'true';
      const mockService = new DeviceDetectionService();

      const devices = await mockService.listDevices();
      expect(devices).toEqual(['00000000-0000000000000000']);

      mockService.stop();
    });
  });

  describe('getDeviceInfo', () => {
    it('should parse device info from ideviceinfo output', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const promise = service.getDeviceInfo('test-udid');

      // Simulate ideviceinfo output
      mockProcess.stdout.emit('data', `DeviceName: Test iPhone
ProductType: iPhone14,2
ProductVersion: 17.0
SerialNumber: ABC123456789
`);
      mockProcess.emit('close', 0);

      const device = await promise;
      expect(device).toEqual({
        udid: 'test-udid',
        name: 'Test iPhone',
        productType: 'iPhone14,2',
        productVersion: '17.0',
        serialNumber: 'ABC123456789',
        isConnected: true,
      });
    });

    it('should return mock device info in mock mode', async () => {
      process.env.MOCK_DEVICE = 'true';
      const mockService = new DeviceDetectionService();

      const device = await mockService.getDeviceInfo('test-udid');
      expect(device.name).toBe('Mock iPhone');
      expect(device.productType).toBe('iPhone14,2');

      mockService.stop();
    });

    it('should reject when ideviceinfo fails', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const promise = service.getDeviceInfo('test-udid');

      mockProcess.stderr.emit('data', 'Device not found');
      mockProcess.emit('close', 1);

      await expect(promise).rejects.toThrow('ideviceinfo exited with code 1');
    });
  });

  describe('event emission', () => {
    it('should emit device-connected when new device is detected', async () => {
      // Mock availability check
      mockExec.mockImplementation((cmd, callback) => {
        callback(null, { stdout: '1.3.0', stderr: '' });
      });

      const connectedCallback = jest.fn();
      service.on('device-connected', connectedCallback);

      // Mock list devices
      const listProcess = createMockProcess();
      const infoProcess = createMockProcess();

      mockSpawn.mockImplementation((cmd) => {
        if (cmd === 'idevice_id') {
          return listProcess;
        }
        return infoProcess;
      });

      // Start service - this will trigger immediate poll
      service.start(2000);

      // Simulate device being found
      listProcess.stdout.emit('data', 'test-udid\n');
      listProcess.emit('close', 0);

      // Wait for the info request
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate device info response
      infoProcess.stdout.emit('data', `DeviceName: Test iPhone
ProductType: iPhone14,2
ProductVersion: 17.0
SerialNumber: ABC123456789
`);
      infoProcess.emit('close', 0);

      // Wait for event emission
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(connectedCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          udid: 'test-udid',
          name: 'Test iPhone',
        })
      );
    });
  });

  describe('getConnectedDevices', () => {
    it('should return empty array initially', () => {
      expect(service.getConnectedDevices()).toEqual([]);
    });
  });
});
