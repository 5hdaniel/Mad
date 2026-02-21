import { isTextMessage, isEmailMessage } from "../channelHelpers";

describe("channelHelpers", () => {
  describe("isTextMessage", () => {
    // channel field (MessageChannel type)
    it('returns true for channel="sms"', () => {
      expect(isTextMessage({ channel: "sms" })).toBe(true);
    });

    it('returns true for channel="imessage"', () => {
      expect(isTextMessage({ channel: "imessage" })).toBe(true);
    });

    it('returns true for channel="text" (legacy value)', () => {
      expect(isTextMessage({ channel: "text" })).toBe(true);
    });

    it('returns false for channel="email"', () => {
      expect(isTextMessage({ channel: "email" })).toBe(false);
    });

    // communication_type field (legacy/API)
    it('returns true for communication_type="text"', () => {
      expect(isTextMessage({ communication_type: "text" })).toBe(true);
    });

    it('returns true for communication_type="imessage"', () => {
      expect(isTextMessage({ communication_type: "imessage" })).toBe(true);
    });

    it('returns true for communication_type="sms"', () => {
      expect(isTextMessage({ communication_type: "sms" })).toBe(true);
    });

    it('returns false for communication_type="email"', () => {
      expect(isTextMessage({ communication_type: "email" })).toBe(false);
    });

    // channel takes precedence over communication_type
    it("prefers channel over communication_type when both are present", () => {
      expect(
        isTextMessage({ channel: "sms", communication_type: "email" })
      ).toBe(true);
    });

    it("prefers channel over communication_type (email channel)", () => {
      expect(
        isTextMessage({ channel: "email", communication_type: "text" })
      ).toBe(false);
    });

    // Edge cases
    it("returns false when neither field is set", () => {
      expect(isTextMessage({})).toBe(false);
    });

    it("returns false for unknown channel value", () => {
      expect(isTextMessage({ channel: "unknown" })).toBe(false);
    });

    it("returns false for unknown communication_type value", () => {
      expect(isTextMessage({ communication_type: "fax" })).toBe(false);
    });
  });

  describe("isEmailMessage", () => {
    // channel field (MessageChannel type)
    it('returns true for channel="email"', () => {
      expect(isEmailMessage({ channel: "email" })).toBe(true);
    });

    it('returns false for channel="sms"', () => {
      expect(isEmailMessage({ channel: "sms" })).toBe(false);
    });

    it('returns false for channel="imessage"', () => {
      expect(isEmailMessage({ channel: "imessage" })).toBe(false);
    });

    // communication_type field (legacy/API)
    it('returns true for communication_type="email"', () => {
      expect(isEmailMessage({ communication_type: "email" })).toBe(true);
    });

    it('returns false for communication_type="text"', () => {
      expect(isEmailMessage({ communication_type: "text" })).toBe(false);
    });

    it('returns false for communication_type="imessage"', () => {
      expect(isEmailMessage({ communication_type: "imessage" })).toBe(false);
    });

    // channel takes precedence over communication_type
    it("prefers channel over communication_type when both are present", () => {
      expect(
        isEmailMessage({ channel: "email", communication_type: "text" })
      ).toBe(true);
    });

    it("prefers channel over communication_type (sms channel)", () => {
      expect(
        isEmailMessage({ channel: "sms", communication_type: "email" })
      ).toBe(false);
    });

    // Edge cases
    it("returns false when neither field is set", () => {
      expect(isEmailMessage({})).toBe(false);
    });

    it("returns false for unknown channel value", () => {
      expect(isEmailMessage({ channel: "unknown" })).toBe(false);
    });

    it("returns false for unknown communication_type value", () => {
      expect(isEmailMessage({ communication_type: "fax" })).toBe(false);
    });
  });
});
