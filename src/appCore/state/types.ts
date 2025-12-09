/**
 * App State Types
 *
 * Centralized type definitions for the application state machine.
 * These types are extracted from App.tsx for better modularity and reuse.
 */

import type { Conversation } from "../../hooks/useConversations";
import type { Subscription } from "../../../electron/types/models";

// Application navigation steps
export type AppStep =
  | "loading"
  | "login"
  | "keychain-explanation"
  | "phone-type-selection"
  | "android-coming-soon"
  | "apple-driver-setup"
  | "email-onboarding"
  | "microsoft-login"
  | "permissions"
  | "dashboard"
  | "outlook"
  | "complete"
  | "contacts";

// Export result from file exports
export interface AppExportResult {
  exportPath?: string;
  filesCreated?: string[];
  results?: Array<{
    contactName: string;
    success: boolean;
  }>;
}

// Outlook-specific export results
export interface OutlookExportResults {
  success: boolean;
  exportPath?: string;
  results?: Array<{
    contactName: string;
    success: boolean;
    textMessageCount: number;
    emailCount?: number;
    error: string | null;
  }>;
  error?: string;
  canceled?: boolean;
}

// Pending onboarding data - stored in memory before DB is initialized
export interface PendingOnboardingData {
  termsAccepted: boolean;
  phoneType: "iphone" | "android" | null;
  emailConnected: boolean;
  emailProvider: "google" | "microsoft" | null;
}

// Pending email token data for pre-DB flow
export interface PendingEmailTokens {
  provider: "google" | "microsoft";
  email: string;
  tokens: {
    access_token: string;
    refresh_token: string | null;
    expires_at: string;
    scopes: string;
  };
}

// Phone type options
export type PhoneType = "iphone" | "android" | null;

// Auth provider options
export type AuthProvider = "google" | "microsoft";

// User type for app-level state
export interface AppUser {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
}

// Modal visibility state
export interface ModalState {
  showProfile: boolean;
  showSettings: boolean;
  showTransactions: boolean;
  showContacts: boolean;
  showAuditTransaction: boolean;
  showVersion: boolean;
  showMoveAppPrompt: boolean;
  showTermsModal: boolean;
}

// Re-export types needed by consumers
export type { Conversation, Subscription };
