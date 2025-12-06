/**
 * Device Detection Service
 *
 * Detects connected iOS devices via USB using libimobiledevice CLI tools.
 * Emits events when devices are connected or disconnected.
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import log from 'electron-log';
import { iOSDevice } from '../types/device';

const execAsync = promisify(exec);

/** Minimum polling interval in milliseconds */
const MIN_POLL_INTERVAL_MS = 2000;

/** Mock device for development without Windows/iPhone */
const MOCK_DEVICE: iOSDevice = {
  udid: '00000000-0000000000000000',
  name: 'Mock iPhone',
  productType: 'iPhone14,2',
  productVersion: '17.0',
  serialNumber: 'MOCK123456789',
  isConnected: true,
};

/**
 * Service for detecting connected iOS devices via USB.
 *
 * Events:
 * - 'device-connected': Emitted when a new device is connected
 * - 'device-disconnected': Emitted when a device is disconnected
 *
 * @example
 * ```typescript
 * const service = new DeviceDetectionService();
 * service.on('device-connected', (device) => {
 *   console.log('Device connected:', device.name);
 * });
 * service.start();
 * ```
 */
export class DeviceDetectionService extends EventEmitter {
  private pollInterval: NodeJS.Timeout | null = null;
  private connectedDevices: Map<string, iOSDevice> = new Map();
  private isPolling: boolean = false;
  private mockMode: boolean = false;
  private libimobiledeviceAvailable: boolean | null = null;

  constructor() {
    super();
    this.mockMode = process.env.MOCK_DEVICE === 'true';

    if (this.mockMode) {
      log.info('[DeviceDetection] Running in mock mode');
    }
  }

  /**
   * Checks if libimobiledevice CLI tools are available.
   * @returns Promise that resolves to true if available
   */
  async checkLibimobiledeviceAvailable(): Promise<boolean> {
    if (this.libimobiledeviceAvailable !== null) {
      return this.libimobiledeviceAvailable;
    }

    try {
      await execAsync('idevice_id --version');
      this.libimobiledeviceAvailable = true;
      log.info('[DeviceDetection] libimobiledevice is available');
      return true;
    } catch {
      this.libimobiledeviceAvailable = false;
      log.warn('[DeviceDetection] libimobiledevice is not available - device detection will not work');
      return false;
    }
  }

  /**
   * Starts polling for connected devices.
   * @param intervalMs Polling interval in milliseconds (minimum 2000)
   */
  start(intervalMs: number = 2000): void {
    if (this.pollInterval) {
      log.warn('[DeviceDetection] Already running, stopping first');
      this.stop();
    }

    const actualInterval = Math.max(intervalMs, MIN_POLL_INTERVAL_MS);
    log.info(`[DeviceDetection] Starting device polling (interval: ${actualInterval}ms)`);

    // Do an immediate check
    this.pollDevices();

    // Set up regular polling
    this.pollInterval = setInterval(() => {
      this.pollDevices();
    }, actualInterval);
  }

  /**
   * Stops polling for devices.
   */
  stop(): void {
    if (this.pollInterval) {
      log.info('[DeviceDetection] Stopping device polling');
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Gets all currently connected devices.
   * @returns Array of connected devices
   */
  getConnectedDevices(): iOSDevice[] {
    return Array.from(this.connectedDevices.values());
  }

  /**
   * Polls for connected devices and emits appropriate events.
   */
  private async pollDevices(): Promise<void> {
    if (this.isPolling) {
      return; // Skip if previous poll is still running
    }

    this.isPolling = true;

    try {
      const currentUdids = await this.listDevices();
      const previousUdids = new Set(this.connectedDevices.keys());

      // Check for new devices
      for (const udid of currentUdids) {
        if (!previousUdids.has(udid)) {
          try {
            const deviceInfo = await this.getDeviceInfo(udid);
            this.connectedDevices.set(udid, deviceInfo);

            log.info(`[DeviceDetection] Device connected: ${deviceInfo.name} (${udid})`);
            this.emit('device-connected', deviceInfo);
          } catch (err) {
            log.error(`[DeviceDetection] Failed to get info for device ${udid}:`, err);
          }
        }
      }

      // Check for disconnected devices
      for (const udid of previousUdids) {
        if (!currentUdids.includes(udid)) {
          const device = this.connectedDevices.get(udid);
          if (device) {
            device.isConnected = false;
            this.connectedDevices.delete(udid);

            log.info(`[DeviceDetection] Device disconnected: ${device.name} (${udid})`);
            this.emit('device-disconnected', device);
          }
        }
      }
    } catch (err) {
      log.error('[DeviceDetection] Error polling devices:', err);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Lists UDIDs of all connected devices.
   * @returns Promise that resolves to array of device UDIDs
   */
  async listDevices(): Promise<string[]> {
    // Mock mode returns fake device
    if (this.mockMode) {
      return [MOCK_DEVICE.udid];
    }

    // Check if libimobiledevice is available
    const available = await this.checkLibimobiledeviceAvailable();
    if (!available) {
      return [];
    }

    return new Promise((resolve) => {
      const process = spawn('idevice_id', ['-l']);
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          if (stderr.trim()) {
            log.debug(`[DeviceDetection] idevice_id stderr: ${stderr.trim()}`);
          }
          // Non-zero exit with no devices is normal
          resolve([]);
          return;
        }

        const udids = stdout
          .trim()
          .split('\n')
          .filter((line) => line.trim().length > 0);

        resolve(udids);
      });

      process.on('error', (err) => {
        log.error('[DeviceDetection] Failed to spawn idevice_id:', err);
        resolve([]);
      });
    });
  }

  /**
   * Gets detailed information about a specific device.
   * @param udid Device unique identifier
   * @returns Promise that resolves to device information
   */
  async getDeviceInfo(udid: string): Promise<iOSDevice> {
    // Mock mode returns fake device info
    if (this.mockMode) {
      return { ...MOCK_DEVICE };
    }

    return new Promise((resolve, reject) => {
      const process = spawn('ideviceinfo', ['-u', udid]);
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ideviceinfo exited with code ${code}: ${stderr.trim()}`));
          return;
        }

        try {
          const device = this.parseDeviceInfo(udid, stdout);
          resolve(device);
        } catch (err) {
          reject(err);
        }
      });

      process.on('error', (err) => {
        reject(new Error(`Failed to spawn ideviceinfo: ${err.message}`));
      });
    });
  }

  /**
   * Parses the output of ideviceinfo command.
   * @param udid Device UDID
   * @param output Raw output from ideviceinfo
   * @returns Parsed device information
   */
  private parseDeviceInfo(udid: string, output: string): iOSDevice {
    const lines = output.split('\n');
    const info: Record<string, string> = {};

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        info[key] = value;
      }
    }

    return {
      udid,
      name: info['DeviceName'] || 'Unknown Device',
      productType: info['ProductType'] || 'Unknown',
      productVersion: info['ProductVersion'] || 'Unknown',
      serialNumber: info['SerialNumber'] || 'Unknown',
      isConnected: true,
    };
  }
}

// Export singleton instance
export const deviceDetectionService = new DeviceDetectionService();
