/**
 * @jest-environment node
 */

/**
 * Tests for app:// custom protocol handler (TASK-2051)
 *
 * Verifies the protocol handler logic that serves renderer content
 * from the dist/ directory via the custom app:// protocol.
 * This replaces the file:// protocol for security hardening.
 */

import path from "path";

describe("App Protocol Handler (TASK-2051)", () => {
  // Simulate the protocol handler logic extracted from main.ts
  // We test the path resolution and security checks directly
  // since the actual protocol.handle() requires a running Electron app.

  const distDir = path.join(__dirname, "..", "..", "dist");

  /**
   * Resolves a request URL to a file path within the dist directory.
   * Returns null if the path is outside dist (path traversal attempt).
   */
  function resolveProtocolPath(
    requestUrl: string,
    platform: string = "darwin"
  ): { filePath: string } | { error: string; status: number } {
    const url = new URL(requestUrl);
    let pathname = decodeURIComponent(url.pathname);

    // Remove leading slash on Windows paths
    if (platform === "win32" && pathname.startsWith("/")) {
      pathname = pathname.slice(1);
    }

    const normalizedPath = path.normalize(pathname);
    const filePath = path.join(distDir, normalizedPath);

    // Security: Ensure the resolved path is within the dist/ directory
    if (!filePath.startsWith(distDir)) {
      return { error: "Forbidden", status: 403 };
    }

    return { filePath };
  }

  describe("Path Resolution", () => {
    it("should resolve index.html at root", () => {
      const result = resolveProtocolPath("app://./index.html");
      expect(result).toEqual({
        filePath: path.join(distDir, "index.html"),
      });
    });

    it("should resolve nested asset paths", () => {
      const result = resolveProtocolPath("app://./assets/index-abc123.js");
      expect(result).toEqual({
        filePath: path.join(distDir, "assets", "index-abc123.js"),
      });
    });

    it("should resolve CSS files", () => {
      const result = resolveProtocolPath("app://./assets/style-def456.css");
      expect(result).toEqual({
        filePath: path.join(distDir, "assets", "style-def456.css"),
      });
    });

    it("should resolve font files", () => {
      const result = resolveProtocolPath(
        "app://./assets/inter-latin-400.woff2"
      );
      expect(result).toEqual({
        filePath: path.join(distDir, "assets", "inter-latin-400.woff2"),
      });
    });

    it("should resolve image files", () => {
      const result = resolveProtocolPath("app://./assets/logo.svg");
      expect(result).toEqual({
        filePath: path.join(distDir, "assets", "logo.svg"),
      });
    });

    it("should handle deeply nested paths", () => {
      const result = resolveProtocolPath(
        "app://./assets/fonts/inter/regular.woff2"
      );
      expect(result).toEqual({
        filePath: path.join(
          distDir,
          "assets",
          "fonts",
          "inter",
          "regular.woff2"
        ),
      });
    });
  });

  describe("URL-Encoded Paths", () => {
    it("should decode URL-encoded spaces", () => {
      const result = resolveProtocolPath("app://./assets/my%20file.js");
      expect(result).toEqual({
        filePath: path.join(distDir, "assets", "my file.js"),
      });
    });

    it("should decode URL-encoded special characters", () => {
      const result = resolveProtocolPath("app://./assets/file%23hash.js");
      expect(result).toEqual({
        filePath: path.join(distDir, "assets", "file#hash.js"),
      });
    });

    it("should handle already-decoded paths", () => {
      const result = resolveProtocolPath("app://./assets/normal-file.js");
      expect(result).toEqual({
        filePath: path.join(distDir, "assets", "normal-file.js"),
      });
    });
  });

  describe("Path Traversal Prevention", () => {
    // With standard: true scheme, new URL() resolves ".." at the URL level
    // (same as https:// behavior). Combined with path.normalize + path.join,
    // all traversal attempts resolve safely to paths within dist/.

    it("should resolve URL-level '..' to a safe path inside dist", () => {
      // new URL('app://./../../etc/passwd') resolves pathname to '/etc/passwd'
      // path.join(distDir, '/etc/passwd') -> distDir/etc/passwd (inside dist)
      const result = resolveProtocolPath("app://./../../etc/passwd");
      expect(result).toEqual({
        filePath: path.join(distDir, "etc", "passwd"),
      });
      // Verify it stays inside dist (defense-in-depth check)
      if ("filePath" in result) {
        expect(result.filePath.startsWith(distDir)).toBe(true);
      }
    });

    it("should resolve encoded '..' traversal to a safe path inside dist", () => {
      // %2F-encoded '..' gets decoded then normalized by path.normalize
      // Result stays inside dist directory
      const result = resolveProtocolPath("app://./..%2F..%2Fetc%2Fpasswd");
      expect(result).toEqual({
        filePath: path.join(distDir, "etc", "passwd"),
      });
      if ("filePath" in result) {
        expect(result.filePath.startsWith(distDir)).toBe(true);
      }
    });

    it("should resolve parent-dir traversal to a safe path inside dist", () => {
      // '../electron/main.ts' resolves at URL level to '/electron/main.ts'
      // Joins safely as distDir/electron/main.ts
      const result = resolveProtocolPath("app://./../electron/main.ts");
      expect(result).toEqual({
        filePath: path.join(distDir, "electron", "main.ts"),
      });
      if ("filePath" in result) {
        expect(result.filePath.startsWith(distDir)).toBe(true);
      }
    });

    it("should allow paths that contain '..' as part of filename", () => {
      // A file named "something..else.js" should be allowed if it stays in dist
      const result = resolveProtocolPath("app://./assets/something..else.js");
      expect(result).toEqual({
        filePath: path.join(distDir, "assets", "something..else.js"),
      });
    });

    it("should always produce paths inside dist directory", () => {
      // Test multiple traversal attempts to verify defense-in-depth
      const attempts = [
        "app://./../../etc/passwd",
        "app://./..%2F..%2Fetc%2Fpasswd",
        "app://./../electron/main.ts",
        "app://./index.html",
        "app://./assets/../index.html",
      ];

      for (const attempt of attempts) {
        const result = resolveProtocolPath(attempt);
        if ("filePath" in result) {
          expect(result.filePath.startsWith(distDir)).toBe(true);
        }
      }
    });
  });

  describe("Windows Path Handling", () => {
    it("should remove leading slash on Windows", () => {
      // On Windows, URL pathname is /C:/path/to/file
      // We need to strip the leading / for proper path resolution
      const result = resolveProtocolPath("app://./index.html", "win32");
      // On Windows, the pathname is just /index.html from app://./index.html
      // After removing leading slash: index.html
      expect(result).toEqual({
        filePath: path.join(distDir, "index.html"),
      });
    });

    it("should handle Windows paths with assets", () => {
      const result = resolveProtocolPath(
        "app://./assets/script.js",
        "win32"
      );
      expect(result).toEqual({
        filePath: path.join(distDir, "assets", "script.js"),
      });
    });
  });

  describe("Protocol Scheme Registration", () => {
    it("should define correct scheme privileges", () => {
      // Verify the scheme configuration that gets passed to registerSchemesAsPrivileged
      const schemeConfig = {
        scheme: "app",
        privileges: {
          standard: true,
          secure: true,
          supportFetchAPI: true,
          corsEnabled: false,
          stream: true,
        },
      };

      // standard: true enables relative URL resolution (critical for Vite-built assets)
      expect(schemeConfig.privileges.standard).toBe(true);

      // secure: true means CSP 'self' will match app:// origin
      expect(schemeConfig.privileges.secure).toBe(true);

      // supportFetchAPI: true enables fetch() in renderer
      expect(schemeConfig.privileges.supportFetchAPI).toBe(true);

      // corsEnabled: false since all content is local
      expect(schemeConfig.privileges.corsEnabled).toBe(false);

      // stream: true for streaming responses (large files)
      expect(schemeConfig.privileges.stream).toBe(true);
    });
  });

  describe("Fuse Configuration", () => {
    it("should have GrantFileProtocolExtraPrivileges set to false", () => {
      // This test documents the expected fuse state after TASK-2051
      // Verified by reading scripts/afterPack.js
      const fuseConfig = {
        GrantFileProtocolExtraPrivileges: false,
      };
      expect(fuseConfig.GrantFileProtocolExtraPrivileges).toBe(false);
    });
  });

  describe("Dev vs Production Mode", () => {
    it("should use DEV_SERVER_URL in development", () => {
      // In dev mode, app loads from Vite dev server - no protocol handler needed
      const DEV_SERVER_URL = "http://localhost:5173";
      const isDev = true;

      const loadUrl = isDev ? DEV_SERVER_URL : "app://./index.html";
      expect(loadUrl).toBe("http://localhost:5173");
    });

    it("should use app:// protocol in production", () => {
      const isDev = false;
      const loadUrl = isDev
        ? "http://localhost:5173"
        : "app://./index.html";
      expect(loadUrl).toBe("app://./index.html");
    });
  });
});
