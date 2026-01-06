/**
 * Native Module Compatibility Test
 *
 * This test verifies that native modules (especially better-sqlite3-multiple-ciphers)
 * are properly compiled for the current Node.js version.
 *
 * If this test fails with NODE_MODULE_VERSION mismatch, run:
 *   npm rebuild better-sqlite3-multiple-ciphers
 *   npx electron-rebuild
 *
 * Common versions:
 *   - NODE_MODULE_VERSION 127 = Node.js 22.x
 *   - NODE_MODULE_VERSION 131 = Node.js 23.x
 *   - NODE_MODULE_VERSION 133 = Node.js 23.x (newer)
 *
 * NOTE: Skipped in CI - native modules are rebuilt for Electron, not Node.js/Jest.
 * The 'Rebuild native modules for Electron' CI step validates the build works.
 */

const skipInCI = process.env.CI ? describe.skip : describe;

skipInCI("Native Module Compatibility", () => {
  it("should load better-sqlite3-multiple-ciphers without version mismatch", () => {
    // This test will throw if the module was compiled for a different Node version
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("better-sqlite3-multiple-ciphers");
    }).not.toThrow();
  });

  it("should be able to create an in-memory database", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3-multiple-ciphers");

    // Create an in-memory database to verify the module actually works
    const db = new Database(":memory:");
    expect(db).toBeDefined();

    // Run a simple query
    const result = db.prepare("SELECT 1 + 1 as sum").get();
    expect(result.sum).toBe(2);

    // Clean up
    db.close();
  });

  it("should report Node.js version information", () => {
    // Log version info for debugging CI failures
    console.log("Node.js version:", process.version);
    console.log("Node.js modules version:", process.versions.modules);
    console.log("Platform:", process.platform);
    console.log("Architecture:", process.arch);

    // Just verify we can access this info
    expect(process.version).toBeDefined();
    expect(process.versions.modules).toBeDefined();
  });
});
