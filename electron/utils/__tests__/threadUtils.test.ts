/**
 * Unit tests for Thread Utilities
 */

import {
  parseParticipants,
  getThreadParticipants,
  getThreadKey,
  isGroupChat,
  getThreadContact,
  formatParticipantNames,
  type MessageLike,
} from "../threadUtils";

describe("threadUtils", () => {
  describe("parseParticipants", () => {
    it("should return null for message without participants", () => {
      const msg: MessageLike = { id: "1" };
      expect(parseParticipants(msg)).toBeNull();
    });

    it("should return null for null participants", () => {
      const msg: MessageLike = { id: "1", participants: null };
      expect(parseParticipants(msg)).toBeNull();
    });

    it("should parse JSON string participants", () => {
      const msg: MessageLike = {
        id: "1",
        participants: JSON.stringify({ from: "+15551234567", to: ["+15559876543"] }),
      };
      const parsed = parseParticipants(msg);
      expect(parsed).toEqual({ from: "+15551234567", to: ["+15559876543"] });
    });

    it("should return object participants as-is", () => {
      const msg: MessageLike = {
        id: "1",
        participants: { from: "+15551234567", to: "+15559876543" },
      };
      const parsed = parseParticipants(msg);
      expect(parsed).toEqual({ from: "+15551234567", to: "+15559876543" });
    });

    it("should return null for invalid JSON", () => {
      const msg: MessageLike = {
        id: "1",
        participants: "not valid json",
      };
      expect(parseParticipants(msg)).toBeNull();
    });
  });

  describe("getThreadParticipants", () => {
    it("should return empty array for empty messages", () => {
      expect(getThreadParticipants([])).toEqual([]);
    });

    it("should collect participants from chat_members", () => {
      const messages: MessageLike[] = [
        {
          id: "1",
          direction: "inbound",
          participants: JSON.stringify({
            chat_members: ["+15551111111", "+15552222222"],
          }),
        },
      ];
      const participants = getThreadParticipants(messages);
      expect(participants).toContain("+15551111111");
      expect(participants).toContain("+15552222222");
    });

    it("should collect from field for inbound messages", () => {
      const messages: MessageLike[] = [
        {
          id: "1",
          direction: "inbound",
          participants: JSON.stringify({ from: "+15551234567" }),
        },
      ];
      const participants = getThreadParticipants(messages);
      expect(participants).toContain("+15551234567");
    });

    it("should collect to field for outbound messages", () => {
      const messages: MessageLike[] = [
        {
          id: "1",
          direction: "outbound",
          participants: JSON.stringify({ to: ["+15551234567", "+15559876543"] }),
        },
      ];
      const participants = getThreadParticipants(messages);
      expect(participants).toContain("+15551234567");
      expect(participants).toContain("+15559876543");
    });

    it("should handle single to value (not array)", () => {
      const messages: MessageLike[] = [
        {
          id: "1",
          direction: "outbound",
          participants: JSON.stringify({ to: "+15551234567" }),
        },
      ];
      const participants = getThreadParticipants(messages);
      expect(participants).toContain("+15551234567");
    });

    it("should exclude 'me' and 'unknown' participants", () => {
      const messages: MessageLike[] = [
        {
          id: "1",
          direction: "inbound",
          participants: JSON.stringify({
            from: "me",
            chat_members: ["unknown", "+15551234567"],
          }),
        },
      ];
      const participants = getThreadParticipants(messages);
      expect(participants).not.toContain("me");
      expect(participants).not.toContain("unknown");
      expect(participants).toContain("+15551234567");
    });

    it("should deduplicate participants across messages", () => {
      const messages: MessageLike[] = [
        {
          id: "1",
          direction: "inbound",
          participants: JSON.stringify({ from: "+15551234567" }),
        },
        {
          id: "2",
          direction: "outbound",
          participants: JSON.stringify({ to: ["+15551234567"] }),
        },
      ];
      const participants = getThreadParticipants(messages);
      expect(participants.filter((p) => p === "+15551234567")).toHaveLength(1);
    });
  });

  describe("getThreadKey", () => {
    it("should use thread_id if available", () => {
      const msg: MessageLike = {
        id: "1",
        thread_id: "thread-abc-123",
        participants: JSON.stringify({ from: "+15551234567" }),
      };
      expect(getThreadKey(msg)).toBe("thread-abc-123");
    });

    it("should compute key from participants if no thread_id", () => {
      const msg: MessageLike = {
        id: "1",
        participants: JSON.stringify({ from: "+15551234567", to: ["+15559876543"] }),
      };
      const key = getThreadKey(msg);
      expect(key).toMatch(/^participants-/);
      expect(key).toContain("5551234567");
      expect(key).toContain("5559876543");
    });

    it("should sort participants in key for consistency", () => {
      const msg1: MessageLike = {
        id: "1",
        participants: JSON.stringify({ from: "+15559999999", to: ["+15551111111"] }),
      };
      const msg2: MessageLike = {
        id: "2",
        participants: JSON.stringify({ from: "+15551111111", to: ["+15559999999"] }),
      };
      expect(getThreadKey(msg1)).toBe(getThreadKey(msg2));
    });

    it("should use message id as last resort", () => {
      const msg: MessageLike = { id: "msg-123" };
      expect(getThreadKey(msg)).toBe("msg-msg-123");
    });
  });

  describe("isGroupChat", () => {
    it("should return true when chat_members has 2+ members", () => {
      const messages: MessageLike[] = [
        {
          id: "1",
          participants: JSON.stringify({
            chat_members: ["+15551111111", "+15552222222"],
          }),
        },
      ];
      expect(isGroupChat(messages)).toBe(true);
    });

    it("should return false when chat_members has 1 member", () => {
      const messages: MessageLike[] = [
        {
          id: "1",
          participants: JSON.stringify({
            chat_members: ["+15551111111"],
          }),
        },
      ];
      expect(isGroupChat(messages)).toBe(false);
    });

    it("should fallback to from/to when no chat_members", () => {
      // Need messages from multiple directions to collect multiple participants
      const messages: MessageLike[] = [
        {
          id: "1",
          direction: "inbound",
          participants: JSON.stringify({
            from: "+15551111111",
          }),
        },
        {
          id: "2",
          direction: "inbound",
          participants: JSON.stringify({
            from: "+15552222222",
          }),
        },
        {
          id: "3",
          direction: "inbound",
          participants: JSON.stringify({
            from: "+15553333333",
          }),
        },
      ];
      // 3 unique inbound senders -> group chat (>2 participants)
      expect(isGroupChat(messages)).toBe(true);
    });

    it("should deduplicate by contact name when available", () => {
      const messages: MessageLike[] = [
        {
          id: "1",
          direction: "inbound",
          participants: JSON.stringify({
            from: "+15551111111",
          }),
        },
        {
          id: "2",
          direction: "outbound",
          participants: JSON.stringify({
            to: ["+15552222222"],
          }),
        },
      ];
      // Same person with two phone numbers
      const contactNames = {
        "5551111111": "John Doe",
        "5552222222": "John Doe",
      };
      // Only 1 unique contact name -> not group chat
      expect(isGroupChat(messages, contactNames)).toBe(false);
    });

    it("should return false for 1:1 conversation", () => {
      const messages: MessageLike[] = [
        {
          id: "1",
          direction: "inbound",
          participants: JSON.stringify({ from: "+15551234567" }),
        },
      ];
      expect(isGroupChat(messages)).toBe(false);
    });

    it("should return false for empty messages", () => {
      expect(isGroupChat([])).toBe(false);
    });
  });

  describe("getThreadContact", () => {
    const nameMap = {
      "5551234567": "John Doe",
    };

    it("should get from field for inbound messages", () => {
      const messages: MessageLike[] = [
        {
          id: "1",
          direction: "inbound",
          participants: JSON.stringify({ from: "+15551234567" }),
        },
      ];
      const result = getThreadContact(messages, nameMap);
      expect(result.phone).toBe("+15551234567");
      expect(result.name).toBe("John Doe");
    });

    it("should get to field for outbound messages", () => {
      const messages: MessageLike[] = [
        {
          id: "1",
          direction: "outbound",
          participants: JSON.stringify({ to: ["+15551234567"] }),
        },
      ];
      const result = getThreadContact(messages, nameMap);
      expect(result.phone).toBe("+15551234567");
      expect(result.name).toBe("John Doe");
    });

    it("should fallback to sender field", () => {
      const messages: MessageLike[] = [
        {
          id: "1",
          direction: "inbound",
          sender: "+15551234567",
        },
      ];
      const result = getThreadContact(messages, nameMap);
      expect(result.phone).toBe("+15551234567");
      expect(result.name).toBe("John Doe");
    });

    it("should return Unknown for empty messages", () => {
      const result = getThreadContact([], nameMap);
      expect(result.phone).toBe("Unknown");
      expect(result.name).toBeNull();
    });

    it("should return null name when contact not found", () => {
      const messages: MessageLike[] = [
        {
          id: "1",
          direction: "inbound",
          participants: JSON.stringify({ from: "+15559999999" }),
        },
      ];
      const result = getThreadContact(messages, nameMap);
      expect(result.phone).toBe("+15559999999");
      expect(result.name).toBeNull();
    });
  });

  describe("formatParticipantNames", () => {
    const contactNames = {
      "+15551111111": "Alice",
      "+15552222222": "Bob",
      "+15553333333": "Charlie",
      "+15554444444": "Diana",
    };

    it("should format single participant", () => {
      expect(formatParticipantNames(["+15551111111"], contactNames)).toBe(
        "Alice"
      );
    });

    it("should format multiple participants", () => {
      const result = formatParticipantNames(
        ["+15551111111", "+15552222222"],
        contactNames
      );
      expect(result).toBe("Alice, Bob");
    });

    it("should use phone when no name found", () => {
      const result = formatParticipantNames(
        ["+15551111111", "+15559999999"],
        contactNames
      );
      expect(result).toBe("Alice, +15559999999");
    });

    it("should truncate with +N more", () => {
      const participants = [
        "+15551111111",
        "+15552222222",
        "+15553333333",
        "+15554444444",
      ];
      const result = formatParticipantNames(participants, contactNames, 2);
      expect(result).toBe("Alice, Bob +2 more");
    });

    it("should deduplicate names", () => {
      // Same contact with two different phone formats
      const names = {
        "+15551111111": "Alice",
        "5551111111": "Alice",
      };
      const result = formatParticipantNames(
        ["+15551111111", "5551111111"],
        names
      );
      expect(result).toBe("Alice");
    });

    it("should handle empty participants", () => {
      expect(formatParticipantNames([], contactNames)).toBe("");
    });
  });
});
