/**
 * libimobiledevice Service
 * Locates and provides paths to libimobiledevice Windows binaries
 */

import path from 'path';
import { app } from 'electron';
import log from 'electron-log';

/**
 * Get the base path to the libimobiledevice binaries directory
 * @returns The absolute path to the libimobiledevice binaries directory
 * @throws Error if not running on Windows
 */
export function getLibimobiledevicePath(): string {
  if (process.platform !== 'win32') {
    throw new Error('libimobiledevice binaries only available on Windows');
  }

  const isDev = !app.isPackaged;

  if (isDev) {
    return path.join(__dirname, '../../resources/win/libimobiledevice');
  }

  return path.join(process.resourcesPath, 'win/libimobiledevice');
}

/**
 * Get the full path to a specific libimobiledevice executable
 * @param name - The name of the executable (without .exe extension)
 * @returns The absolute path to the executable
 * @throws Error if not running on Windows
 */
export function getExecutablePath(name: string): string {
  const basePath = getLibimobiledevicePath();
  const exePath = path.join(basePath, `${name}.exe`);
  log.debug(`[libimobiledeviceService] Resolved executable path: ${exePath}`);
  return exePath;
}

/**
 * Check if libimobiledevice binaries are available
 * @returns True if binaries directory exists and contains expected files
 */
export function areBinariesAvailable(): boolean {
  if (process.platform !== 'win32') {
    return false;
  }

  try {
    const basePath = getLibimobiledevicePath();
    const fs = require('fs');
    return fs.existsSync(basePath);
  } catch (error) {
    log.error('[libimobiledeviceService] Error checking binaries availability:', error);
    return false;
  }
}

/**
 * List of required executable names for libimobiledevice functionality
 */
export const REQUIRED_EXECUTABLES = [
  'idevice_id',
  'ideviceinfo',
  'idevicebackup2',
] as const;

export type LibimobiledeviceExecutable = typeof REQUIRED_EXECUTABLES[number];
