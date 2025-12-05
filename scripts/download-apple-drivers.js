#!/usr/bin/env node
/**
 * Download Apple Mobile Device Support drivers
 *
 * This script downloads iTunes installer and extracts the Apple Mobile Device
 * Support MSI for bundling with the Windows installer.
 *
 * The MSI is installed ONLY with user consent - we show a prompt explaining
 * what will be installed and the user must agree before installation.
 *
 * This approach is similar to other iOS management software like iMazing.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const ITUNES_URL = 'https://www.apple.com/itunes/download/win64';
const OUTPUT_DIR = path.join(__dirname, '..', 'resources', 'win', 'apple-drivers');
const MSI_FILENAME = 'AppleMobileDeviceSupport64.msi';
const TEMP_DIR = path.join(__dirname, '..', 'temp-itunes-extract');

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading from ${url}...`);

    const file = fs.createWriteStream(dest);

    const request = https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
        process.stdout.write(`\rDownloading: ${percent}%`);
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('\nDownload complete.');
        resolve();
      });
    });

    request.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function extractMSI() {
  const iTunesExe = path.join(TEMP_DIR, 'iTunes64Setup.exe');

  // Create temp directory
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    // Download iTunes installer
    await downloadFile(ITUNES_URL, iTunesExe);

    console.log('Extracting MSI from iTunes installer...');

    // Try using 7z if available, otherwise use expand
    try {
      execSync(`7z x "${iTunesExe}" -o"${TEMP_DIR}/extracted" -y`, { stdio: 'pipe' });
    } catch {
      // Fallback to Windows expand command
      try {
        execSync(`expand "${iTunesExe}" -F:* "${TEMP_DIR}/extracted"`, { stdio: 'pipe' });
      } catch {
        // Try using PowerShell to extract
        execSync(`powershell -Command "Expand-Archive -Path '${iTunesExe}' -DestinationPath '${TEMP_DIR}/extracted' -Force"`, { stdio: 'pipe' });
      }
    }

    // Find and copy the MSI
    const extractedDir = path.join(TEMP_DIR, 'extracted');
    const msiSource = path.join(extractedDir, MSI_FILENAME);
    const msiDest = path.join(OUTPUT_DIR, MSI_FILENAME);

    if (fs.existsSync(msiSource)) {
      fs.copyFileSync(msiSource, msiDest);
      console.log(`Successfully extracted ${MSI_FILENAME} to ${OUTPUT_DIR}`);
    } else {
      // Search for MSI in subdirectories
      const findMSI = (dir) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            const result = findMSI(fullPath);
            if (result) return result;
          } else if (file === MSI_FILENAME || file.includes('AppleMobileDevice')) {
            return fullPath;
          }
        }
        return null;
      };

      const foundMSI = findMSI(extractedDir);
      if (foundMSI) {
        fs.copyFileSync(foundMSI, msiDest);
        console.log(`Successfully extracted ${path.basename(foundMSI)} to ${OUTPUT_DIR}`);
      } else {
        throw new Error(`Could not find ${MSI_FILENAME} in extracted files`);
      }
    }

  } finally {
    // Cleanup temp directory
    console.log('Cleaning up temporary files...');
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Apple Mobile Device Support Driver Downloader');
  console.log('='.repeat(60));
  console.log('');
  console.log('This script downloads and extracts Apple Mobile Device Support');
  console.log('drivers from the iTunes installer for bundling with the app.');
  console.log('');
  console.log('NOTE: These drivers are installed ONLY with user consent.');
  console.log('Users must explicitly agree before installation occurs.');
  console.log('');

  // Check if MSI already exists
  const existingMSI = path.join(OUTPUT_DIR, MSI_FILENAME);
  if (fs.existsSync(existingMSI)) {
    const stats = fs.statSync(existingMSI);
    console.log(`MSI already exists (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
    console.log('Delete it manually if you want to re-download.');
    return;
  }

  try {
    await extractMSI();
    console.log('');
    console.log('Done! The MSI will be included in the Windows installer.');
  } catch (error) {
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    console.error('You may need to manually download and extract:');
    console.error('1. Download: https://www.apple.com/itunes/download/win64');
    console.error('2. Extract with 7-Zip: 7z x iTunes64Setup.exe');
    console.error(`3. Copy AppleMobileDeviceSupport64.msi to ${OUTPUT_DIR}`);
    process.exit(1);
  }
}

main();
