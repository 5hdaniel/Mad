/**
 * Device Types for iOS Device Detection Service
 * Used for detecting connected iPhones via USB using libimobiledevice CLI tools.
 */

/**
 * Represents a connected iOS device with its properties.
 */
export interface iOSDevice {
  /** Unique Device Identifier (40-character hex string) */
  udid: string;
  /** User-defined device name (e.g., "John's iPhone") */
  name: string;
  /** Device model identifier (e.g., "iPhone14,2") */
  productType: string;
  /** iOS version (e.g., "17.0") */
  productVersion: string;
  /** Device serial number */
  serialNumber: string;
  /** Whether the device is currently connected */
  isConnected: boolean;
}

/**
 * Event emitted when a device is connected or disconnected.
 */
export interface DeviceEvent {
  /** Type of device event */
  type: "connected" | "disconnected";
  /** The device that triggered the event */
  device: iOSDevice;
}

/**
 * Result from listing connected devices.
 */
export interface ListDevicesResult {
  success: boolean;
  devices?: iOSDevice[];
  error?: string;
}

/**
 * Result from getting device info.
 */
export interface GetDeviceInfoResult {
  success: boolean;
  device?: iOSDevice;
  error?: string;
}
