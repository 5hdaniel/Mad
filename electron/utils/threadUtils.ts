/**
 * Thread Utilities
 *
 * Shared thread grouping, participant extraction, and group chat detection functions.
 * Extracted from folderExportService.ts and MessageThreadCard.tsx (TASK-1201).
 */

import type { Communication } from "../types/models";
import { getTrailingDigits } from "./phoneUtils";
import { resolveContactName } from "./contactUtils";

// ============================================
// TYPES
// ============================================

/**
 * Parsed participants structure from message JSON.
 */
export interface ParsedParticipants {
  from?: string;
  to?: string | string[];
  chat_members?: string[];
}

/**
 * Message-like interface for thread utilities.
 * Works with both Communication and Message types.
 */
export interface MessageLike {
  id: string;
  thread_id?: string | null;
  participants?: string | ParsedParticipants | null;
  direction?: "inbound" | "outbound" | null;
  sender?: string | null;
}

// ============================================
// PARTICIPANTS PARSING
// ============================================

/**
 * Safely parse participants JSON from a message.
 * Handles both string and object forms.
 *
 * @param msg - Message with participants field
 * @returns Parsed participants or null if invalid
 */
export function parseParticipants(
  msg: MessageLike
): ParsedParticipants | null {
  if (!msg.participants) return null;

  try {
    return typeof msg.participants === "string"
      ? JSON.parse(msg.participants)
      : msg.participants;
  } catch {
    return null;
  }
}

/**
 * Get all unique participants from a thread (excluding the user).
 * Returns an array of phone numbers/identifiers.
 *
 * Collects from multiple sources to ensure all participants are found:
 * 1. chat_members (from Apple's chat_handle_join) - authoritative list
 * 2. from/to fields - catches participants missed by chat_members
 *
 * @param messages - Messages in the thread
 * @returns Array of unique participant identifiers
 */
export function getThreadParticipants(messages: MessageLike[]): string[] {
  const participants = new Set<string>();

  for (const msg of messages) {
    const parsed = parseParticipants(msg);
    if (!parsed) continue;

    // Collect from chat_members (authoritative, doesn't include user)
    if (parsed.chat_members && Array.isArray(parsed.chat_members)) {
      parsed.chat_members.forEach((m: string) => {
        if (m && m !== "unknown") participants.add(m);
      });
    }

    // Also collect from from/to fields to catch any missed participants
    // For inbound messages, the sender (from) is the other person
    if (msg.direction === "inbound" && parsed.from) {
      if (parsed.from !== "me" && parsed.from !== "unknown") {
        participants.add(parsed.from);
      }
    }

    // For outbound messages, the recipient (to) is the other person
    if (msg.direction === "outbound" && parsed.to) {
      const toList = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
      toList.forEach((p: string) => {
        if (p && p !== "me" && p !== "unknown") participants.add(p);
      });
    }
  }

  return Array.from(participants);
}

// ============================================
// THREAD KEY GENERATION
// ============================================

/**
 * Normalize phone number for thread key generation.
 * Returns last 10 digits for consistent grouping.
 *
 * @param phone - Phone number string
 * @returns Normalized phone (last 10 digits)
 */
function normalizeForThreadKey(phone: string): string {
  return getTrailingDigits(phone, 10);
}

/**
 * Get a unique key for grouping messages into threads.
 * Uses thread_id if available, otherwise computes from participants.
 *
 * @param msg - Message to get thread key for
 * @returns Unique thread key string
 */
export function getThreadKey(msg: MessageLike): string {
  // Use thread_id if available
  if (msg.thread_id) return msg.thread_id;

  // Fallback: compute from participants
  const parsed = parseParticipants(msg);
  if (parsed) {
    const allParticipants = new Set<string>();

    if (parsed.from) {
      allParticipants.add(normalizeForThreadKey(parsed.from));
    }

    if (parsed.to) {
      const toList = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
      toList.forEach((p: string) =>
        allParticipants.add(normalizeForThreadKey(p))
      );
    }

    if (allParticipants.size > 0) {
      return "participants-" + Array.from(allParticipants).sort().join("-");
    }
  }

  // Last resort: use message id
  return "msg-" + msg.id;
}

// ============================================
// GROUP CHAT DETECTION
// ============================================

/**
 * Check if a thread is a group chat (has multiple unique external participants).
 * Uses chat_members (authoritative) when available, falls back to from/to parsing.
 *
 * @param messages - Messages in the thread
 * @param contactNames - Optional map of phone -> name for deduplication
 * @returns true if this is a group chat (>1 unique external participant)
 */
export function isGroupChat(
  messages: MessageLike[],
  contactNames: Record<string, string> = {}
): boolean {
  // First check for chat_members (authoritative source)
  for (const msg of messages) {
    const parsed = parseParticipants(msg);
    if (!parsed) continue;

    // chat_members is the authoritative list from Apple's chat_handle_join
    if (parsed.chat_members && Array.isArray(parsed.chat_members)) {
      // chat_members doesn't include "me", so 2+ members means group chat (3+ total with user)
      return parsed.chat_members.length >= 2;
    }
  }

  // Fallback: extract from from/to and resolve names
  const participants = getThreadParticipants(messages);

  // If we have contact names, resolve and deduplicate
  if (Object.keys(contactNames).length > 0) {
    const resolvedNames = new Set<string>();

    for (const p of participants) {
      const name = resolveContactName(p, contactNames);
      if (name) {
        resolvedNames.add(name);
      } else {
        // No name found, use normalized phone as unique identifier
        resolvedNames.add(p);
      }
    }

    return resolvedNames.size > 1;
  }

  // No contact names available - check by normalized phone count
  const normalizedParticipants = new Set<string>();
  for (const p of participants) {
    const normalized = normalizeForThreadKey(p);
    // Skip empty/invalid
    if (normalized && p.toLowerCase() !== "unknown") {
      normalizedParticipants.add(normalized);
    }
  }

  // Group chat if more than 2 unique normalized participants
  // (original logic from folderExportService used >2 for from/to fallback)
  return normalizedParticipants.size > 2;
}

// ============================================
// THREAD CONTACT EXTRACTION
// ============================================

/**
 * Extract the primary phone/contact from a thread.
 * For display purposes - shows who the conversation is "with".
 *
 * @param messages - Messages in the thread
 * @param phoneNameMap - Map of phone -> name
 * @returns Object with phone and optional name
 */
export function getThreadContact(
  messages: MessageLike[],
  phoneNameMap: Record<string, string>
): { phone: string; name: string | null } {
  for (const msg of messages) {
    const parsed = parseParticipants(msg);

    if (parsed) {
      let phone: string | null = null;

      if (msg.direction === "inbound" && parsed.from) {
        phone = parsed.from;
      } else if (msg.direction === "outbound" && parsed.to) {
        const toValue = parsed.to;
        phone = Array.isArray(toValue) ? toValue[0] : toValue;
      }

      if (phone) {
        const name = resolveContactName(phone, phoneNameMap);
        return { phone, name };
      }
    }

    // Fallback to sender field (check regardless of participants)
    if (msg.sender) {
      const name = resolveContactName(msg.sender, phoneNameMap);
      return { phone: msg.sender, name };
    }
  }

  return { phone: "Unknown", name: null };
}

// ============================================
// PARTICIPANT NAME FORMATTING
// ============================================

/**
 * Format participant names for display.
 * Uses contactNames map to resolve phone numbers to names.
 *
 * @param participants - Array of participant identifiers
 * @param contactNames - Map of phone -> name
 * @param maxShow - Maximum names to show before "+N more" (default: 3)
 * @returns Formatted string like "John, Jane +2 more"
 */
export function formatParticipantNames(
  participants: string[],
  contactNames: Record<string, string>,
  maxShow: number = 3
): string {
  const names = participants.map((p) => {
    const name = resolveContactName(p, contactNames);
    return name || p;
  });

  // Deduplicate names (same contact may have multiple phone numbers)
  const uniqueNames = [...new Set(names)];

  if (uniqueNames.length <= maxShow) {
    return uniqueNames.join(", ");
  }

  return `${uniqueNames.slice(0, maxShow).join(", ")} +${uniqueNames.length - maxShow} more`;
}
