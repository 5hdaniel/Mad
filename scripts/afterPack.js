const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

/**
 * afterPack hook for electron-builder.
 * Flips Electron fuses on the packaged binary to harden security.
 *
 * Fuse documentation: https://www.electronjs.org/docs/latest/tutorial/fuses
 *
 * This runs AFTER packaging but BEFORE signing/notarization (afterSign).
 * Dev mode (npm run dev) is NOT affected — fuses only apply to packaged builds.
 */
module.exports = async function afterPack(context) {
  const ext = {
    darwin: '.app',
    win32: '.exe',
    linux: '',
  }[context.electronPlatformName];

  const electronBinaryPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}${ext}`;

  console.log(`[afterPack] Flipping Electron fuses on: ${electronBinaryPath}`);
  console.log('[afterPack] Fuse configuration:');
  console.log('  RunAsNode: false');
  console.log('  EnableCookieEncryption: false (tokens/DB encrypted separately)');
  console.log('  EnableNodeOptionsEnvironmentVariable: false');
  console.log('  EnableNodeCliInspectArguments: false');
  console.log('  EnableEmbeddedAsarIntegrityValidation: true');
  console.log('  OnlyLoadAppFromAsar: true');
  console.log('  GrantFileProtocolExtraPrivileges: true (required for loadFile)');

  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    // Disabled: causes keychain prompts on every launch. Not needed because
    // OAuth tokens and DB key are already encrypted via dedicated services
    // (tokenEncryptionService.ts / databaseEncryptionService.ts).
    [FuseV1Options.EnableCookieEncryption]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    // IMPORTANT: Must be true while app uses mainWindow.loadFile() with file:// protocol.
    // Setting to false breaks the packaged app. See PR #838 / v2.2.2.
    // TODO: Migrate to custom protocol (app://) to safely disable this fuse.
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
  });

  console.log('[afterPack] Electron fuses configured successfully.');
};
