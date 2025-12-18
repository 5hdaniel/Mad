/**
 * @jest-environment node
 */

/**
 * Prompt Version Service Tests
 * TASK-319: Tests for prompt version service
 *
 * Tests verify:
 * - Singleton pattern returns same instance
 * - getCurrentVersion for existing and non-existent prompts
 * - getAllVersions returns all prompts
 * - getPromptNames returns all names
 * - Utility methods work correctly
 */

import {
  PromptVersionService,
  PromptVersion,
  getPromptVersionService,
} from '../promptVersionService';
import { ALL_PROMPTS } from '../prompts';

describe('PromptVersionService', () => {
  beforeEach(() => {
    // Reset singleton between tests for isolation
    PromptVersionService.resetInstance();
  });

  // ==========================================================================
  // Singleton Pattern Tests
  // ==========================================================================

  describe('singleton pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = PromptVersionService.getInstance();
      const instance2 = PromptVersionService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should return instance from convenience function', () => {
      const instance1 = PromptVersionService.getInstance();
      const instance2 = getPromptVersionService();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = PromptVersionService.getInstance();
      PromptVersionService.resetInstance();
      const instance2 = PromptVersionService.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  // ==========================================================================
  // getCurrentVersion Tests
  // ==========================================================================

  describe('getCurrentVersion', () => {
    it('should return version info for existing prompt', () => {
      const service = PromptVersionService.getInstance();
      const version = service.getCurrentVersion('message-analysis');

      expect(version).toBeDefined();
      expect(version).toEqual({
        name: 'message-analysis',
        version: expect.stringMatching(/^\d+\.\d+\.\d+$/),
        hash: expect.stringMatching(/^[0-9a-f]{8}$/),
      });
    });

    it('should return undefined for non-existent prompt', () => {
      const service = PromptVersionService.getInstance();
      const version = service.getCurrentVersion('non-existent-prompt');

      expect(version).toBeUndefined();
    });

    it('should return version info for contact-roles prompt', () => {
      const service = PromptVersionService.getInstance();
      const version = service.getCurrentVersion('contact-roles');

      expect(version).toBeDefined();
      expect(version?.name).toBe('contact-roles');
      expect(version?.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(version?.hash).toMatch(/^[0-9a-f]{8}$/);
    });

    it('should return version info for transaction-clustering prompt', () => {
      const service = PromptVersionService.getInstance();
      const version = service.getCurrentVersion('transaction-clustering');

      expect(version).toBeDefined();
      expect(version?.name).toBe('transaction-clustering');
      expect(version?.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(version?.hash).toMatch(/^[0-9a-f]{8}$/);
    });

    it('should return undefined for empty string', () => {
      const service = PromptVersionService.getInstance();
      const version = service.getCurrentVersion('');

      expect(version).toBeUndefined();
    });

    it('should be case-sensitive', () => {
      const service = PromptVersionService.getInstance();
      const version = service.getCurrentVersion('MESSAGE-ANALYSIS');

      expect(version).toBeUndefined();
    });
  });

  // ==========================================================================
  // getAllVersions Tests
  // ==========================================================================

  describe('getAllVersions', () => {
    it('should return all prompt versions', () => {
      const service = PromptVersionService.getInstance();
      const versions = service.getAllVersions();

      expect(versions).toHaveLength(ALL_PROMPTS.length);
    });

    it('should return array of PromptVersion objects', () => {
      const service = PromptVersionService.getInstance();
      const versions = service.getAllVersions();

      versions.forEach((version) => {
        expect(version).toHaveProperty('name');
        expect(version).toHaveProperty('version');
        expect(version).toHaveProperty('hash');
        expect(typeof version.name).toBe('string');
        expect(typeof version.version).toBe('string');
        expect(typeof version.hash).toBe('string');
      });
    });

    it('should include message-analysis prompt', () => {
      const service = PromptVersionService.getInstance();
      const versions = service.getAllVersions();
      const messageAnalysis = versions.find((v) => v.name === 'message-analysis');

      expect(messageAnalysis).toBeDefined();
    });

    it('should include contact-roles prompt', () => {
      const service = PromptVersionService.getInstance();
      const versions = service.getAllVersions();
      const contactRoles = versions.find((v) => v.name === 'contact-roles');

      expect(contactRoles).toBeDefined();
    });

    it('should include transaction-clustering prompt', () => {
      const service = PromptVersionService.getInstance();
      const versions = service.getAllVersions();
      const clustering = versions.find((v) => v.name === 'transaction-clustering');

      expect(clustering).toBeDefined();
    });

    it('should return new array on each call', () => {
      const service = PromptVersionService.getInstance();
      const versions1 = service.getAllVersions();
      const versions2 = service.getAllVersions();

      expect(versions1).not.toBe(versions2);
      expect(versions1).toEqual(versions2);
    });
  });

  // ==========================================================================
  // getPromptNames Tests
  // ==========================================================================

  describe('getPromptNames', () => {
    it('should return all prompt names', () => {
      const service = PromptVersionService.getInstance();
      const names = service.getPromptNames();

      expect(names).toHaveLength(ALL_PROMPTS.length);
    });

    it('should return array of strings', () => {
      const service = PromptVersionService.getInstance();
      const names = service.getPromptNames();

      names.forEach((name) => {
        expect(typeof name).toBe('string');
      });
    });

    it('should include expected prompt names', () => {
      const service = PromptVersionService.getInstance();
      const names = service.getPromptNames();

      expect(names).toContain('message-analysis');
      expect(names).toContain('contact-roles');
      expect(names).toContain('transaction-clustering');
    });

    it('should return new array on each call', () => {
      const service = PromptVersionService.getInstance();
      const names1 = service.getPromptNames();
      const names2 = service.getPromptNames();

      expect(names1).not.toBe(names2);
      expect(names1).toEqual(names2);
    });
  });

  // ==========================================================================
  // hasPrompt Tests
  // ==========================================================================

  describe('hasPrompt', () => {
    it('should return true for existing prompt', () => {
      const service = PromptVersionService.getInstance();

      expect(service.hasPrompt('message-analysis')).toBe(true);
      expect(service.hasPrompt('contact-roles')).toBe(true);
      expect(service.hasPrompt('transaction-clustering')).toBe(true);
    });

    it('should return false for non-existent prompt', () => {
      const service = PromptVersionService.getInstance();

      expect(service.hasPrompt('non-existent')).toBe(false);
      expect(service.hasPrompt('')).toBe(false);
    });

    it('should be case-sensitive', () => {
      const service = PromptVersionService.getInstance();

      expect(service.hasPrompt('Message-Analysis')).toBe(false);
      expect(service.hasPrompt('MESSAGE-ANALYSIS')).toBe(false);
    });
  });

  // ==========================================================================
  // getPromptCount Tests
  // ==========================================================================

  describe('getPromptCount', () => {
    it('should return correct count of prompts', () => {
      const service = PromptVersionService.getInstance();
      const count = service.getPromptCount();

      expect(count).toBe(ALL_PROMPTS.length);
      expect(count).toBe(3);
    });
  });

  // ==========================================================================
  // Version Format Validation Tests
  // ==========================================================================

  describe('version format validation', () => {
    it('should have valid semver versions for all prompts', () => {
      const service = PromptVersionService.getInstance();
      const versions = service.getAllVersions();

      versions.forEach((version) => {
        expect(version.version).toMatch(/^\d+\.\d+\.\d+$/);
      });
    });

    it('should have valid 8-character hex hashes for all prompts', () => {
      const service = PromptVersionService.getInstance();
      const versions = service.getAllVersions();

      versions.forEach((version) => {
        expect(version.hash).toMatch(/^[0-9a-f]{8}$/);
      });
    });

    it('should have unique hashes for all prompts', () => {
      const service = PromptVersionService.getInstance();
      const versions = service.getAllVersions();
      const hashes = versions.map((v) => v.hash);
      const uniqueHashes = new Set(hashes);

      expect(uniqueHashes.size).toBe(hashes.length);
    });

    it('should have unique names for all prompts', () => {
      const service = PromptVersionService.getInstance();
      const names = service.getPromptNames();
      const uniqueNames = new Set(names);

      expect(uniqueNames.size).toBe(names.length);
    });
  });

  // ==========================================================================
  // Consistency Tests
  // ==========================================================================

  describe('consistency with ALL_PROMPTS', () => {
    it('should match ALL_PROMPTS metadata', () => {
      const service = PromptVersionService.getInstance();

      ALL_PROMPTS.forEach((promptMeta) => {
        const version = service.getCurrentVersion(promptMeta.name);
        expect(version).toBeDefined();
        expect(version?.name).toBe(promptMeta.name);
        expect(version?.version).toBe(promptMeta.version);
        expect(version?.hash).toBe(promptMeta.hash);
      });
    });

    it('should have same count as ALL_PROMPTS', () => {
      const service = PromptVersionService.getInstance();

      expect(service.getPromptCount()).toBe(ALL_PROMPTS.length);
      expect(service.getAllVersions().length).toBe(ALL_PROMPTS.length);
      expect(service.getPromptNames().length).toBe(ALL_PROMPTS.length);
    });
  });
});

// ==========================================================================
// getPromptVersionService Convenience Function Tests
// ==========================================================================

describe('getPromptVersionService', () => {
  beforeEach(() => {
    PromptVersionService.resetInstance();
  });

  it('should return PromptVersionService instance', () => {
    const service = getPromptVersionService();

    expect(service).toBeInstanceOf(PromptVersionService);
  });

  it('should return same instance as getInstance', () => {
    const service1 = getPromptVersionService();
    const service2 = PromptVersionService.getInstance();

    expect(service1).toBe(service2);
  });
});
