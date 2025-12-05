/**
 * Copy database folder to dist-electron
 * This ensures schema.sql is available during development and production builds
 */

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'electron', 'database');
const targetDir = path.join(__dirname, '..', 'dist-electron', 'database');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Copy all files from source to target
fs.readdirSync(sourceDir).forEach(file => {
  const sourcePath = path.join(sourceDir, file);
  const targetPath = path.join(targetDir, file);

  // Only copy files, not subdirectories
  if (fs.statSync(sourcePath).isFile()) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`Copied ${file} to dist-electron/database/`);
  }
});

console.log('Database files copied successfully');
