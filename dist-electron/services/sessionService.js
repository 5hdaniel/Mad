"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
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
        this.sessionFilePath = path_1.default.join(electron_1.app.getPath('userData'), 'session.json');
    }
    /**
     * Save session data to disk
     * @param sessionData - Session data to save
     */
    async saveSession(sessionData) {
        try {
            const data = {
                ...sessionData,
                savedAt: Date.now()
            };
            await fs_1.promises.writeFile(this.sessionFilePath, JSON.stringify(data, null, 2), 'utf8');
            console.log('Session saved successfully');
            return true;
        }
        catch (error) {
            console.error('Error saving session:', error);
            return false;
        }
    }
    /**
     * Load session data from disk
     * @returns Session data or null if not found/expired
     */
    async loadSession() {
        try {
            const data = await fs_1.promises.readFile(this.sessionFilePath, 'utf8');
            const session = JSON.parse(data);
            // Check if session is expired
            if (session.expiresAt && Date.now() > session.expiresAt) {
                console.log('Session expired, clearing...');
                await this.clearSession();
                return null;
            }
            console.log('Session loaded successfully');
            return session;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                console.log('No existing session found');
                return null;
            }
            console.error('Error loading session:', error);
            return null;
        }
    }
    /**
     * Clear session data
     */
    async clearSession() {
        try {
            await fs_1.promises.unlink(this.sessionFilePath);
            console.log('Session cleared successfully');
            return true;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, that's fine
                return true;
            }
            console.error('Error clearing session:', error);
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
                console.error('No session to update');
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
            console.error('Error updating session:', error);
            return false;
        }
    }
}
exports.default = new SessionService();
