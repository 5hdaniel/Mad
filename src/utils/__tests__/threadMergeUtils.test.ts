/**
 * Tests for threadMergeUtils
 * TASK-2025: Verifies display-layer thread merging for same-contact threads.
 */

import { mergeThreadsByContact, type MergedThreadEntry } from "../threadMergeUtils";
import type { MessageLike } from "../../components/transactionDetailsModule/components/MessageThreadCard";
import type { Communication } from "@/types";

/**
 * Helper to create a mock message
 */
function createMessage(overrides: Partial<Communication>): MessageLike {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    user_id: "user-1",
    channel: "sms",
    body_text: "Test message",
    sent_at: "2024-01-15T10:00:00Z",
    direction: "inbound",
    thread_id: "thread-1",
    participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
    has_attachments: false,
    is_false_positive: false,
    ...overrides,
  } as MessageLike;
}

describe("mergeThreadsByContact", () => {
  describe("basic merging", () => {
    it("should merge threads from the same contact (same phone, different service)", () => {
      // Thread 1: SMS from +14155550100
      const smsMessages = [
        createMessage({
          id: "sms-1",
          thread_id: "macos-chat-1",
          channel: "sms",
          sent_at: "2024-01-15T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        }),
      ];

      // Thread 2: iMessage from +14155550100
      const imessageMessages = [
        createMessage({
          id: "imsg-1",
          thread_id: "macos-chat-2",
          channel: "imessage",
          sent_at: "2024-01-16T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        }),
      ];

      const threads: [string, MessageLike[]][] = [
        ["macos-chat-1", smsMessages],
        ["macos-chat-2", imessageMessages],
      ];

      const contactNames: Record<string, string> = {
        "+14155550100": "Madison Jones",
      };

      const result = mergeThreadsByContact(threads, contactNames);

      // Should produce one merged thread
      expect(result).toHaveLength(1);
      expect(result[0][1]).toHaveLength(2); // 2 messages combined
      expect(result[0][2]).toEqual(["macos-chat-1", "macos-chat-2"]); // Both original IDs
    });

    it("should merge threads from same contact via phone and iCloud email", () => {
      // Thread 1: SMS from phone number
      const phoneMessages = [
        createMessage({
          id: "phone-1",
          thread_id: "macos-chat-1",
          channel: "sms",
          sent_at: "2024-01-15T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        }),
      ];

      // Thread 2: iMessage from iCloud email
      const emailMessages = [
        createMessage({
          id: "email-1",
          thread_id: "macos-chat-3",
          channel: "imessage",
          sent_at: "2024-01-17T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "madison@icloud.com", to: ["me"] }),
        }),
      ];

      const threads: [string, MessageLike[]][] = [
        ["macos-chat-1", phoneMessages],
        ["macos-chat-3", emailMessages],
      ];

      // Both phone and email resolve to same contact
      const contactNames: Record<string, string> = {
        "+14155550100": "Madison Jones",
        "madison@icloud.com": "Madison Jones",
      };

      const result = mergeThreadsByContact(threads, contactNames);

      // Should produce one merged thread
      expect(result).toHaveLength(1);
      expect(result[0][1]).toHaveLength(2);
      expect(result[0][2]).toEqual(["macos-chat-1", "macos-chat-3"]);
    });

    it("should NOT merge threads from different contacts", () => {
      const thread1 = [
        createMessage({
          id: "msg-1",
          thread_id: "macos-chat-1",
          sent_at: "2024-01-15T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        }),
      ];

      const thread2 = [
        createMessage({
          id: "msg-2",
          thread_id: "macos-chat-2",
          sent_at: "2024-01-16T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "+14155550200", to: ["me"] }),
        }),
      ];

      const threads: [string, MessageLike[]][] = [
        ["macos-chat-1", thread1],
        ["macos-chat-2", thread2],
      ];

      const contactNames: Record<string, string> = {
        "+14155550100": "Madison Jones",
        "+14155550200": "Jane Smith",
      };

      const result = mergeThreadsByContact(threads, contactNames);

      // Should produce two separate threads
      expect(result).toHaveLength(2);
    });
  });

  describe("group chat exclusion", () => {
    it("should NOT merge group chats", () => {
      const groupMessages = [
        createMessage({
          id: "group-1",
          thread_id: "macos-chat-group",
          sent_at: "2024-01-15T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({
            from: "+14155550100",
            to: ["me"],
            chat_members: ["+14155550100", "+14155550200"],
          }),
        }),
      ];

      const singleMessages = [
        createMessage({
          id: "single-1",
          thread_id: "macos-chat-single",
          sent_at: "2024-01-16T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        }),
      ];

      const threads: [string, MessageLike[]][] = [
        ["macos-chat-group", groupMessages],
        ["macos-chat-single", singleMessages],
      ];

      const contactNames: Record<string, string> = {
        "+14155550100": "Madison Jones",
        "+14155550200": "Jane Smith",
      };

      const result = mergeThreadsByContact(threads, contactNames);

      // Group chat should remain separate, single thread stays as-is
      expect(result).toHaveLength(2);
    });
  });

  describe("chronological ordering", () => {
    it("should sort merged messages by date (newest first)", () => {
      const smsMessages = [
        createMessage({
          id: "sms-1",
          thread_id: "macos-chat-1",
          sent_at: "2024-01-15T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        }),
        createMessage({
          id: "sms-2",
          thread_id: "macos-chat-1",
          sent_at: "2024-01-17T10:00:00Z",
          direction: "outbound",
          participants: JSON.stringify({ from: "me", to: ["+14155550100"] }),
        }),
      ];

      const imessageMessages = [
        createMessage({
          id: "imsg-1",
          thread_id: "macos-chat-2",
          sent_at: "2024-01-16T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        }),
      ];

      const threads: [string, MessageLike[]][] = [
        ["macos-chat-1", smsMessages],
        ["macos-chat-2", imessageMessages],
      ];

      const contactNames: Record<string, string> = {
        "+14155550100": "Madison Jones",
      };

      const result = mergeThreadsByContact(threads, contactNames);

      expect(result).toHaveLength(1);
      expect(result[0][1]).toHaveLength(3);

      // Messages should be sorted newest first
      const dates = result[0][1].map((m) => m.sent_at);
      expect(dates).toEqual([
        "2024-01-17T10:00:00Z",
        "2024-01-16T10:00:00Z",
        "2024-01-15T10:00:00Z",
      ]);
    });
  });

  describe("edge cases", () => {
    it("should handle empty thread list", () => {
      const result = mergeThreadsByContact([], {});
      expect(result).toHaveLength(0);
    });

    it("should handle threads with no contact name resolution", () => {
      const messages = [
        createMessage({
          id: "msg-1",
          thread_id: "macos-chat-1",
          sent_at: "2024-01-15T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        }),
      ];

      const threads: [string, MessageLike[]][] = [
        ["macos-chat-1", messages],
      ];

      // No contact names -- should still produce output (unmerged)
      const result = mergeThreadsByContact(threads, {});

      expect(result).toHaveLength(1);
      expect(result[0][2]).toEqual(["macos-chat-1"]);
    });

    it("should merge by normalized phone when no contact name exists", () => {
      // Same phone number, different formats
      const thread1 = [
        createMessage({
          id: "msg-1",
          thread_id: "macos-chat-1",
          sent_at: "2024-01-15T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        }),
      ];

      const thread2 = [
        createMessage({
          id: "msg-2",
          thread_id: "macos-chat-2",
          sent_at: "2024-01-16T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "4155550100", to: ["me"] }),
        }),
      ];

      const threads: [string, MessageLike[]][] = [
        ["macos-chat-1", thread1],
        ["macos-chat-2", thread2],
      ];

      // No contact names -- but same normalized phone
      const result = mergeThreadsByContact(threads, {});

      // Should merge because the normalized phone numbers match
      expect(result).toHaveLength(1);
      expect(result[0][1]).toHaveLength(2);
    });

    it("should leave single-thread contacts unaffected", () => {
      const messages = [
        createMessage({
          id: "msg-1",
          thread_id: "macos-chat-1",
          sent_at: "2024-01-15T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        }),
        createMessage({
          id: "msg-2",
          thread_id: "macos-chat-1",
          sent_at: "2024-01-16T10:00:00Z",
          direction: "outbound",
          participants: JSON.stringify({ from: "me", to: ["+14155550100"] }),
        }),
      ];

      const threads: [string, MessageLike[]][] = [
        ["macos-chat-1", messages],
      ];

      const contactNames: Record<string, string> = {
        "+14155550100": "Madison Jones",
      };

      const result = mergeThreadsByContact(threads, contactNames);

      expect(result).toHaveLength(1);
      expect(result[0][1]).toHaveLength(2);
      expect(result[0][2]).toEqual(["macos-chat-1"]); // Only one original ID
    });

    it("should correctly handle email-handle threads without contact names", () => {
      // With the bug, normalizePhone("madison@icloud.com") returns "" (empty)
      // which would cause all email-handle threads to merge incorrectly.
      // With the fix, email handles are preserved as-is (lowercased).
      const emailThread1 = [
        createMessage({
          id: "email-1",
          thread_id: "macos-chat-1",
          sent_at: "2024-01-15T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "madison@icloud.com", to: ["me"] }),
        }),
      ];

      const emailThread2 = [
        createMessage({
          id: "email-2",
          thread_id: "macos-chat-2",
          sent_at: "2024-01-16T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "jane@gmail.com", to: ["me"] }),
        }),
      ];

      const threads: [string, MessageLike[]][] = [
        ["macos-chat-1", emailThread1],
        ["macos-chat-2", emailThread2],
      ];

      // No contact names -- relies on normalizePhone for merge key
      const result = mergeThreadsByContact(threads, {});

      // Should remain as 2 separate threads (different email handles)
      expect(result).toHaveLength(2);
    });

    it("should merge email-handle threads from the same email (case-insensitive)", () => {
      const emailThread1 = [
        createMessage({
          id: "email-1",
          thread_id: "macos-chat-1",
          sent_at: "2024-01-15T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "Madison@iCloud.com", to: ["me"] }),
        }),
      ];

      const emailThread2 = [
        createMessage({
          id: "email-2",
          thread_id: "macos-chat-2",
          sent_at: "2024-01-16T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "madison@icloud.com", to: ["me"] }),
        }),
      ];

      const threads: [string, MessageLike[]][] = [
        ["macos-chat-1", emailThread1],
        ["macos-chat-2", emailThread2],
      ];

      // No contact names -- should merge via handle: key (lowercased email)
      const result = mergeThreadsByContact(threads, {});

      // Should merge into 1 thread (same email after lowercasing)
      expect(result).toHaveLength(1);
      expect(result[0][1]).toHaveLength(2);
    });

    it("should handle messages without participants gracefully", () => {
      const messages = [
        createMessage({
          id: "msg-1",
          thread_id: "macos-chat-1",
          sent_at: "2024-01-15T10:00:00Z",
          participants: undefined,
        }),
      ];

      const threads: [string, MessageLike[]][] = [
        ["macos-chat-1", messages],
      ];

      // Should not crash, thread should pass through unmergeable
      const result = mergeThreadsByContact(threads, {});
      expect(result).toHaveLength(1);
    });

    it("should merge three threads from the same contact", () => {
      const smsThread = [
        createMessage({
          id: "sms-1",
          thread_id: "macos-chat-1",
          channel: "sms",
          sent_at: "2024-01-15T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        }),
      ];

      const imessagePhoneThread = [
        createMessage({
          id: "imsg-1",
          thread_id: "macos-chat-2",
          channel: "imessage",
          sent_at: "2024-01-16T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        }),
      ];

      const imessageEmailThread = [
        createMessage({
          id: "imsg-email-1",
          thread_id: "macos-chat-3",
          channel: "imessage",
          sent_at: "2024-01-17T10:00:00Z",
          direction: "inbound",
          participants: JSON.stringify({ from: "madison@icloud.com", to: ["me"] }),
        }),
      ];

      const threads: [string, MessageLike[]][] = [
        ["macos-chat-1", smsThread],
        ["macos-chat-2", imessagePhoneThread],
        ["macos-chat-3", imessageEmailThread],
      ];

      const contactNames: Record<string, string> = {
        "+14155550100": "Madison Jones",
        "madison@icloud.com": "Madison Jones",
      };

      const result = mergeThreadsByContact(threads, contactNames);

      // All three should merge into one
      expect(result).toHaveLength(1);
      expect(result[0][1]).toHaveLength(3);
      expect(result[0][2]).toEqual(["macos-chat-1", "macos-chat-2", "macos-chat-3"]);
    });
  });
});
