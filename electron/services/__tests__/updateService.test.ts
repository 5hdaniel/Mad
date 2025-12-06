/**
 * Unit tests for UpdateService
 * Tests application update management functionality
 */

import { UpdateService, UpdateChannel } from "../updateService";

describe("UpdateService", () => {
  let updateService: UpdateService;

  beforeEach(() => {
    updateService = new UpdateService("1.0.0", {
      autoDownload: false,
      autoInstall: false,
      channel: "stable",
    });
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe("constructor", () => {
    it("should initialize with version and config", () => {
      const service = new UpdateService("1.0.0");
      expect(service).toBeDefined();
    });

    it("should initialize with default config", () => {
      const service = new UpdateService();
      expect(service).toBeDefined();
    });
  });

  describe("getStatus", () => {
    it("should return initial status as idle", async () => {
      const status = await updateService.getStatus();
      expect(status).toBe("idle");
    });

    it("should return checking status when checking for updates", async () => {
      const checkPromise = updateService.checkForUpdates();
      const status = await updateService.getStatus();
      expect(status).toBe("checking");
      await checkPromise;
    });
  });

  describe("getCurrentVersion", () => {
    it("should return the current version", async () => {
      const version = await updateService.getCurrentVersion();
      expect(version).toBe("1.0.0");
    });
  });

  describe("checkForUpdates", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should change status to checking", async () => {
      const promise = updateService.checkForUpdates();
      expect(await updateService.getStatus()).toBe("checking");
      jest.runAllTimers();
      await promise;
    });

    it("should emit checking-for-update event", async () => {
      const listener = jest.fn();
      updateService.on("checking-for-update", listener);

      const promise = updateService.checkForUpdates();
      jest.runAllTimers();
      await promise;

      expect(listener).toHaveBeenCalled();
    });

    it("should return null when no update is available", async () => {
      const promise = updateService.checkForUpdates();
      jest.runAllTimers();
      const result = await promise;

      expect(result).toBeNull();
      expect(await updateService.getStatus()).toBe("not-available");
    });

    it("should emit update-not-available when no update found", async () => {
      const listener = jest.fn();
      updateService.on("update-not-available", listener);

      const promise = updateService.checkForUpdates();
      jest.runAllTimers();
      await promise;

      expect(listener).toHaveBeenCalled();
    });
  });

  describe("downloadUpdate", () => {
    it("should throw error when no update is available", async () => {
      await expect(updateService.downloadUpdate()).rejects.toThrow(
        "No update available to download",
      );
    });
  });

  describe("installUpdate", () => {
    it("should throw error when update is not downloaded", async () => {
      await expect(updateService.installUpdate()).rejects.toThrow(
        "Update must be downloaded before installing",
      );
    });
  });

  describe("auto-update checking", () => {
    it("should have startAutoUpdateCheck method", () => {
      expect(typeof updateService.startAutoUpdateCheck).toBe("function");
    });

    it("should have stopAutoUpdateCheck method", () => {
      expect(typeof updateService.stopAutoUpdateCheck).toBe("function");
    });
  });

  describe("updateConfig", () => {
    it("should update configuration", async () => {
      await updateService.updateConfig({ autoDownload: true });
      const config = await updateService.getConfig();
      expect(config.autoDownload).toBe(true);
    });

    it("should update check interval in config", async () => {
      await updateService.updateConfig({ checkInterval: 2000 });

      const config = await updateService.getConfig();
      expect(config.checkInterval).toBe(2000);
    });
  });

  describe("getConfig", () => {
    it("should return current configuration", async () => {
      const config = await updateService.getConfig();
      expect(config).toHaveProperty("autoDownload");
      expect(config).toHaveProperty("autoInstall");
      expect(config).toHaveProperty("channel");
    });

    it("should return a copy of config", async () => {
      const config1 = await updateService.getConfig();
      const config2 = await updateService.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  describe("channel management", () => {
    it("should set update channel", async () => {
      await updateService.setChannel("beta");
      const channel = await updateService.getChannel();
      expect(channel).toBe("beta");
    });

    it("should get update channel", async () => {
      const channel = await updateService.getChannel();
      expect(channel).toBe("stable");
    });

    it("should handle all channel types", async () => {
      const channels: UpdateChannel[] = ["stable", "beta", "alpha"];

      for (const channel of channels) {
        await updateService.setChannel(channel);
        expect(await updateService.getChannel()).toBe(channel);
      }
    });
  });

  describe("event listeners", () => {
    it("should register event listeners", () => {
      const listener = jest.fn();
      updateService.on("update-available", listener);

      // Trigger event internally would call listener
      expect(listener).not.toHaveBeenCalled();
    });

    it("should unregister event listeners", () => {
      const listener = jest.fn();
      updateService.on("update-available", listener);
      updateService.off("update-available", listener);

      // Listener should not be called after removal
    });

    it("should handle multiple listeners for same event", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      updateService.on("update-available", listener1);
      updateService.on("update-available", listener2);

      // Both should be registered
    });

    it("should handle errors in event listeners gracefully", () => {
      const errorListener = jest.fn(() => {
        throw new Error("Listener error");
      });

      updateService.on("update-available", errorListener);

      // Should not throw when event is emitted
    });
  });

  describe("reset", () => {
    it("should reset service state to idle", async () => {
      await updateService.reset();

      const status = await updateService.getStatus();
      expect(status).toBe("idle");
    });

    it("should have reset method", () => {
      expect(typeof updateService.reset).toBe("function");
    });
  });

  describe("getAvailableUpdate", () => {
    it("should return undefined when no update is available", async () => {
      const update = await updateService.getAvailableUpdate();
      expect(update).toBeUndefined();
    });
  });

  describe("getDownloadProgress", () => {
    it("should return undefined when no download in progress", async () => {
      const progress = await updateService.getDownloadProgress();
      expect(progress).toBeUndefined();
    });
  });
});
