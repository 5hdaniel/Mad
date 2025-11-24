"use strict";
/**
 * Update Service for application updates
 * Manages checking, downloading, and installing application updates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateService = exports.UpdateService = void 0;
/**
 * Update Service Class
 * Manages application update lifecycle
 */
class UpdateService {
    constructor(currentVersion = '1.0.0', config = {}) {
        this.currentVersion = currentVersion;
        this.status = 'idle';
        this.config = {
            autoDownload: false,
            autoInstall: false,
            channel: 'stable',
            checkInterval: 3600000, // 1 hour default
            ...config,
        };
        this.eventListeners = new Map();
    }
    /**
     * Get current update status
     */
    async getStatus() {
        return this.status;
    }
    /**
     * Get current version
     */
    async getCurrentVersion() {
        return this.currentVersion;
    }
    /**
     * Get available update information
     */
    async getAvailableUpdate() {
        return this.availableUpdate;
    }
    /**
     * Get download progress
     */
    async getDownloadProgress() {
        return this.downloadProgress;
    }
    /**
     * Check for updates
     */
    async checkForUpdates() {
        this.status = 'checking';
        this.emit('checking-for-update');
        try {
            // Simulate update check (in real implementation, this would call an API)
            await this.simulateUpdateCheck();
            if (this.availableUpdate) {
                this.status = 'available';
                this.emit('update-available', this.availableUpdate);
                if (this.config.autoDownload) {
                    await this.downloadUpdate();
                }
                return this.availableUpdate;
            }
            else {
                this.status = 'not-available';
                this.emit('update-not-available');
                return null;
            }
        }
        catch (error) {
            this.status = 'error';
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Simulate update check (placeholder for real implementation)
     */
    async simulateUpdateCheck() {
        // In real implementation, this would fetch from update server
        // For now, simulate no updates available
        await new Promise((resolve) => setTimeout(resolve, 1000));
        this.availableUpdate = undefined;
    }
    /**
     * Download update
     */
    async downloadUpdate() {
        if (!this.availableUpdate) {
            throw new Error('No update available to download');
        }
        this.status = 'downloading';
        this.emit('download-started');
        try {
            // Simulate download progress
            await this.simulateDownload();
            this.status = 'downloaded';
            this.emit('download-completed');
            if (this.config.autoInstall) {
                await this.installUpdate();
            }
        }
        catch (error) {
            this.status = 'error';
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Simulate download (placeholder for real implementation)
     */
    async simulateDownload() {
        const totalBytes = this.availableUpdate?.size || 10000000;
        for (let i = 0; i <= 100; i += 10) {
            this.downloadProgress = {
                bytesDownloaded: (totalBytes * i) / 100,
                totalBytes,
                percentage: i,
            };
            this.emit('download-progress', this.downloadProgress);
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }
    /**
     * Install update
     */
    async installUpdate() {
        if (this.status !== 'downloaded') {
            throw new Error('Update must be downloaded before installing');
        }
        this.emit('before-quit-for-update');
        // In real implementation, this would trigger app restart and update installation
        // For now, just emit event
        await new Promise((resolve) => setTimeout(resolve, 500));
        this.emit('update-installed');
    }
    /**
     * Start automatic update checking
     */
    async startAutoUpdateCheck() {
        if (this.checkIntervalId) {
            return;
        }
        // Initial check
        await this.checkForUpdates();
        // Set up interval
        this.checkIntervalId = setInterval(async () => {
            await this.checkForUpdates();
        }, this.config.checkInterval);
    }
    /**
     * Stop automatic update checking
     */
    async stopAutoUpdateCheck() {
        if (this.checkIntervalId) {
            clearInterval(this.checkIntervalId);
            this.checkIntervalId = undefined;
        }
    }
    /**
     * Update configuration
     */
    async updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        // Restart auto-check if interval changed
        if (newConfig.checkInterval && this.checkIntervalId) {
            await this.stopAutoUpdateCheck();
            await this.startAutoUpdateCheck();
        }
    }
    /**
     * Get current configuration
     */
    async getConfig() {
        return { ...this.config };
    }
    /**
     * Set update channel
     */
    async setChannel(channel) {
        this.config.channel = channel;
    }
    /**
     * Get update channel
     */
    async getChannel() {
        return this.config.channel || 'stable';
    }
    /**
     * Register event listener
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)?.push(callback);
    }
    /**
     * Unregister event listener
     */
    off(event, callback) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
    /**
     * Emit event to all registered listeners
     */
    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach((callback) => {
                try {
                    callback(data);
                }
                catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }
    /**
     * Reset update service state
     */
    async reset() {
        await this.stopAutoUpdateCheck();
        this.status = 'idle';
        this.availableUpdate = undefined;
        this.downloadProgress = undefined;
        this.eventListeners.clear();
    }
}
exports.UpdateService = UpdateService;
/**
 * Singleton instance of UpdateService
 */
exports.updateService = new UpdateService();
exports.default = exports.updateService;
