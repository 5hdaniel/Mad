"use strict";
/**
 * Apple Driver Service
 *
 * Detects and installs Apple Mobile Device Support drivers on Windows.
 * These drivers are required for USB communication with iPhones.
 *
 * The drivers are bundled with the app but only installed with user consent.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAppleDrivers = checkAppleDrivers;
exports.getBundledDriverPath = getBundledDriverPath;
exports.hasBundledDrivers = hasBundledDrivers;
exports.installAppleDrivers = installAppleDrivers;
exports.downloadAppleDrivers = downloadAppleDrivers;
exports.getITunesDownloadUrl = getITunesDownloadUrl;
exports.getITunesWebUrl = getITunesWebUrl;
exports.compareVersions = compareVersions;
exports.getBundledDriverVersion = getBundledDriverVersion;
exports.checkForDriverUpdate = checkForDriverUpdate;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const https_1 = __importDefault(require("https"));
const electron_1 = require("electron");
const electron_log_1 = __importDefault(require("electron-log"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// Apple iTunes download URL (contains the drivers we need)
const ITUNES_DOWNLOAD_URL = 'https://www.apple.com/itunes/download/win64';
// Directory to store downloaded drivers
function getDownloadedDriversPath() {
    return path_1.default.join(electron_1.app.getPath('userData'), 'apple-drivers');
}
/**
 * Check if Apple Mobile Device Support drivers are installed
 */
async function checkAppleDrivers() {
    if (process.platform !== 'win32') {
        return {
            isInstalled: true, // Not needed on non-Windows
            version: null,
            serviceRunning: true,
            error: null,
        };
    }
    try {
        // Check if Apple Mobile Device Support is installed via registry
        const registryCheck = await checkRegistry();
        // Check if the service exists and is running
        const serviceStatus = await checkAppleMobileDeviceService();
        return {
            isInstalled: registryCheck.installed,
            version: registryCheck.version,
            serviceRunning: serviceStatus,
            error: null,
        };
    }
    catch (error) {
        electron_log_1.default.error('[AppleDriverService] Error checking drivers:', error);
        return {
            isInstalled: false,
            version: null,
            serviceRunning: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
/**
 * Check Windows registry for Apple Mobile Device Support
 */
async function checkRegistry() {
    try {
        // Check 64-bit registry
        const { stdout } = await execAsync('reg query "HKLM\\SOFTWARE\\Apple Inc.\\Apple Mobile Device Support" /v Version', { timeout: 5000 });
        const versionMatch = stdout.match(/Version\s+REG_SZ\s+(.+)/);
        if (versionMatch) {
            return {
                installed: true,
                version: versionMatch[1].trim(),
            };
        }
    }
    catch {
        // Registry key doesn't exist - not installed
    }
    try {
        // Check 32-bit registry (WOW6432Node)
        const { stdout } = await execAsync('reg query "HKLM\\SOFTWARE\\WOW6432Node\\Apple Inc.\\Apple Mobile Device Support" /v Version', { timeout: 5000 });
        const versionMatch = stdout.match(/Version\s+REG_SZ\s+(.+)/);
        if (versionMatch) {
            return {
                installed: true,
                version: versionMatch[1].trim(),
            };
        }
    }
    catch {
        // Registry key doesn't exist - not installed
    }
    // Alternative check: look for the service executable
    try {
        const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
        const servicePath = path_1.default.join(programFiles, 'Common Files', 'Apple', 'Mobile Device Support', 'AppleMobileDeviceService.exe');
        if (fs_1.default.existsSync(servicePath)) {
            return { installed: true, version: null };
        }
    }
    catch {
        // File check failed
    }
    return { installed: false, version: null };
}
/**
 * Check if Apple Mobile Device Service is running
 */
async function checkAppleMobileDeviceService() {
    try {
        const { stdout } = await execAsync('sc query "Apple Mobile Device Service"', { timeout: 5000 });
        return stdout.includes('RUNNING');
    }
    catch {
        return false;
    }
}
/**
 * Get path to bundled Apple driver MSI
 * Checks both bundled resources and previously downloaded drivers
 */
function getBundledDriverPath() {
    // First, check for previously downloaded drivers
    const downloadedPath = getDownloadedDriverPath();
    if (downloadedPath) {
        electron_log_1.default.info('[AppleDriverService] Using downloaded driver at:', downloadedPath);
        return downloadedPath;
    }
    // Then check bundled resources
    const isDev = !electron_1.app.isPackaged;
    let basePath;
    if (isDev) {
        basePath = path_1.default.join(__dirname, '../../resources/win/apple-drivers');
    }
    else {
        basePath = path_1.default.join(process.resourcesPath, 'win/apple-drivers');
    }
    const msiPath = path_1.default.join(basePath, 'AppleMobileDeviceSupport64.msi');
    if (fs_1.default.existsSync(msiPath)) {
        return msiPath;
    }
    // Try alternative name
    const altPath = path_1.default.join(basePath, 'AppleMobileDeviceSupport.msi');
    if (fs_1.default.existsSync(altPath)) {
        return altPath;
    }
    electron_log_1.default.warn('[AppleDriverService] No driver MSI found (bundled or downloaded)');
    return null;
}
/**
 * Check if bundled drivers are available
 */
function hasBundledDrivers() {
    return getBundledDriverPath() !== null;
}
/**
 * Install Apple Mobile Device Support drivers
 * Requires user consent before calling this function
 *
 * @returns Installation result
 */
async function installAppleDrivers() {
    if (process.platform !== 'win32') {
        return {
            success: false,
            error: 'Driver installation only supported on Windows',
            rebootRequired: false,
        };
    }
    const msiPath = getBundledDriverPath();
    if (!msiPath) {
        return {
            success: false,
            error: 'Apple driver package not found. Please install iTunes from the Microsoft Store.',
            rebootRequired: false,
        };
    }
    electron_log_1.default.info('[AppleDriverService] Installing Apple drivers from:', msiPath);
    try {
        // Run MSI installer silently
        // /qn = quiet, no UI
        // /norestart = don't restart automatically
        // REBOOT=ReallySuppress = suppress reboot prompts
        const result = await runMsiInstaller(msiPath);
        if (result.success) {
            electron_log_1.default.info('[AppleDriverService] Driver installation completed');
            // Start the service if it's not running
            await startAppleMobileDeviceService();
        }
        return result;
    }
    catch (error) {
        electron_log_1.default.error('[AppleDriverService] Installation failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Installation failed',
            rebootRequired: false,
        };
    }
}
/**
 * Run MSI installer with elevated privileges using PowerShell
 * This triggers the UAC prompt for admin elevation
 */
function runMsiInstaller(msiPath) {
    return new Promise((resolve) => {
        // Build msiexec arguments
        const msiArgs = `/i "${msiPath}" /qn /norestart REBOOT=ReallySuppress`;
        // Use PowerShell Start-Process with -Verb RunAs to trigger UAC elevation
        // -Wait ensures we wait for the installation to complete
        // -PassThru returns the process object so we can get the exit code
        const psCommand = `
      $process = Start-Process -FilePath "msiexec.exe" -ArgumentList '${msiArgs}' -Verb RunAs -Wait -PassThru
      exit $process.ExitCode
    `.trim();
        electron_log_1.default.info('[AppleDriverService] Running elevated installer via PowerShell');
        electron_log_1.default.info('[AppleDriverService] msiexec args:', msiArgs);
        const installer = (0, child_process_1.spawn)('powershell', ['-Command', psCommand], {
            shell: false,
        });
        let stderr = '';
        let stdout = '';
        installer.stdout?.on('data', (data) => {
            stdout += data.toString();
        });
        installer.stderr?.on('data', (data) => {
            stderr += data.toString();
        });
        installer.on('close', (code) => {
            electron_log_1.default.info('[AppleDriverService] Installer exited with code:', code);
            electron_log_1.default.info('[AppleDriverService] stdout:', stdout);
            if (stderr)
                electron_log_1.default.info('[AppleDriverService] stderr:', stderr);
            if (code === 0) {
                resolve({
                    success: true,
                    error: null,
                    rebootRequired: false,
                });
            }
            else if (code === 3010) {
                // 3010 = ERROR_SUCCESS_REBOOT_REQUIRED
                resolve({
                    success: true,
                    error: null,
                    rebootRequired: true,
                });
            }
            else if (code === 1602 || code === 1) {
                // 1602 = ERROR_INSTALL_USEREXIT (user cancelled UAC or installer)
                // 1 = PowerShell error, often from cancelled UAC
                resolve({
                    success: false,
                    error: null,
                    rebootRequired: false,
                    cancelled: true,
                });
            }
            else if (code === 1603) {
                // 1603 = ERROR_INSTALL_FAILURE
                resolve({
                    success: false,
                    error: 'Installation failed. The installer encountered an error.',
                    rebootRequired: false,
                });
            }
            else {
                resolve({
                    success: false,
                    error: `Installation failed with code ${code}. ${stderr}`.trim(),
                    rebootRequired: false,
                });
            }
        });
        installer.on('error', (error) => {
            electron_log_1.default.error('[AppleDriverService] Failed to start installer:', error);
            resolve({
                success: false,
                error: `Failed to start installer: ${error.message}`,
                rebootRequired: false,
            });
        });
    });
}
/**
 * Start Apple Mobile Device Service
 */
async function startAppleMobileDeviceService() {
    try {
        await execAsync('net start "Apple Mobile Device Service"', { timeout: 30000 });
        electron_log_1.default.info('[AppleDriverService] Apple Mobile Device Service started');
    }
    catch (error) {
        // Service might already be running or might need a reboot
        electron_log_1.default.warn('[AppleDriverService] Could not start service:', error);
    }
}
/**
 * Download a file from URL to destination
 */
function downloadFile(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
        const file = fs_1.default.createWriteStream(destPath);
        const request = https_1.default.get(url, (response) => {
            // Handle redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
                const redirectUrl = response.headers.location;
                if (redirectUrl) {
                    file.close();
                    fs_1.default.unlinkSync(destPath);
                    downloadFile(redirectUrl, destPath, onProgress).then(resolve).catch(reject);
                    return;
                }
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
                return;
            }
            const totalSize = parseInt(response.headers['content-length'] || '0', 10);
            let downloadedSize = 0;
            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (onProgress && totalSize > 0) {
                    onProgress(Math.round((downloadedSize / totalSize) * 100));
                }
            });
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        });
        request.on('error', (err) => {
            fs_1.default.unlink(destPath, () => { }); // Delete partial file
            reject(err);
        });
        file.on('error', (err) => {
            fs_1.default.unlink(destPath, () => { }); // Delete partial file
            reject(err);
        });
    });
}
/**
 * Get path to bundled 7za.exe (standalone 7-Zip CLI)
 */
function getBundled7za() {
    const isDev = !electron_1.app.isPackaged;
    let basePath;
    if (isDev) {
        basePath = path_1.default.join(__dirname, '../../resources/win');
    }
    else {
        basePath = path_1.default.join(process.resourcesPath, 'win');
    }
    const sevenZaPath = path_1.default.join(basePath, '7za.exe');
    if (fs_1.default.existsSync(sevenZaPath)) {
        return sevenZaPath;
    }
    return null;
}
/**
 * Find 7-zip executable on the system
 * Checks bundled 7za.exe first, then system installations
 */
function find7Zip() {
    // First check for bundled 7za.exe
    const bundled = getBundled7za();
    if (bundled) {
        electron_log_1.default.info('[AppleDriverService] Using bundled 7za.exe');
        return bundled;
    }
    // Then check system installations
    const possiblePaths = [
        'C:\\Program Files\\7-Zip\\7z.exe',
        'C:\\Program Files (x86)\\7-Zip\\7z.exe',
        path_1.default.join(process.env.LOCALAPPDATA || '', '7-Zip', '7z.exe'),
    ];
    for (const p of possiblePaths) {
        if (fs_1.default.existsSync(p)) {
            return p;
        }
    }
    return null;
}
/**
 * Recursively find files matching a pattern
 */
function findFilesRecursive(dir, pattern, maxDepth = 3, currentDepth = 0) {
    const results = [];
    if (currentDepth > maxDepth || !fs_1.default.existsSync(dir)) {
        return results;
    }
    try {
        const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path_1.default.join(dir, entry.name);
            if (entry.isFile() && pattern.test(entry.name)) {
                results.push(fullPath);
            }
            else if (entry.isDirectory()) {
                results.push(...findFilesRecursive(fullPath, pattern, maxDepth, currentDepth + 1));
            }
        }
    }
    catch {
        // Ignore permission errors
    }
    return results;
}
/**
 * Extract MSI from iTunes installer
 * iTunes installer is an EXE that contains multiple MSI files
 */
async function extractMsiFromInstaller(installerPath, outputDir) {
    try {
        // Create output directory
        if (!fs_1.default.existsSync(outputDir)) {
            fs_1.default.mkdirSync(outputDir, { recursive: true });
        }
        electron_log_1.default.info('[AppleDriverService] Extracting iTunes installer...');
        // Method 1: Try 7-Zip (most reliable for iTunes installer)
        const sevenZipPath = find7Zip();
        if (sevenZipPath) {
            electron_log_1.default.info('[AppleDriverService] Found 7-Zip at:', sevenZipPath);
            try {
                await execAsync(`"${sevenZipPath}" x "${installerPath}" -o"${outputDir}" -y`, {
                    timeout: 120000,
                });
                electron_log_1.default.info('[AppleDriverService] 7-Zip extraction successful');
            }
            catch (err) {
                electron_log_1.default.warn('[AppleDriverService] 7-Zip extraction failed:', err);
            }
        }
        else {
            electron_log_1.default.info('[AppleDriverService] 7-Zip not found, trying alternative methods...');
            // Method 2: Try running installer with /extract (some Apple installers support this)
            try {
                await execAsync(`"${installerPath}" /extract "${outputDir}"`, { timeout: 120000 });
                electron_log_1.default.info('[AppleDriverService] /extract flag worked');
            }
            catch {
                electron_log_1.default.info('[AppleDriverService] /extract flag not supported');
                // Method 3: Try expand command (works for some archive types)
                try {
                    await execAsync(`expand "${installerPath}" -F:* "${outputDir}"`, { timeout: 120000 });
                    electron_log_1.default.info('[AppleDriverService] expand command worked');
                }
                catch {
                    electron_log_1.default.info('[AppleDriverService] expand command failed');
                    // Method 4: Try 7z command from PATH
                    try {
                        await execAsync(`7z x "${installerPath}" -o"${outputDir}" -y`, { timeout: 120000 });
                        electron_log_1.default.info('[AppleDriverService] 7z from PATH worked');
                    }
                    catch {
                        electron_log_1.default.error('[AppleDriverService] No extraction method available');
                        electron_log_1.default.error('[AppleDriverService] 7-Zip is required to extract Apple drivers.');
                        electron_log_1.default.error('[AppleDriverService] Either bundle 7za.exe in resources/win/ or install 7-Zip from https://7-zip.org/');
                        throw new Error('7-Zip is required to extract the driver installer. Please install 7-Zip from https://7-zip.org/ and try again.');
                    }
                }
            }
        }
        // Look for the AppleMobileDeviceSupport MSI anywhere in the extracted files
        const msiPattern = /AppleMobileDeviceSupport(64)?\.msi$/i;
        const foundMsis = findFilesRecursive(outputDir, msiPattern);
        if (foundMsis.length > 0) {
            // Prefer 64-bit version
            const msi64 = foundMsis.find((f) => f.toLowerCase().includes('64'));
            const selectedMsi = msi64 || foundMsis[0];
            electron_log_1.default.info('[AppleDriverService] Found MSI:', selectedMsi);
            return selectedMsi;
        }
        // List what we did extract for debugging
        electron_log_1.default.warn('[AppleDriverService] MSI not found. Extracted contents:');
        try {
            const extracted = fs_1.default.readdirSync(outputDir);
            electron_log_1.default.warn('[AppleDriverService] Files in output dir:', extracted.slice(0, 20)); // First 20 files
        }
        catch {
            electron_log_1.default.warn('[AppleDriverService] Could not list output directory');
        }
        electron_log_1.default.error('[AppleDriverService] AppleMobileDeviceSupport MSI not found in extracted files');
        electron_log_1.default.error('[AppleDriverService] The iTunes installer format may have changed.');
        return null;
    }
    catch (error) {
        electron_log_1.default.error('[AppleDriverService] Failed to extract installer:', error);
        return null;
    }
}
/**
 * Download and extract Apple drivers on-demand
 * Call this after user consents to installation
 */
async function downloadAppleDrivers(onProgress) {
    const driversDir = getDownloadedDriversPath();
    const installerPath = path_1.default.join(driversDir, 'iTunes64Setup.exe');
    const extractDir = path_1.default.join(driversDir, 'extracted');
    try {
        // Create directory if needed
        if (!fs_1.default.existsSync(driversDir)) {
            fs_1.default.mkdirSync(driversDir, { recursive: true });
        }
        // Check if we already have the extracted MSI
        const existingMsi = getDownloadedDriverPath();
        if (existingMsi) {
            electron_log_1.default.info('[AppleDriverService] Using previously downloaded drivers');
            onProgress?.({ phase: 'complete', percent: 100 });
            return { success: true, msiPath: existingMsi };
        }
        // Download iTunes installer
        electron_log_1.default.info('[AppleDriverService] Downloading iTunes installer...');
        onProgress?.({ phase: 'downloading', percent: 0 });
        await downloadFile(ITUNES_DOWNLOAD_URL, installerPath, (percent) => onProgress?.({ phase: 'downloading', percent }));
        electron_log_1.default.info('[AppleDriverService] Download complete, extracting...');
        onProgress?.({ phase: 'extracting', percent: 0 });
        // Extract the MSI
        const msiPath = await extractMsiFromInstaller(installerPath, extractDir);
        // Clean up installer to save space
        try {
            fs_1.default.unlinkSync(installerPath);
        }
        catch {
            // Ignore cleanup errors
        }
        if (!msiPath) {
            return {
                success: false,
                error: 'Could not extract Apple drivers from installer. Please install iTunes manually.',
            };
        }
        onProgress?.({ phase: 'complete', percent: 100 });
        return { success: true, msiPath };
    }
    catch (error) {
        electron_log_1.default.error('[AppleDriverService] Failed to download drivers:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Download failed',
        };
    }
}
/**
 * Get path to downloaded (on-demand) driver MSI
 */
function getDownloadedDriverPath() {
    const extractDir = path_1.default.join(getDownloadedDriversPath(), 'extracted');
    if (!fs_1.default.existsSync(extractDir)) {
        return null;
    }
    // Use recursive search to find the MSI anywhere in the extracted folder
    const msiPattern = /AppleMobileDeviceSupport(64)?\.msi$/i;
    const foundMsis = findFilesRecursive(extractDir, msiPattern);
    if (foundMsis.length > 0) {
        // Prefer 64-bit version
        const msi64 = foundMsis.find((f) => f.toLowerCase().includes('64'));
        return msi64 || foundMsis[0];
    }
    return null;
}
/**
 * Get iTunes download URL
 */
function getITunesDownloadUrl() {
    // Microsoft Store link - easiest for users
    return 'ms-windows-store://pdp/?ProductId=9PB2MZ1ZMB1S';
}
/**
 * Get iTunes web download URL (fallback)
 */
function getITunesWebUrl() {
    return 'https://www.apple.com/itunes/download/win64';
}
/**
 * Compare two version strings
 * @returns negative if a < b, 0 if a == b, positive if a > b
 */
function compareVersions(a, b) {
    if (!a && !b)
        return 0;
    if (!a)
        return -1;
    if (!b)
        return 1;
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    const maxLength = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < maxLength; i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;
        if (numA !== numB) {
            return numA - numB;
        }
    }
    return 0;
}
/**
 * Get the bundled driver version from a version file
 * We store this in a version.txt file alongside the MSI
 */
function getBundledDriverVersion() {
    const driverPath = getBundledDriverPath();
    if (!driverPath)
        return null;
    const versionFilePath = path_1.default.join(path_1.default.dirname(driverPath), 'version.txt');
    try {
        if (fs_1.default.existsSync(versionFilePath)) {
            const version = fs_1.default.readFileSync(versionFilePath, 'utf-8').trim();
            return version || null;
        }
    }
    catch (error) {
        electron_log_1.default.warn('[AppleDriverService] Could not read bundled version:', error);
    }
    return null;
}
/**
 * Check if a driver update is available
 */
async function checkForDriverUpdate() {
    const status = await checkAppleDrivers();
    const bundledVersion = getBundledDriverVersion();
    // If not installed, definitely needs installation (not an "update" per se)
    if (!status.isInstalled) {
        return {
            updateAvailable: false, // It's a fresh install, not an update
            installedVersion: null,
            bundledVersion,
        };
    }
    // If we don't know the bundled version, can't determine if update is available
    if (!bundledVersion) {
        return {
            updateAvailable: false,
            installedVersion: status.version,
            bundledVersion: null,
        };
    }
    // Compare versions
    const needsUpdate = compareVersions(status.version, bundledVersion) < 0;
    return {
        updateAvailable: needsUpdate,
        installedVersion: status.version,
        bundledVersion,
    };
}
