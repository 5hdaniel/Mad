/**
 * Unit tests for Message Type Detector (TASK-1799)
 */

import { detectMessageType, isAudioMimeType } from "../messageTypeDetector";

describe("messageTypeDetector", () => {
  describe("detectMessageType", () => {
    describe("voice message detection", () => {
      it("should detect voice message when hasAudioTranscript is true", () => {
        expect(
          detectMessageType({
            text: "Hey, how are you?",
            hasAudioTranscript: true,
            attachmentCount: 1,
          })
        ).toBe("voice_message");
      });

      it("should detect voice message when attachment is audio/mpeg", () => {
        expect(
          detectMessageType({
            text: "",
            attachmentMimeType: "audio/mpeg",
            attachmentCount: 1,
          })
        ).toBe("voice_message");
      });

      it("should detect voice message when attachment is audio/mp4", () => {
        expect(
          detectMessageType({
            text: "",
            attachmentMimeType: "audio/mp4",
            attachmentCount: 1,
          })
        ).toBe("voice_message");
      });

      it("should detect voice message when attachment is audio/m4a", () => {
        expect(
          detectMessageType({
            text: "",
            attachmentMimeType: "audio/m4a",
            attachmentCount: 1,
          })
        ).toBe("voice_message");
      });

      it("should prioritize audio transcript over text content", () => {
        expect(
          detectMessageType({
            text: "This is a transcript of the voice message",
            hasAudioTranscript: true,
            attachmentMimeType: "audio/mpeg",
            attachmentCount: 1,
          })
        ).toBe("voice_message");
      });
    });

    describe("location detection", () => {
      it("should detect location when text contains 'started sharing location'", () => {
        expect(
          detectMessageType({
            text: "John started sharing location with you",
          })
        ).toBe("location");
      });

      it("should detect location when text contains 'stopped sharing location'", () => {
        expect(
          detectMessageType({
            text: "John stopped sharing location",
          })
        ).toBe("location");
      });

      it("should detect location when text contains 'shared a location'", () => {
        expect(
          detectMessageType({
            text: "Jane shared a location",
          })
        ).toBe("location");
      });

      it("should detect location when text contains 'shared location'", () => {
        expect(
          detectMessageType({
            text: "shared location",
          })
        ).toBe("location");
      });

      it("should detect location when text contains 'current location'", () => {
        expect(
          detectMessageType({
            text: "Here is my current location",
          })
        ).toBe("location");
      });

      it("should detect location when text contains maps.google.com URL", () => {
        expect(
          detectMessageType({
            text: "Check this out: https://maps.google.com/maps?q=...",
          })
        ).toBe("location");
      });

      it("should detect location when text contains maps.apple.com URL", () => {
        expect(
          detectMessageType({
            text: "I'm here: https://maps.apple.com/?ll=...",
          })
        ).toBe("location");
      });

      it("should detect location when text contains pin emoji", () => {
        expect(
          detectMessageType({
            text: "\u{1F4CD} Meet me here",
          })
        ).toBe("location");
      });

      it("should be case insensitive for location patterns", () => {
        expect(
          detectMessageType({
            text: "STARTED SHARING LOCATION",
          })
        ).toBe("location");
      });
    });

    describe("attachment only detection", () => {
      it("should detect attachment_only when has attachments but no text", () => {
        expect(
          detectMessageType({
            text: "",
            attachmentCount: 1,
          })
        ).toBe("attachment_only");
      });

      it("should detect attachment_only when has attachments and null text", () => {
        expect(
          detectMessageType({
            text: null,
            attachmentCount: 2,
          })
        ).toBe("attachment_only");
      });

      it("should detect attachment_only when has attachments and whitespace-only text", () => {
        expect(
          detectMessageType({
            text: "   \n\t  ",
            attachmentCount: 1,
          })
        ).toBe("attachment_only");
      });

      it("should NOT detect attachment_only when has text with attachments", () => {
        expect(
          detectMessageType({
            text: "Here's the document you asked for",
            attachmentCount: 1,
          })
        ).toBe("text");
      });
    });

    describe("system message detection", () => {
      it("should detect system message for 'You named the conversation'", () => {
        expect(
          detectMessageType({
            text: "You named the conversation 'Family Chat'",
          })
        ).toBe("system");
      });

      it("should detect system message for 'You set the group photo'", () => {
        expect(
          detectMessageType({
            text: "You set the group photo",
          })
        ).toBe("system");
      });

      it("should detect system message for 'changed the group'", () => {
        expect(
          detectMessageType({
            text: "John changed the group name",
          })
        ).toBe("system");
      });

      it("should detect system message for 'left the conversation'", () => {
        expect(
          detectMessageType({
            text: "Jane left the conversation",
          })
        ).toBe("system");
      });

      it("should detect system message for 'joined the conversation'", () => {
        expect(
          detectMessageType({
            text: "Mike joined the conversation",
          })
        ).toBe("system");
      });

      it("should detect system message for 'Message not delivered'", () => {
        expect(
          detectMessageType({
            text: "Message not delivered",
          })
        ).toBe("system");
      });
    });

    describe("text message detection", () => {
      it("should detect regular text messages", () => {
        expect(
          detectMessageType({
            text: "Hey! How's it going?",
          })
        ).toBe("text");
      });

      it("should detect text messages with emoji", () => {
        expect(
          detectMessageType({
            text: "Thanks! \u{1F600}",
          })
        ).toBe("text");
      });

      it("should detect text messages with long content", () => {
        expect(
          detectMessageType({
            text: "This is a longer message that contains multiple sentences. It talks about various things and includes some details about a meeting next week.",
          })
        ).toBe("text");
      });
    });

    describe("unknown type detection", () => {
      it("should return unknown for empty input", () => {
        expect(detectMessageType({})).toBe("unknown");
      });

      it("should return unknown for no text and no attachments", () => {
        expect(
          detectMessageType({
            text: "",
            attachmentCount: 0,
          })
        ).toBe("unknown");
      });

      it("should return unknown for null text and no attachments", () => {
        expect(
          detectMessageType({
            text: null,
            attachmentCount: 0,
          })
        ).toBe("unknown");
      });
    });

    describe("detection priority", () => {
      it("should prioritize voice message over location even if text matches location pattern", () => {
        // Edge case: voice message with transcript that mentions location
        expect(
          detectMessageType({
            text: "I started sharing location",
            hasAudioTranscript: true,
            attachmentMimeType: "audio/mpeg",
            attachmentCount: 1,
          })
        ).toBe("voice_message");
      });

      it("should prioritize location over attachment_only if location pattern matches", () => {
        expect(
          detectMessageType({
            text: "shared a location",
            attachmentCount: 1,
            attachmentMimeType: "image/jpeg",
          })
        ).toBe("location");
      });

      it("should prioritize system over text for system patterns", () => {
        expect(
          detectMessageType({
            text: "You named the conversation 'Work'",
            attachmentCount: 0,
          })
        ).toBe("system");
      });
    });
  });

  describe("isAudioMimeType", () => {
    it("should return true for audio/mpeg", () => {
      expect(isAudioMimeType("audio/mpeg")).toBe(true);
    });

    it("should return true for audio/mp4", () => {
      expect(isAudioMimeType("audio/mp4")).toBe(true);
    });

    it("should return true for audio/wav", () => {
      expect(isAudioMimeType("audio/wav")).toBe(true);
    });

    it("should return true for audio/m4a", () => {
      expect(isAudioMimeType("audio/m4a")).toBe(true);
    });

    it("should return false for video/mp4", () => {
      expect(isAudioMimeType("video/mp4")).toBe(false);
    });

    it("should return false for image/jpeg", () => {
      expect(isAudioMimeType("image/jpeg")).toBe(false);
    });

    it("should return false for application/pdf", () => {
      expect(isAudioMimeType("application/pdf")).toBe(false);
    });

    it("should return false for null", () => {
      expect(isAudioMimeType(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isAudioMimeType(undefined)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isAudioMimeType("")).toBe(false);
    });
  });
});
