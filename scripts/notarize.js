const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize on macOS
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  // Check for required environment variables
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  console.log('\n=== Notarization Configuration ===');
  console.log(`Apple ID: ${appleId || 'NOT SET'}`);
  console.log(`Team ID: ${teamId || 'NOT SET'}`);
  console.log(`App-Specific Password: ${appleIdPassword ? '****' + appleIdPassword.slice(-4) : 'NOT SET'}`);
  console.log(`App Path: ${appOutDir}/${appName}.app`);
  console.log('====================================\n');

  if (!appleId || !appleIdPassword || !teamId) {
    console.warn('⚠️  Skipping notarization: Missing credentials');
    console.warn('   Please check your .env.local file contains:');
    console.warn('   - APPLE_ID');
    console.warn('   - APPLE_APP_SPECIFIC_PASSWORD');
    console.warn('   - APPLE_TEAM_ID');
    return;
  }

  console.log(`🔐 Notarizing ${appName} with Apple...`);

  try {
    await notarize({
      appPath: `${appOutDir}/${appName}.app`,
      appleId: appleId,
      appleIdPassword: appleIdPassword,
      teamId: teamId,
    });

    console.log('Notarization successful!');
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
};
