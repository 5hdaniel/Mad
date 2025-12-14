#!/usr/bin/env node
/**
 * Rebuild native modules for Electron
 *
 * This script ensures better-sqlite3-multiple-ciphers is compiled for
 * Electron's Node.js ABI, not the system Node.js version.
 *
 * Strategy:
 * 1. Try prebuild-install (downloads pre-compiled binary - fast, reliable)
 * 2. Fall back to electron-rebuild (compiles from source - requires build tools)
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const MODULE_NAME = 'better-sqlite3-multiple-ciphers';

function getElectronVersion() {
  try {
    // Try to get version from installed electron
    const result = execSync('npx electron --version', { encoding: 'utf-8' });
    return result.trim().replace('v', '');
  } catch {
    // Fall back to package.json
    const pkgPath = path.join(__dirname, '..', 'node_modules', 'electron', 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return pkg.version;
    }
    throw new Error('Could not determine Electron version');
  }
}

function getArch() {
  return process.arch === 'arm64' ? 'arm64' : 'x64';
}

function getPlatform() {
  const platforms = { darwin: 'darwin', win32: 'win32', linux: 'linux' };
  return platforms[process.platform] || 'linux';
}

function tryPrebuildInstall(electronVersion) {
  const modulePath = path.join(__dirname, '..', 'node_modules', MODULE_NAME);

  if (!fs.existsSync(modulePath)) {
    console.log(`[rebuild-native] ${MODULE_NAME} not found, skipping`);
    return true;
  }

  console.log(`[rebuild-native] Trying prebuild-install for Electron ${electronVersion}...`);

  const result = spawnSync('npx', [
    'prebuild-install',
    '--runtime=electron',
    `--target=${electronVersion}`,
    `--arch=${getArch()}`,
    `--platform=${getPlatform()}`
  ], {
    cwd: modulePath,
    stdio: 'inherit',
    shell: true
  });

  return result.status === 0;
}

function tryElectronRebuild() {
  console.log('[rebuild-native] Falling back to electron-rebuild...');

  const result = spawnSync('npx', ['electron-rebuild'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: true
  });

  return result.status === 0;
}

function main() {
  console.log('[rebuild-native] Rebuilding native modules for Electron...');

  try {
    const electronVersion = getElectronVersion();
    console.log(`[rebuild-native] Detected Electron version: ${electronVersion}`);
    console.log(`[rebuild-native] Platform: ${getPlatform()}, Arch: ${getArch()}`);

    // Try prebuild-install first (faster, no build tools needed)
    if (tryPrebuildInstall(electronVersion)) {
      console.log('[rebuild-native] Successfully installed prebuilt binary');
      return;
    }

    // Fall back to electron-rebuild
    if (tryElectronRebuild()) {
      console.log('[rebuild-native] Successfully rebuilt with electron-rebuild');
      return;
    }

    console.error('[rebuild-native] Failed to rebuild native modules');
    console.error('[rebuild-native] You may need to install build tools:');
    console.error('  Windows: npm install -g windows-build-tools');
    console.error('  macOS: xcode-select --install');
    process.exit(1);
  } catch (error) {
    console.error('[rebuild-native] Error:', error.message);
    process.exit(1);
  }
}

main();
