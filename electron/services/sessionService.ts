import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import type { User, OAuthProvider, Subscription } from '../types/models';

// ============================================
// TYPES & INTERFACES
// ============================================

interface SessionData {
  user: User;
  sessionToken: string;
  provider: OAuthProvider;
  subscription?: Subscription;
  expiresAt: number;
  savedAt?: number;
}

// ============================================
// SERVICE CLASS
// ============================================

/**
 * Session Service
 * Manages user session persistence using local file storage
 * Session data is stored in app's user data directory
 */
class SessionService {
  private sessionFilePath: string;

  constructor() {
    this.sessionFilePath = path.join(app.getPath('userData'), 'session.json');
  }

  /**
   * Save session data to disk
   * @param sessionData - Session data to save
   */
  async saveSession(sessionData: SessionData): Promise<boolean> {
    try {
      const data: SessionData = {
        ...sessionData,
        savedAt: Date.now()
      };
      await fs.writeFile(this.sessionFilePath, JSON.stringify(data, null, 2), 'utf8');
      console.log('Session saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving session:', error);
      return false;
    }
  }

  /**
   * Load session data from disk
   * @returns Session data or null if not found/expired
   */
  async loadSession(): Promise<SessionData | null> {
    try {
      const data = await fs.readFile(this.sessionFilePath, 'utf8');
      const session: SessionData = JSON.parse(data);

      // Check if session is expired
      if (session.expiresAt && Date.now() > session.expiresAt) {
        console.log('Session expired, clearing...');
        await this.clearSession();
        return null;
      }

      console.log('Session loaded successfully');
      return session;
    } catch (error: any) {
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
  async clearSession(): Promise<boolean> {
    try {
      await fs.unlink(this.sessionFilePath);
      console.log('Session cleared successfully');
      return true;
    } catch (error: any) {
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
  async hasValidSession(): Promise<boolean> {
    const session = await this.loadSession();
    return session !== null;
  }

  /**
   * Update session data (merge with existing)
   * @param updates - Partial session data to update
   */
  async updateSession(updates: Partial<SessionData>): Promise<boolean> {
    try {
      const currentSession = await this.loadSession();
      if (!currentSession) {
        console.error('No session to update');
        return false;
      }

      const updatedSession: SessionData = {
        ...currentSession,
        ...updates,
        savedAt: Date.now()
      };

      await this.saveSession(updatedSession);
      return true;
    } catch (error) {
      console.error('Error updating session:', error);
      return false;
    }
  }
}

export default new SessionService();
