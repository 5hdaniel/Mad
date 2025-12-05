"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const logService_1 = __importDefault(require("./logService"));
// ============================================
// SERVICE CLASS
// ============================================
/**
 * Session Service
 * Manages user session persistence using local file storage
 * Session data is stored in app's user data directory
 */
class SessionService {
    constructor() {
        this.sessionFilePath = null;
    }
    getSessionFilePath() {
        if (!this.sessionFilePath) {
            this.sessionFilePath = path_1.default.join(electron_1.app.getPath('userData'), 'session.json');
        }
        return this.sessionFilePath;
    }
    /**
     * Save session data to disk
     * @param sessionData - Session data to save
     */
    async saveSession(sessionData) {
        try {
            const now = Date.now();
            const data = {
                ...sessionData,
                createdAt: sessionData.createdAt || now,
                savedAt: now
            };
            await fs_1.promises.writeFile(this.getSessionFilePath(), JSON.stringify(data, null, 2), 'utf8');
            await logService_1.default.info('Session saved successfully', 'SessionService');
            return true;
        }
        catch (error) {
            await logService_1.default.error('Error saving session', 'SessionService', { error: error instanceof Error ? error.message : 'Unknown error' });
            return false;
        }
    }
    /**
     * Load session data from disk
     * @returns Session data or null if not found/expired
     */
    async loadSession() {
        try {
            const data = await fs_1.promises.readFile(this.getSessionFilePath(), 'utf8');
            const session = JSON.parse(data);
            // Check if session is expired (absolute timeout)
            if (session.expiresAt && Date.now() > session.expiresAt) {
                await logService_1.default.info('Session expired, clearing...', 'SessionService');
                await this.clearSession();
                return null;
            }
            await logService_1.default.info('Session loaded successfully', 'SessionService');
            return session;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                await logService_1.default.info('No existing session found', 'SessionService');
                return null;
            }
            await logService_1.default.error('Error loading session', 'SessionService', { error: error instanceof Error ? error.message : 'Unknown error' });
            return null;
        }
    }
    /**
     * Clear session data
     */
    async clearSession() {
        try {
            await fs_1.promises.unlink(this.getSessionFilePath());
            await logService_1.default.info('Session cleared successfully', 'SessionService');
            return true;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, that's fine
                return true;
            }
            await logService_1.default.error('Error clearing session', 'SessionService', { error: error instanceof Error ? error.message : 'Unknown error' });
            return false;
        }
    }
    /**
     * Check if a valid session exists
     */
    async hasValidSession() {
        const session = await this.loadSession();
        return session !== null;
    }
    /**
     * Update session data (merge with existing)
     * @param updates - Partial session data to update
     */
    async updateSession(updates) {
        try {
            const currentSession = await this.loadSession();
            if (!currentSession) {
                await logService_1.default.error('No session to update', 'SessionService');
                return false;
            }
            const updatedSession = {
                ...currentSession,
                ...updates,
                savedAt: Date.now()
            };
            await this.saveSession(updatedSession);
            return true;
        }
        catch (error) {
            await logService_1.default.error('Error updating session', 'SessionService', { error: error instanceof Error ? error.message : 'Unknown error' });
            return false;
        }
    }
    /**
     * Get the session expiration time in milliseconds (24 hours)
     */
    getSessionExpirationMs() {
        return 24 * 60 * 60 * 1000; // 24 hours
    }
}
exports.default = new SessionService();
