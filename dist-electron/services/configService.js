"use strict";
/**
 * Configuration Service for application settings
 * Provides centralized configuration management with type safety
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.configService = exports.ConfigService = void 0;
/**
 * Configuration Service Class
 * Manages application configuration with type-safe getters and setters
 */
class ConfigService {
    constructor() {
        this.config = this.loadDefaultConfig();
    }
    /**
     * Load default configuration values
     */
    loadDefaultConfig() {
        return {
            theme: 'auto',
            autoUpdate: true,
            logLevel: 'info',
            maxLogFiles: 10,
            enableTelemetry: false,
        };
    }
    /**
     * Get configuration value by key
     * @param key - Configuration key
     * @returns The configuration value or undefined if not found
     */
    async getConfig(key) {
        return this.config[key];
    }
    /**
     * Set configuration value
     * @param key - Configuration key
     * @param value - Configuration value
     */
    async setConfig(key, value) {
        this.config[key] = value;
    }
    /**
     * Get multiple configuration values
     * @param keys - Array of configuration keys
     * @returns Object containing requested configuration values
     */
    async getMultiple(keys) {
        const result = {};
        for (const key of keys) {
            result[key] = this.config[key];
        }
        return result;
    }
    /**
     * Set multiple configuration values
     * @param values - Object containing key-value pairs to set
     */
    async setMultiple(values) {
        for (const [key, value] of Object.entries(values)) {
            this.config[key] = value;
        }
    }
    /**
     * Check if a configuration key exists
     * @param key - Configuration key
     * @returns True if the key exists
     */
    async hasConfig(key) {
        return key in this.config;
    }
    /**
     * Delete a configuration key
     * @param key - Configuration key
     */
    async deleteConfig(key) {
        delete this.config[key];
    }
    /**
     * Get all configuration values
     * @returns All configuration values
     */
    async getAllConfig() {
        return { ...this.config };
    }
    /**
     * Reset configuration to defaults
     */
    async resetToDefaults() {
        this.config = this.loadDefaultConfig();
    }
    /**
     * Clear all configuration
     */
    async clearAll() {
        this.config = {};
    }
}
exports.ConfigService = ConfigService;
/**
 * Singleton instance of ConfigService
 */
exports.configService = new ConfigService();
exports.default = exports.configService;
