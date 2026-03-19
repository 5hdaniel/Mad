/**
 * Device Detection Service
 *
 * Detects connected iOS devices via USB using libimobiledevice CLI tools.
 * Emits events when devices are connected or disconnected.
 */

import { spawn, exec } from "child_process";
import { promisify } from "util";
import { EventEmitter } from "events";
import log from "electron-log";
import * as Sentry from "@sentry/electron/main";
import { iOSDevice, DeviceStorageInfo } from "../types/device";
import { getCommand, canUseLibimobiledevice } from "./libimobiledeviceService";
import { validateDeviceUdid, isValidDeviceUdid, ValidationError } from "../utils/validation";

const execAsync = promisify(exec);

/** Minimum polling interval in milliseconds */
const MIN_POLL_INTERVAL_MS = 2000;

/** Mock device for development without Windows/iPhone */
const MOCK_DEVICE: iOSDevice = {
  udid: "00000000-0000000000000000",
  name: "Mock iPhone",
  productType: "iPhone14,2",
  productVersion: "17.0",
  serialNumber: "MOCK123456789",
  isConnected: true,
};

/**
 * Structured result from a single diagnostic step.
 */
export interface DiagnosticStep {
  name: string;
  status: "pass" | "fail" | "skip";
  durationMs: number;
  detail?: string;
  error?: string;
}

/**
 * Full diagnostic chain result for device detection troubleshooting.
 * Used by startup health checks and settings diagnostic panels.
 */
export interface DeviceDetectionDiagnostic {
  timestamp: string;
  platform: string;
  steps: DiagnosticStep[];
  overallStatus: "success" | "partial" | "failed";
  connectedDeviceCount: number;
}

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
    this.mockMode = process.env.MOCK_DEVICE === "true";

    if (this.mockMode) {
      log.info("[DeviceDetection] Running in mock mode");
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

    // First check if we can use libimobiledevice at all (platform/mock check)
    if (!canUseLibimobiledevice()) {
      this.libimobiledeviceAvailable = false;
      log.warn(
        "[DeviceDetection] libimobiledevice not available on this platform",
      );
      return false;
    }

    try {
      const ideviceIdCmd = getCommand("idevice_id");
      log.info(`[DeviceDetection] Checking libimobiledevice at: ${ideviceIdCmd}`);
      await execAsync(`"${ideviceIdCmd}" --version`);
      this.libimobiledeviceAvailable = true;
      log.info("[DeviceDetection] libimobiledevice is available");
      return true;
    } catch (err) {
      this.libimobiledeviceAvailable = false;
      log.warn(
        "[DeviceDetection] libimobiledevice is not available - device detection will not work",
        err,
      );
      return false;
    }
  }

  /**
   * Starts polling for connected devices.
   * @param intervalMs Polling interval in milliseconds (minimum 2000)
   */
  start(intervalMs: number = 2000): void {
    if (this.pollInterval) {
      log.warn("[DeviceDetection] Already running, stopping first");
      this.stop();
    }

    const actualInterval = Math.max(intervalMs, MIN_POLL_INTERVAL_MS);
    log.info(
      `[DeviceDetection] Starting device polling (interval: ${actualInterval}ms)`,
    );

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
      log.info("[DeviceDetection] Stopping device polling");
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
   * Run full diagnostic chain for troubleshooting device detection issues.
   * Reports each step to Sentry as breadcrumbs.
   * Called by startup health checks (TASK-2275) and settings diagnostics (TASK-2276).
   */
  async runDiagnosticChain(): Promise<DeviceDetectionDiagnostic> {
    const steps: DiagnosticStep[] = [];
    let connectedDeviceCount = 0;

    // Step 1: Platform check
    const platformStart = Date.now();
    const platformSupported =
      process.platform === "win32" || process.platform === "darwin";
    const platformStep: DiagnosticStep = {
      name: "platform_check",
      status: platformSupported ? "pass" : "fail",
      durationMs: Date.now() - platformStart,
      detail: `Platform: ${process.platform}`,
    };
    if (!platformSupported) {
      platformStep.error = `Unsupported platform: ${process.platform}`;
    }
    steps.push(platformStep);

    Sentry.addBreadcrumb({
      category: "diagnostics.device",
      message: `Platform check: ${platformStep.status}`,
      level: platformStep.status === "pass" ? "info" : "warning",
      data: { platform: process.platform },
    });

    // Step 2: libimobiledevice availability
    const toolStart = Date.now();
    let toolAvailable = false;
    const toolStep: DiagnosticStep = {
      name: "libimobiledevice_check",
      status: "fail",
      durationMs: 0,
    };

    if (!platformSupported) {
      toolStep.status = "skip";
      toolStep.detail = "Skipped: platform not supported";
    } else {
      try {
        // Reset cached value so we do a fresh check
        this.libimobiledeviceAvailable = null;
        toolAvailable = await this.checkLibimobiledeviceAvailable();
        toolStep.status = toolAvailable ? "pass" : "fail";
        toolStep.detail = toolAvailable
          ? "libimobiledevice is available"
          : "libimobiledevice not found";
        if (!toolAvailable) {
          toolStep.error = "libimobiledevice CLI tools not available";
        }
      } catch (err) {
        toolStep.status = "fail";
        toolStep.error =
          err instanceof Error ? err.message : "Unknown error checking tools";
      }
    }
    toolStep.durationMs = Date.now() - toolStart;
    steps.push(toolStep);

    Sentry.addBreadcrumb({
      category: "diagnostics.device",
      message: `libimobiledevice check: ${toolStep.status}`,
      level: toolStep.status === "pass" ? "info" : "warning",
      data: { available: toolAvailable },
    });

    // Step 3: Device enumeration
    const enumStart = Date.now();
    const enumStep: DiagnosticStep = {
      name: "device_enumeration",
      status: "fail",
      durationMs: 0,
    };
    let deviceUdids: string[] = [];

    if (!toolAvailable) {
      enumStep.status = "skip";
      enumStep.detail = "Skipped: libimobiledevice not available";
    } else {
      try {
        deviceUdids = await this.listDevices();
        enumStep.status = deviceUdids.length > 0 ? "pass" : "fail";
        enumStep.detail = `Found ${deviceUdids.length} device(s)`;
        if (deviceUdids.length === 0) {
          enumStep.error = "No devices detected via USB";
        }
      } catch (err) {
        enumStep.status = "fail";
        enumStep.error =
          err instanceof Error
            ? err.message
            : "Unknown error enumerating devices";
      }
    }
    enumStep.durationMs = Date.now() - enumStart;
    steps.push(enumStep);

    Sentry.addBreadcrumb({
      category: "diagnostics.device",
      message: `Device enumeration: ${enumStep.status}`,
      level: enumStep.status === "pass" ? "info" : "warning",
      data: { deviceCount: deviceUdids.length },
    });

    // Step 4: Device info (if devices found)
    const infoStart = Date.now();
    const infoStep: DiagnosticStep = {
      name: "device_info",
      status: "fail",
      durationMs: 0,
    };

    if (deviceUdids.length === 0) {
      infoStep.status = "skip";
      infoStep.detail = "Skipped: no devices to query";
    } else {
      try {
        let successCount = 0;
        for (const udid of deviceUdids) {
          try {
            await this.getDeviceInfo(udid);
            successCount++;
          } catch {
            // Individual device info failure is non-fatal
          }
        }
        connectedDeviceCount = successCount;
        infoStep.status = successCount > 0 ? "pass" : "fail";
        infoStep.detail = `Got info for ${successCount}/${deviceUdids.length} device(s)`;
        if (successCount === 0) {
          infoStep.error = "Failed to get info for any device";
        }
      } catch (err) {
        infoStep.status = "fail";
        infoStep.error =
          err instanceof Error
            ? err.message
            : "Unknown error getting device info";
      }
    }
    infoStep.durationMs = Date.now() - infoStart;
    steps.push(infoStep);

    Sentry.addBreadcrumb({
      category: "diagnostics.device",
      message: `Device info: ${infoStep.status}`,
      level: infoStep.status === "pass" ? "info" : "warning",
      data: { connectedDeviceCount },
    });

    // Determine overall status
    const passCount = steps.filter((s) => s.status === "pass").length;
    const failCount = steps.filter((s) => s.status === "fail").length;
    let overallStatus: "success" | "partial" | "failed";
    if (failCount === 0) {
      overallStatus = "success";
    } else if (passCount > 0) {
      overallStatus = "partial";
    } else {
      overallStatus = "failed";
    }

    // Summary breadcrumb
    Sentry.addBreadcrumb({
      category: "diagnostics.device",
      message: `Device detection diagnostic: ${overallStatus}`,
      level: overallStatus === "success" ? "info" : "warning",
      data: {
        steps: steps.map((s) => ({ name: s.name, status: s.status })),
      },
    });

    // Report failure to Sentry
    if (overallStatus === "failed") {
      Sentry.captureMessage("Device detection diagnostic failed", {
        level: "warning",
        tags: { platform: process.platform, diagnostic: "device_detection" },
        extra: { steps, connectedDeviceCount: 0 },
      });
    }

    return {
      timestamp: new Date().toISOString(),
      platform: process.platform,
      steps,
      overallStatus,
      connectedDeviceCount,
    };
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
          log.info(`[DeviceDetection] New device found: ${udid}, fetching info...`);
          try {
            const deviceInfo = await this.getDeviceInfo(udid);
            this.connectedDevices.set(udid, deviceInfo);

            log.info(
              `[DeviceDetection] Device connected: ${deviceInfo.name} (${udid})`,
            );
            Sentry.addBreadcrumb({
              category: "device.connect",
              message: `Device connected: ${deviceInfo.name} (${deviceInfo.productType})`,
              level: "info",
              data: { udid: udid.substring(0, 8) + "...", productType: deviceInfo.productType },
            });
            this.emit("device-connected", deviceInfo);
          } catch (err) {
            log.error(
              `[DeviceDetection] Failed to get info for device ${udid}:`,
              err,
            );
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

            log.info(
              `[DeviceDetection] Device disconnected: ${device.name} (${udid})`,
            );
            Sentry.addBreadcrumb({
              category: "device.disconnect",
              message: `Device disconnected: ${device.name} (${device.productType})`,
              level: "info",
              data: { udid: udid.substring(0, 8) + "...", productType: device.productType },
            });
            this.emit("device-disconnected", device);
          }
        }
      }
    } catch (err) {
      log.error("[DeviceDetection] Error polling devices:", err);
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
      const ideviceIdCmd = getCommand("idevice_id");
      // Don't log every poll - too noisy (runs every 2 seconds)
      const proc = spawn(ideviceIdCmd, ["-l"]);
      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          if (stderr.trim()) {
            log.debug(`[DeviceDetection] idevice_id stderr: ${stderr.trim()}`);
            Sentry.addBreadcrumb({
              category: "device.detection",
              message: `idevice_id failed with code ${code}`,
              level: "warning",
              data: { exitCode: code, stderr: stderr.substring(0, 200) },
            });
          }
          // Non-zero exit with no devices is normal
          resolve([]);
          return;
        }

        const rawUdids = stdout
          .trim()
          .split("\n")
          .filter((line) => line.trim().length > 0);

        // SECURITY (TASK-601): Validate UDIDs returned from idevice_id
        // While this command is trusted, we validate its output as defense-in-depth
        // before using these UDIDs in subsequent spawn calls (getDeviceInfo, etc.)
        const validUdids = rawUdids.filter((udid) => {
          const valid = isValidDeviceUdid(udid);
          if (!valid) {
            log.warn(`[DeviceDetection] Ignoring invalid UDID format: ${udid}`);
          }
          return valid;
        });

        // Only log device count changes, not every poll
        // The pollDevices() method will log when devices connect/disconnect
        resolve(validUdids);
      });

      proc.on("error", (err) => {
        log.error("[DeviceDetection] Failed to spawn idevice_id:", err);
        resolve([]);
      });
    });
  }

  /**
   * Gets detailed information about a specific device.
   * @param udid Device unique identifier
   * @returns Promise that resolves to device information
   *
   * SECURITY (TASK-601): UDID is validated before use in spawn() to prevent
   * command injection. The UDID can come from listDevices() output or from
   * external callers via IPC.
   */
  async getDeviceInfo(udid: string): Promise<iOSDevice> {
    // Mock mode returns fake device info
    if (this.mockMode) {
      return { ...MOCK_DEVICE };
    }

    // SECURITY: Validate UDID before spawning process
    let validatedUdid: string;
    try {
      validatedUdid = validateDeviceUdid(udid);
    } catch (error) {
      log.error("[DeviceDetection] Invalid UDID:", error);
      throw new Error(
        error instanceof ValidationError
          ? error.message
          : "Invalid device UDID format",
      );
    }

    return new Promise((resolve, reject) => {
      const ideviceinfoCmd = getCommand("ideviceinfo");
      log.debug(`[DeviceDetection] Running: ${ideviceinfoCmd} -u ${validatedUdid}`);
      const proc = spawn(ideviceinfoCmd, ["-u", validatedUdid]);
      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(`ideviceinfo exited with code ${code}: ${stderr.trim()}`),
          );
          return;
        }

        try {
          const device = this.parseDeviceInfo(udid, stdout);
          resolve(device);
        } catch (err) {
          reject(err);
        }
      });

      proc.on("error", (err) => {
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
    const lines = output.split("\n");
    const info: Record<string, string> = {};

    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        info[key] = value;
      }
    }

    return {
      udid,
      name: info["DeviceName"] || "Unknown Device",
      productType: info["ProductType"] || "Unknown",
      productVersion: info["ProductVersion"] || "Unknown",
      serialNumber: info["SerialNumber"] || "Unknown",
      isConnected: true,
    };
  }

  /**
   * Gets device storage information for estimating backup size.
   * Uses ideviceinfo -q com.apple.disk_usage to query disk usage.
   * @param udid Device UDID
   * @returns Storage info with estimated backup size
   *
   * SECURITY (TASK-601): UDID is validated before use in spawn() to prevent
   * command injection.
   */
  async getDeviceStorageInfo(udid: string): Promise<DeviceStorageInfo | null> {
    try {
      // SECURITY: Validate UDID before spawning process
      let validatedUdid: string;
      try {
        validatedUdid = validateDeviceUdid(udid);
      } catch (error) {
        log.error("[DeviceDetection] Invalid UDID for storage info:", error);
        return null;
      }

      const ideviceinfoCmd = getCommand("ideviceinfo");
      log.debug(`[DeviceDetection] Getting storage info for device: ${validatedUdid}`);

      return new Promise((resolve) => {
        // Query disk usage domain for storage information
        // SECURITY: validatedUdid has been validated
        const proc = spawn(ideviceinfoCmd, ["-u", validatedUdid, "-q", "com.apple.disk_usage"]);
        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        proc.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        proc.on("close", (code) => {
          if (code !== 0) {
            log.warn(`[DeviceDetection] Failed to get storage info: ${stderr}`);
            resolve(null);
            return;
          }

          try {
            const storageInfo = this.parseStorageInfo(stdout);
            log.info(`[DeviceDetection] Storage info: ${JSON.stringify(storageInfo)}`);
            resolve(storageInfo);
          } catch (err) {
            log.error("[DeviceDetection] Failed to parse storage info:", err);
            resolve(null);
          }
        });

        proc.on("error", (err) => {
          log.error("[DeviceDetection] Failed to spawn ideviceinfo for storage:", err);
          resolve(null);
        });
      });
    } catch (err) {
      log.error("[DeviceDetection] Exception getting storage info:", err);
      return null;
    }
  }

  /**
   * Parses storage information from ideviceinfo disk_usage output.
   *
   * Common fields returned by ideviceinfo -q com.apple.disk_usage:
   * - TotalDataCapacity: Total device storage capacity in bytes
   * - TotalDataAvailable: Available free space in bytes
   * - TotalDiskCapacity: Total disk capacity (may be same as TotalDataCapacity)
   * - TotalSystemAvailable: System available space
   * - TotalSystemCapacity: System capacity
   *
   * @param output Raw output from ideviceinfo -q com.apple.disk_usage
   * @returns Parsed storage info with estimated backup size
   */
  private parseStorageInfo(output: string): DeviceStorageInfo {
    const lines = output.split("\n");
    const info: Record<string, string> = {};

    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        info[key] = value;
      }
    }

    // Log all available fields for debugging
    log.debug("[DeviceDetection] Storage info raw fields:", info);

    // Try multiple field names as they may vary by iOS version
    const totalCapacity = parseInt(
      info["TotalDataCapacity"] || info["TotalDiskCapacity"] || "0",
      10
    );
    const availableSpace = parseInt(
      info["TotalDataAvailable"] || info["TotalSystemAvailable"] || "0",
      10
    );
    const usedSpace = totalCapacity - availableSpace;

    log.info(`[DeviceDetection] Storage: total=${Math.round(totalCapacity / 1024 / 1024 / 1024)}GB, available=${Math.round(availableSpace / 1024 / 1024 / 1024)}GB, used=${Math.round(usedSpace / 1024 / 1024 / 1024)}GB`);

    // Estimate backup size based on used space
    // NOTE: This estimate is only used for first-time backups (no existing backup to reference)
    // Real-world observations:
    // - Encrypted backups include much more data than unencrypted
    // - Photos, messages with attachments can be very large
    // - "Used space" from iOS disk_usage may not include all backed-up data
    // We use a conservative high estimate to avoid underestimating
    // (Better to overestimate disk space needed than underestimate)
    const BACKUP_SIZE_RATIO = 1.5; // 150% of "used" space - iOS reports usage conservatively
    const estimatedBackupSize = Math.round(usedSpace * BACKUP_SIZE_RATIO);

    log.info(`[DeviceDetection] Estimated backup size: ${Math.round(estimatedBackupSize / 1024 / 1024)} MB (${BACKUP_SIZE_RATIO * 100}% of used space)`);

    return {
      totalCapacity,
      availableSpace,
      usedSpace,
      estimatedBackupSize,
    };
  }
}

// Export singleton instance
export const deviceDetectionService = new DeviceDetectionService();
