/**
 * Unit tests for ConfigService
 * Tests configuration management functionality
 */

import { ConfigService } from "../configService";

describe("ConfigService", () => {
  let configService: ConfigService;

  beforeEach(() => {
    configService = new ConfigService();
  });

  describe("getConfig", () => {
    it("should return undefined for non-existent keys", async () => {
      const result = await configService.getConfig("nonExistentKey");
      expect(result).toBeUndefined();
    });

    it("should return default values for configured keys", async () => {
      const theme = await configService.getConfig("theme");
      expect(theme).toBe("auto");
    });

    it("should return typed values", async () => {
      await configService.setConfig("customKey", 42);
      const result = await configService.getConfig<number>("customKey");
      expect(result).toBe(42);
      expect(typeof result).toBe("number");
    });
  });

  describe("setConfig", () => {
    it("should set configuration values", async () => {
      await configService.setConfig("testKey", "testValue");
      const result = await configService.getConfig("testKey");
      expect(result).toBe("testValue");
    });

    it("should overwrite existing values", async () => {
      await configService.setConfig("theme", "dark");
      const result = await configService.getConfig("theme");
      expect(result).toBe("dark");
    });

    it("should handle complex objects", async () => {
      const complexValue = { nested: { value: 123 }, array: [1, 2, 3] };
      await configService.setConfig("complex", complexValue);
      const result =
        await configService.getConfig<typeof complexValue>("complex");
      expect(result).toEqual(complexValue);
    });

    it("should handle null and undefined values", async () => {
      await configService.setConfig("nullValue", null);
      await configService.setConfig("undefinedValue", undefined);

      expect(await configService.getConfig("nullValue")).toBeNull();
      expect(await configService.getConfig("undefinedValue")).toBeUndefined();
    });
  });

  describe("getMultiple", () => {
    it("should return multiple configuration values", async () => {
      await configService.setConfig("key1", "value1");
      await configService.setConfig("key2", "value2");

      const result = await configService.getMultiple(["key1", "key2"]);
      expect(result).toEqual({
        key1: "value1",
        key2: "value2",
      });
    });

    it("should include undefined for non-existent keys", async () => {
      await configService.setConfig("existingKey", "value");

      const result = await configService.getMultiple([
        "existingKey",
        "nonExistentKey",
      ]);
      expect(result).toEqual({
        existingKey: "value",
        nonExistentKey: undefined,
      });
    });

    it("should handle empty array", async () => {
      const result = await configService.getMultiple([]);
      expect(result).toEqual({});
    });
  });

  describe("setMultiple", () => {
    it("should set multiple configuration values", async () => {
      await configService.setMultiple({
        key1: "value1",
        key2: "value2",
        key3: "value3",
      });

      expect(await configService.getConfig("key1")).toBe("value1");
      expect(await configService.getConfig("key2")).toBe("value2");
      expect(await configService.getConfig("key3")).toBe("value3");
    });

    it("should handle empty object", async () => {
      await configService.setMultiple({});
      const allConfig = await configService.getAllConfig();
      // Should still have default config
      expect(allConfig).toHaveProperty("theme");
    });
  });

  describe("hasConfig", () => {
    it("should return true for existing keys", async () => {
      await configService.setConfig("existingKey", "value");
      const result = await configService.hasConfig("existingKey");
      expect(result).toBe(true);
    });

    it("should return false for non-existent keys", async () => {
      const result = await configService.hasConfig("nonExistentKey");
      expect(result).toBe(false);
    });

    it("should return true for default config keys", async () => {
      const result = await configService.hasConfig("theme");
      expect(result).toBe(true);
    });
  });

  describe("deleteConfig", () => {
    it("should delete existing configuration", async () => {
      await configService.setConfig("deleteMe", "value");
      expect(await configService.hasConfig("deleteMe")).toBe(true);

      await configService.deleteConfig("deleteMe");
      expect(await configService.hasConfig("deleteMe")).toBe(false);
    });

    it("should handle deleting non-existent keys gracefully", async () => {
      await expect(
        configService.deleteConfig("nonExistent"),
      ).resolves.not.toThrow();
    });
  });

  describe("getAllConfig", () => {
    it("should return all configuration values", async () => {
      await configService.setConfig("custom1", "value1");
      await configService.setConfig("custom2", "value2");

      const allConfig = await configService.getAllConfig();
      expect(allConfig).toHaveProperty("theme");
      expect(allConfig).toHaveProperty("custom1", "value1");
      expect(allConfig).toHaveProperty("custom2", "value2");
    });

    it("should return a copy of config object", async () => {
      const config1 = await configService.getAllConfig();
      const config2 = await configService.getAllConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different object references
    });
  });

  describe("resetToDefaults", () => {
    it("should reset configuration to defaults", async () => {
      await configService.setConfig("custom", "value");
      await configService.setConfig("theme", "dark");

      await configService.resetToDefaults();

      expect(await configService.getConfig("custom")).toBeUndefined();
      expect(await configService.getConfig("theme")).toBe("auto");
    });

    it("should restore all default values", async () => {
      await configService.resetToDefaults();

      const allConfig = await configService.getAllConfig();
      expect(allConfig).toHaveProperty("theme", "auto");
      expect(allConfig).toHaveProperty("autoUpdate", true);
      expect(allConfig).toHaveProperty("logLevel", "info");
    });
  });

  describe("clearAll", () => {
    it("should clear all configuration", async () => {
      await configService.setConfig("key1", "value1");
      await configService.setConfig("key2", "value2");

      await configService.clearAll();

      const allConfig = await configService.getAllConfig();
      expect(Object.keys(allConfig).length).toBe(0);
    });

    it("should not have default values after clear", async () => {
      await configService.clearAll();
      expect(await configService.getConfig("theme")).toBeUndefined();
    });
  });

  describe("type safety", () => {
    it("should work with typed AppConfig values", async () => {
      await configService.setConfig("theme", "dark");
      await configService.setConfig("autoUpdate", false);
      await configService.setConfig("maxLogFiles", 20);

      expect(await configService.getConfig("theme")).toBe("dark");
      expect(await configService.getConfig("autoUpdate")).toBe(false);
      expect(await configService.getConfig("maxLogFiles")).toBe(20);
    });

    it("should handle windowBounds object", async () => {
      const bounds = { width: 1920, height: 1080, x: 100, y: 100 };
      await configService.setConfig("windowBounds", bounds);

      const result =
        await configService.getConfig<typeof bounds>("windowBounds");
      expect(result).toEqual(bounds);
    });
  });
});
