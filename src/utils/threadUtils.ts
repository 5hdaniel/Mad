/**
 * Thread Utilities (Frontend)
 *
 * Pure utility functions for thread grouping and participant handling.
 * No Node.js or Electron dependencies - safe for browser use.
 */

import { getTrailingDigits } from "./phoneUtils";
import { resolveContactName } from "./contactUtils";

// ============================================
// TYPES
// ============================================

export interface ParsedParticipants {
  from?: string;
  to?: string | string[];
  chat_members?: string[];
}

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
 */
export function getThreadParticipants(messages: MessageLike[]): string[] {
  const participants = new Set<string>();

  for (const msg of messages) {
    const parsed = parseParticipants(msg);
    if (!parsed) continue;

    if (parsed.chat_members && Array.isArray(parsed.chat_members)) {
      parsed.chat_members.forEach((m: string) => {
        if (m && m !== "unknown") participants.add(m);
      });
    }

    if (msg.direction === "inbound" && parsed.from) {
      if (parsed.from !== "me" && parsed.from !== "unknown") {
        participants.add(parsed.from);
      }
    }

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

function normalizeForThreadKey(phone: string): string {
  return getTrailingDigits(phone, 10);
}

/**
 * Get a unique key for grouping messages into threads.
 */
export function getThreadKey(msg: MessageLike): string {
  if (msg.thread_id) return msg.thread_id;

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

  return "msg-" + msg.id;
}

// ============================================
// GROUP CHAT DETECTION
// ============================================

/**
 * Check if a thread is a group chat.
 */
export function isGroupChat(
  messages: MessageLike[],
  contactNames: Record<string, string> = {}
): boolean {
  for (const msg of messages) {
    const parsed = parseParticipants(msg);
    if (!parsed) continue;

    if (parsed.chat_members && Array.isArray(parsed.chat_members)) {
      return parsed.chat_members.length >= 2;
    }
  }

  const participants = getThreadParticipants(messages);

  if (Object.keys(contactNames).length > 0) {
    const resolvedNames = new Set<string>();

    for (const p of participants) {
      const name = resolveContactName(p, contactNames);
      if (name) {
        resolvedNames.add(name);
      } else {
        resolvedNames.add(p);
      }
    }

    return resolvedNames.size > 1;
  }

  const normalizedParticipants = new Set<string>();
  for (const p of participants) {
    const normalized = normalizeForThreadKey(p);
    if (normalized && p.toLowerCase() !== "unknown") {
      normalizedParticipants.add(normalized);
    }
  }

  return normalizedParticipants.size > 2;
}

// ============================================
// PARTICIPANT NAME FORMATTING
// ============================================

/**
 * Format participant names for display.
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

  const uniqueNames = [...new Set(names)];

  if (uniqueNames.length <= maxShow) {
    return uniqueNames.join(", ");
  }

  return `${uniqueNames.slice(0, maxShow).join(", ")} +${uniqueNames.length - maxShow} more`;
}
