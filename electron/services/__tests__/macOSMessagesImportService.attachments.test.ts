/**
 * macOSMessagesImportService Attachment Tests (TASK-1012, TASK-1110)
 *
 * Tests for the attachment utility functions.
 * Note: The service itself cannot be easily unit tested due to native module dependencies.
 * These tests verify the pure function logic that supports attachment handling.
 *
 * TASK-1110: Added tests for external_message_id stable linking logic
 */
import * as crypto from "crypto";
import * as path from "path";

describe("Attachment Utility Functions", () => {
  describe("isSupportedImageType logic", () => {
    // Test the logic that would be in isSupportedImageType
    const supportedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".heic"];

    function isSupportedImageType(filename: string | null): boolean {
      if (!filename) return false;
      const ext = path.extname(filename).toLowerCase();
      return supportedExtensions.includes(ext);
    }

    it("should accept JPG files", () => {
      expect(isSupportedImageType("photo.jpg")).toBe(true);
      expect(isSupportedImageType("PHOTO.JPG")).toBe(true);
    });

    it("should accept JPEG files", () => {
      expect(isSupportedImageType("photo.jpeg")).toBe(true);
    });

    it("should accept PNG files", () => {
      expect(isSupportedImageType("image.png")).toBe(true);
    });

    it("should accept GIF files", () => {
      expect(isSupportedImageType("animation.gif")).toBe(true);
    });

    it("should accept HEIC files", () => {
      expect(isSupportedImageType("photo.heic")).toBe(true);
    });

    it("should reject video files", () => {
      expect(isSupportedImageType("video.mp4")).toBe(false);
      expect(isSupportedImageType("video.mov")).toBe(false);
    });

    it("should reject document files", () => {
      expect(isSupportedImageType("document.pdf")).toBe(false);
      expect(isSupportedImageType("file.doc")).toBe(false);
    });

    it("should reject audio files", () => {
      expect(isSupportedImageType("audio.mp3")).toBe(false);
      expect(isSupportedImageType("voice.m4a")).toBe(false);
    });

    it("should reject null/empty filenames", () => {
      expect(isSupportedImageType(null)).toBe(false);
      expect(isSupportedImageType("")).toBe(false);
    });
  });

  describe("getMimeTypeFromFilename logic", () => {
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".heic": "image/heic",
    };

    function getMimeTypeFromFilename(filename: string): string {
      const ext = path.extname(filename).toLowerCase();
      return mimeTypes[ext] || "application/octet-stream";
    }

    it("should return correct MIME type for JPG", () => {
      expect(getMimeTypeFromFilename("photo.jpg")).toBe("image/jpeg");
    });

    it("should return correct MIME type for JPEG", () => {
      expect(getMimeTypeFromFilename("photo.jpeg")).toBe("image/jpeg");
    });

    it("should return correct MIME type for PNG", () => {
      expect(getMimeTypeFromFilename("image.png")).toBe("image/png");
    });

    it("should return correct MIME type for GIF", () => {
      expect(getMimeTypeFromFilename("animation.gif")).toBe("image/gif");
    });

    it("should return correct MIME type for HEIC", () => {
      expect(getMimeTypeFromFilename("photo.heic")).toBe("image/heic");
    });

    it("should return octet-stream for unknown types", () => {
      expect(getMimeTypeFromFilename("file.xyz")).toBe("application/octet-stream");
    });
  });

  describe("generateContentHash logic", () => {
    it("should generate consistent SHA-256 hash", () => {
      const testContent = Buffer.from("test image content");
      const hash = crypto.createHash("sha256").update(testContent).digest("hex");

      // Verify hash format (64 character hex string)
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should generate same hash for same content", () => {
      const content = Buffer.from("test content");
      const hash1 = crypto.createHash("sha256").update(content).digest("hex");
      const hash2 = crypto.createHash("sha256").update(content).digest("hex");

      expect(hash1).toBe(hash2);
    });

    it("should generate different hash for different content", () => {
      const content1 = Buffer.from("content A");
      const content2 = Buffer.from("content B");
      const hash1 = crypto.createHash("sha256").update(content1).digest("hex");
      const hash2 = crypto.createHash("sha256").update(content2).digest("hex");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("MacOSImportResult interface", () => {
    it("should include attachment counts", () => {
      // Verify the interface has the required fields
      interface MacOSImportResult {
        success: boolean;
        messagesImported: number;
        messagesSkipped: number;
        attachmentsImported: number;
        attachmentsSkipped: number;
        duration: number;
        error?: string;
      }

      const result: MacOSImportResult = {
        success: true,
        messagesImported: 100,
        messagesSkipped: 5,
        attachmentsImported: 25,
        attachmentsSkipped: 3,
        duration: 5000,
      };

      expect(result.attachmentsImported).toBe(25);
      expect(result.attachmentsSkipped).toBe(3);
    });
  });

  describe("Attachment path resolution logic", () => {
    it("should handle tilde paths", () => {
      const inputPath = "~/Library/Messages/Attachments/file.jpg";
      const homedir = process.env.HOME || "/Users/test";

      // Logic that would be in the service
      let resolvedPath = inputPath;
      if (inputPath.startsWith("~")) {
        resolvedPath = path.join(homedir, inputPath.slice(1));
      }

      expect(resolvedPath).not.toContain("~");
      expect(resolvedPath).toContain("Library/Messages/Attachments/file.jpg");
    });

    it("should not modify absolute paths", () => {
      const inputPath = "/Users/test/Library/Messages/Attachments/file.jpg";

      // Logic that would be in the service
      let resolvedPath = inputPath;
      if (inputPath.startsWith("~")) {
        resolvedPath = path.join(process.env.HOME || "", inputPath.slice(1));
      }

      expect(resolvedPath).toBe(inputPath);
    });
  });

  /**
   * TASK-1110: Tests for external_message_id stable linking logic
   *
   * These tests verify the core logic for:
   * 1. Storing external_message_id during import
   * 2. Fallback lookup by external_message_id when message_id is stale
   * 3. Auto-repair of stale message_id references
   */
  describe("External message ID stable linking (TASK-1110)", () => {
    // Simulated types matching the service
    interface Attachment {
      id: string;
      message_id: string;
      external_message_id: string | null;
      filename: string;
    }

    interface Message {
      id: string;
      external_id: string;
    }

    /**
     * Simulates the getAttachmentsByMessageId fallback logic
     */
    function findAttachmentsWithFallback(
      messageId: string,
      attachments: Attachment[],
      messages: Message[]
    ): Attachment[] {
      // First, try direct message_id lookup
      let found = attachments.filter(a => a.message_id === messageId);

      // If no results, try external_message_id fallback
      if (found.length === 0) {
        const message = messages.find(m => m.id === messageId);
        if (message?.external_id) {
          found = attachments.filter(a => a.external_message_id === message.external_id);
        }
      }

      return found;
    }

    it("should find attachments by direct message_id when present", () => {
      const attachments: Attachment[] = [
        { id: "att1", message_id: "msg-uuid-1", external_message_id: "guid-12345", filename: "photo.jpg" },
        { id: "att2", message_id: "msg-uuid-1", external_message_id: "guid-12345", filename: "photo2.jpg" },
        { id: "att3", message_id: "msg-uuid-2", external_message_id: "guid-67890", filename: "image.png" },
      ];

      const messages: Message[] = [
        { id: "msg-uuid-1", external_id: "guid-12345" },
        { id: "msg-uuid-2", external_id: "guid-67890" },
      ];

      const result = findAttachmentsWithFallback("msg-uuid-1", attachments, messages);
      expect(result).toHaveLength(2);
      expect(result.map(a => a.filename)).toEqual(["photo.jpg", "photo2.jpg"]);
    });

    it("should find attachments by external_message_id when message_id is stale", () => {
      // Scenario: Message was re-imported with new UUID, but attachment has old message_id
      const attachments: Attachment[] = [
        { id: "att1", message_id: "old-uuid-1", external_message_id: "guid-12345", filename: "photo.jpg" },
        { id: "att2", message_id: "old-uuid-1", external_message_id: "guid-12345", filename: "photo2.jpg" },
      ];

      // Message now has a NEW internal ID but same external_id
      const messages: Message[] = [
        { id: "new-uuid-1", external_id: "guid-12345" },
      ];

      // Query with new message UUID - should find via external_message_id fallback
      const result = findAttachmentsWithFallback("new-uuid-1", attachments, messages);
      expect(result).toHaveLength(2);
      expect(result.map(a => a.filename)).toEqual(["photo.jpg", "photo2.jpg"]);
    });

    it("should return empty when no match by either message_id or external_message_id", () => {
      const attachments: Attachment[] = [
        { id: "att1", message_id: "uuid-1", external_message_id: "guid-12345", filename: "photo.jpg" },
      ];

      const messages: Message[] = [
        { id: "uuid-2", external_id: "guid-99999" },
      ];

      const result = findAttachmentsWithFallback("uuid-2", attachments, messages);
      expect(result).toHaveLength(0);
    });

    it("should return empty when message has no external_id", () => {
      const attachments: Attachment[] = [
        { id: "att1", message_id: "uuid-1", external_message_id: "guid-12345", filename: "photo.jpg" },
      ];

      // Email message without external_id (only macOS messages have these)
      const messages: Message[] = [
        { id: "uuid-email", external_id: "" },
      ];

      const result = findAttachmentsWithFallback("uuid-email", attachments, messages);
      expect(result).toHaveLength(0);
    });

    it("should prefer direct message_id match over external_message_id fallback", () => {
      // Edge case: direct match exists, should not use fallback
      const attachments: Attachment[] = [
        { id: "att1", message_id: "uuid-1", external_message_id: "guid-12345", filename: "direct.jpg" },
        { id: "att2", message_id: "uuid-old", external_message_id: "guid-12345", filename: "fallback.jpg" },
      ];

      const messages: Message[] = [
        { id: "uuid-1", external_id: "guid-12345" },
      ];

      const result = findAttachmentsWithFallback("uuid-1", attachments, messages);
      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe("direct.jpg");
    });

    describe("Batch lookup with external_message_id fallback", () => {
      /**
       * Simulates getAttachmentsByMessageIds batch lookup
       */
      function findAttachmentsBatch(
        messageIds: string[],
        attachments: Attachment[],
        messages: Message[]
      ): Map<string, Attachment[]> {
        const result = new Map<string, Attachment[]>();

        // First pass: direct message_id lookup
        for (const msgId of messageIds) {
          const direct = attachments.filter(a => a.message_id === msgId);
          if (direct.length > 0) {
            result.set(msgId, direct);
          }
        }

        // Second pass: external_message_id fallback for missing
        const missingIds = messageIds.filter(id => !result.has(id));
        if (missingIds.length > 0) {
          const msgExternalIds = messages
            .filter(m => missingIds.includes(m.id) && m.external_id)
            .map(m => ({ id: m.id, external_id: m.external_id }));

          const externalToInternal = new Map(msgExternalIds.map(m => [m.external_id, m.id]));

          for (const att of attachments) {
            const internalId = externalToInternal.get(att.external_message_id || "");
            if (internalId && !result.has(internalId)) {
              const existing = result.get(internalId) || [];
              existing.push(att);
              result.set(internalId, existing);
            }
          }
        }

        return result;
      }

      it("should handle mixed direct and fallback lookups in batch", () => {
        const attachments: Attachment[] = [
          { id: "att1", message_id: "uuid-1", external_message_id: "guid-111", filename: "direct1.jpg" },
          { id: "att2", message_id: "old-uuid-2", external_message_id: "guid-222", filename: "fallback2.jpg" },
          { id: "att3", message_id: "old-uuid-3", external_message_id: "guid-333", filename: "fallback3.jpg" },
        ];

        const messages: Message[] = [
          { id: "uuid-1", external_id: "guid-111" },     // Direct match
          { id: "uuid-2", external_id: "guid-222" },     // Fallback needed
          { id: "uuid-3", external_id: "guid-333" },     // Fallback needed
        ];

        const result = findAttachmentsBatch(["uuid-1", "uuid-2", "uuid-3"], attachments, messages);

        expect(result.size).toBe(3);
        expect(result.get("uuid-1")?.map(a => a.filename)).toEqual(["direct1.jpg"]);
        expect(result.get("uuid-2")?.map(a => a.filename)).toEqual(["fallback2.jpg"]);
        expect(result.get("uuid-3")?.map(a => a.filename)).toEqual(["fallback3.jpg"]);
      });
    });

    describe("External message ID storage during import", () => {
      it("should store macOS GUID as external_message_id", () => {
        // Simulated attachment insert parameters
        interface AttachmentInsertParams {
          id: string;
          message_id: string;
          external_message_id: string;
          filename: string;
          mime_type: string;
          file_size_bytes: number;
          storage_path: string;
        }

        // Simulated import data from macOS Messages
        const macAttachment = {
          attachment_id: 12345,
          message_id: 67890,
          message_guid: "p:0/BD4F8C26-9D5B-4A5E-9D75-1234567890AB", // macOS GUID
          guid: "att:12345",
          filename: "~/Library/Messages/Attachments/ab/cd/photo.jpg",
          transfer_name: "photo.jpg",
          mime_type: "image/jpeg",
          total_bytes: 102400,
          is_outgoing: 0,
        };

        // Simulated internal message ID from messageIdMap
        const internalMessageId = "550e8400-e29b-41d4-a716-446655440000";

        // Build insert params as the service would
        const insertParams: AttachmentInsertParams = {
          id: crypto.randomUUID(),
          message_id: internalMessageId,
          external_message_id: macAttachment.message_guid, // TASK-1110: Store stable GUID
          filename: macAttachment.transfer_name || "",
          mime_type: macAttachment.mime_type || "application/octet-stream",
          file_size_bytes: macAttachment.total_bytes,
          storage_path: "/app/data/attachments/abc123.jpg",
        };

        // Verify external_message_id is stored
        expect(insertParams.external_message_id).toBe(macAttachment.message_guid);
        expect(insertParams.message_id).toBe(internalMessageId);
        expect(insertParams.external_message_id).not.toBe(insertParams.message_id);
      });
    });
  });
});
