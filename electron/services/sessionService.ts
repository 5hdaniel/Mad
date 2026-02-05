import { promises as fs } from "fs";
import path from "path";
import { app } from "electron";
import type { User, OAuthProvider, Subscription } from "../types/models";
import logService from "./logService";

// ============================================
// TYPES & INTERFACES
// ============================================

interface SessionData {
  user: User;
  sessionToken: string;
  provider: OAuthProvider;
  subscription?: Subscription;
  expiresAt: number;
  createdAt: number;
  savedAt?: number;
  // Supabase auth tokens for SDK session restoration (TASK: Dorian's T&C fix)
  // These are persisted to allow RLS-protected operations for returning users
  supabaseTokens?: {
    access_token: string;
    refresh_token: string;
  };
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
  private sessionFilePath: string | null = null;

  private getSessionFilePath(): string {
    if (!this.sessionFilePath) {
      this.sessionFilePath = path.join(app.getPath("userData"), "session.json");
    }
    return this.sessionFilePath;
  }

  /**
   * Save session data to disk
   * @param sessionData - Session data to save
   */
  async saveSession(sessionData: SessionData): Promise<boolean> {
    try {
      const now = Date.now();
      const data: SessionData = {
        ...sessionData,
        createdAt: sessionData.createdAt || now,
        savedAt: now,
      };
      await fs.writeFile(
        this.getSessionFilePath(),
        JSON.stringify(data, null, 2),
        "utf8",
      );
      await logService.info("Session saved successfully", "SessionService");
      return true;
    } catch (error) {
      await logService.error("Error saving session", "SessionService", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  /**
   * Load session data from disk
   * @returns Session data or null if not found/expired
   */
  async loadSession(): Promise<SessionData | null> {
    try {
      const data = await fs.readFile(this.getSessionFilePath(), "utf8");
      const session: SessionData = JSON.parse(data);

      // Check if session is expired (absolute timeout)
      if (session.expiresAt && Date.now() > session.expiresAt) {
        await logService.info("Session expired, clearing...", "SessionService");
        await this.clearSession();
        return null;
      }

      await logService.info("Session loaded successfully", "SessionService");
      return session;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        await logService.info("No existing session found", "SessionService");
        return null;
      }
      await logService.error("Error loading session", "SessionService", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Clear session data
   */
  async clearSession(): Promise<boolean> {
    try {
      await fs.unlink(this.getSessionFilePath());
      await logService.info("Session cleared successfully", "SessionService");
      return true;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        // File doesn't exist, that's fine
        return true;
      }
      await logService.error("Error clearing session", "SessionService", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
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
        await logService.error("No session to update", "SessionService");
        return false;
      }

      const updatedSession: SessionData = {
        ...currentSession,
        ...updates,
        savedAt: Date.now(),
      };

      await this.saveSession(updatedSession);
      return true;
    } catch (error) {
      await logService.error("Error updating session", "SessionService", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  /**
   * Get the session expiration time in milliseconds (24 hours)
   */
  getSessionExpirationMs(): number {
    return 24 * 60 * 60 * 1000; // 24 hours
  }
}

export default new SessionService();
