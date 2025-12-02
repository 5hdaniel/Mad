/**
 * libimobiledevice Binary Locator Service
 *
 * Provides utility functions to locate and access libimobiledevice CLI tools
 * (idevice_id, ideviceinfo, idevicebackup2) bundled with the application.
 *
 * On Windows, these are bundled as .exe files in resources/win/libimobiledevice/
 * On macOS/Linux, they're expected to be installed system-wide.
 */

import path from 'path';
import { app } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import log from 'electron-log';

const execAsync = promisify(exec);

/**
 * Check if running in mock mode for development without actual device
 */
export function isMockMode(): boolean {
  return process.env.MOCK_DEVICE === 'true';
}

/**
 * Get the directory containing libimobiledevice binaries on Windows
 * @returns Path to the libimobiledevice directory
 * @throws Error if not on Windows
 */
export function getLibimobiledevicePath(): string {
  if (process.platform !== 'win32') {
    // On macOS/Linux, tools are expected to be in PATH
    return '';
  }

  const isDev = !app.isPackaged;

  if (isDev) {
    return path.join(__dirname, '../../resources/win/libimobiledevice');
  }

  return path.join(process.resourcesPath, 'win/libimobiledevice');
}

/**
 * Get the full path to a specific libimobiledevice executable
 * @param name - Name of the executable (e.g., 'idevice_id', 'idevicebackup2')
 * @returns Full path to the executable
 */
export function getExecutablePath(name: string): string {
  if (process.platform === 'win32') {
    return path.join(getLibimobiledevicePath(), `${name}.exe`);
  }

  // On macOS/Linux, just return the command name (should be in PATH)
  return name;
}

/**
 * Check if libimobiledevice tools are available
 * @returns Object indicating which tools are available
 */
export async function checkToolsAvailability(): Promise<{
  available: boolean;
  ideviceId: boolean;
  ideviceInfo: boolean;
  ideviceBackup2: boolean;
  error: string | null;
}> {
  const result = {
    available: false,
    ideviceId: false,
    ideviceInfo: false,
    ideviceBackup2: false,
    error: null as string | null
  };

  if (isMockMode()) {
    return {
      available: true,
      ideviceId: true,
      ideviceInfo: true,
      ideviceBackup2: true,
      error: null
    };
  }

  try {
    // Check idevice_id
    const ideviceIdPath = getExecutablePath('idevice_id');
    try {
      await execAsync(`"${ideviceIdPath}" --help`);
      result.ideviceId = true;
    } catch {
      log.debug('[libimobiledevice] idevice_id not available');
    }

    // Check ideviceinfo
    const ideviceInfoPath = getExecutablePath('ideviceinfo');
    try {
      await execAsync(`"${ideviceInfoPath}" --help`);
      result.ideviceInfo = true;
    } catch {
      log.debug('[libimobiledevice] ideviceinfo not available');
    }

    // Check idevicebackup2
    const ideviceBackup2Path = getExecutablePath('idevicebackup2');
    try {
      await execAsync(`"${ideviceBackup2Path}" --help`);
      result.ideviceBackup2 = true;
    } catch {
      log.debug('[libimobiledevice] idevicebackup2 not available');
    }

    result.available = result.ideviceId && result.ideviceInfo && result.ideviceBackup2;

    if (!result.available) {
      result.error = 'Some libimobiledevice tools are not available';
    }
  } catch (error) {
    result.error = (error as Error).message;
    log.error('[libimobiledevice] Error checking tool availability:', error);
  }

  return result;
}

/**
 * Run a libimobiledevice command and return output
 * @param command - The command name (e.g., 'idevice_id')
 * @param args - Command arguments
 * @returns Command output
 */
export async function runCommand(
  command: string,
  args: string[] = []
): Promise<{ stdout: string; stderr: string }> {
  const executablePath = getExecutablePath(command);
  const fullCommand = `"${executablePath}" ${args.map(a => `"${a}"`).join(' ')}`;

  log.debug(`[libimobiledevice] Running: ${fullCommand}`);

  const result = await execAsync(fullCommand);
  return result;
}
