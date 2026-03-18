/**
 * Keychain Gate Service Tests
 * TASK-2254: Tests for the keychain gating mechanism
 */

const mockIsEncryptionAvailable = jest.fn().mockReturnValue(true);
const mockEncryptString = jest.fn().mockReturnValue(Buffer.from("encrypted"));
const mockDecryptString = jest.fn().mockReturnValue("decrypted");

jest.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => mockIsEncryptionAvailable(),
    encryptString: (s: string) => mockEncryptString(s),
    decryptString: (b: Buffer) => mockDecryptString(b),
  },
}));

jest.mock("../logService", () => ({
  __esModule: true,
  default: {
    info: jest.fn().mockResolvedValue(undefined),
    warn: jest.fn().mockResolvedValue(undefined),
    error: jest.fn().mockResolvedValue(undefined),
    debug: jest.fn().mockResolvedValue(undefined),
  },
}));

// We need to import fresh instances for each test
let keychainGate: typeof import("../keychainGate").default;

describe("KeychainGateService", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Re-import to get fresh singleton
    const mod = await import("../keychainGate");
    keychainGate = mod.default;
  });

  describe("isUnlocked", () => {
    it("should start locked", () => {
      expect(keychainGate.isUnlocked()).toBe(false);
    });
  });

  describe("unlock", () => {
    it("should unlock the gate", () => {
      keychainGate.unlock();
      expect(keychainGate.isUnlocked()).toBe(true);
    });

    it("should be idempotent when already unlocked", () => {
      keychainGate.unlock();
      keychainGate.unlock(); // Should not error
      expect(keychainGate.isUnlocked()).toBe(true);
    });
  });

  describe("lock", () => {
    it("should lock the gate", () => {
      keychainGate.unlock();
      expect(keychainGate.isUnlocked()).toBe(true);

      keychainGate.lock();
      expect(keychainGate.isUnlocked()).toBe(false);
    });
  });

  describe("isEncryptionAvailable", () => {
    it("should return true when safeStorage is available", () => {
      mockIsEncryptionAvailable.mockReturnValue(true);
      expect(keychainGate.isEncryptionAvailable()).toBe(true);
    });

    it("should return false when safeStorage is not available", () => {
      mockIsEncryptionAvailable.mockReturnValue(false);
      expect(keychainGate.isEncryptionAvailable()).toBe(false);
    });

    it("should return false when safeStorage throws", () => {
      mockIsEncryptionAvailable.mockImplementation(() => {
        throw new Error("Not ready");
      });
      expect(keychainGate.isEncryptionAvailable()).toBe(false);
    });
  });

  describe("encryptString", () => {
    it("should throw when gate is locked", () => {
      expect(() => keychainGate.encryptString("secret")).toThrow(
        /keychain access not yet allowed/i
      );
    });

    it("should encrypt when gate is unlocked", () => {
      keychainGate.unlock();
      const result = keychainGate.encryptString("secret");

      expect(mockEncryptString).toHaveBeenCalledWith("secret");
      expect(result).toEqual(Buffer.from("encrypted"));
    });
  });

  describe("decryptString", () => {
    it("should throw when gate is locked", () => {
      const encrypted = Buffer.from("encrypted");
      expect(() => keychainGate.decryptString(encrypted)).toThrow(
        /keychain access not yet allowed/i
      );
    });

    it("should decrypt when gate is unlocked", () => {
      keychainGate.unlock();
      const encrypted = Buffer.from("encrypted");
      const result = keychainGate.decryptString(encrypted);

      expect(mockDecryptString).toHaveBeenCalledWith(encrypted);
      expect(result).toBe("decrypted");
    });
  });

  describe("requiresUserConsent", () => {
    it("should return true on darwin (macOS)", () => {
      // The default mock platform is darwin (from process.platform in test)
      // The service reads process.platform at construction time
      expect(keychainGate.requiresUserConsent()).toBe(true);
    });
  });

  describe("autoUnlockIfSilent", () => {
    it("should not auto-unlock on macOS (requires consent)", () => {
      keychainGate.autoUnlockIfSilent();
      // On macOS (darwin), user consent is required, so gate stays locked
      expect(keychainGate.isUnlocked()).toBe(false);
    });
  });
});
