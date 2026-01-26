import {
  validateFields,
  isValidField,
  getValidFields,
  TABLE_FIELDS,
  ValidatableTable,
} from "../sqlFieldWhitelist";

describe("sqlFieldWhitelist", () => {
  describe("TABLE_FIELDS", () => {
    it("should define fields for all expected tables", () => {
      const expectedTables: ValidatableTable[] = [
        "users_local",
        "oauth_tokens",
        "contacts",
        "transactions",
        "communications",
        "transaction_contacts",
      ];

      expectedTables.forEach((table) => {
        expect(TABLE_FIELDS[table]).toBeDefined();
        expect(TABLE_FIELDS[table]).toBeInstanceOf(Set);
        expect(TABLE_FIELDS[table].size).toBeGreaterThan(0);
      });
    });

    it("should include common fields for all tables", () => {
      // All tables should have id and created_at
      const tables: ValidatableTable[] = [
        "users_local",
        "oauth_tokens",
        "contacts",
        "transactions",
        "communications",
        "transaction_contacts",
      ];

      tables.forEach((table) => {
        expect(TABLE_FIELDS[table].has("id")).toBe(true);
        expect(TABLE_FIELDS[table].has("created_at")).toBe(true);
      });
    });
  });

  describe("validateFields", () => {
    describe("users_local table", () => {
      it("should accept valid user fields", () => {
        expect(() => {
          validateFields("users_local", [
            "email = ?",
            "first_name = ?",
            "last_name = ?",
          ]);
        }).not.toThrow();
      });

      it("should accept valid user fields without = ? suffix", () => {
        expect(() => {
          validateFields("users_local", ["email", "display_name", "avatar_url"]);
        }).not.toThrow();
      });

      it("should reject invalid user fields", () => {
        expect(() => {
          validateFields("users_local", ["email = ?", "hacker_field = ?"]);
        }).toThrow('Invalid field "hacker_field" for table "users_local"');
      });

      it("should reject SQL injection attempts", () => {
        expect(() => {
          validateFields("users_local", ["email; DROP TABLE users_local;--"]);
        }).toThrow();
      });
    });

    describe("oauth_tokens table", () => {
      it("should accept valid oauth token fields", () => {
        expect(() => {
          validateFields("oauth_tokens", [
            "access_token = ?",
            "refresh_token = ?",
            "token_expires_at = ?",
          ]);
        }).not.toThrow();
      });

      it("should reject invalid oauth token fields", () => {
        expect(() => {
          validateFields("oauth_tokens", ["access_token = ?", "malicious_field = ?"]);
        }).toThrow('Invalid field "malicious_field" for table "oauth_tokens"');
      });
    });

    describe("contacts table", () => {
      it("should accept valid contact fields", () => {
        expect(() => {
          validateFields("contacts", [
            "display_name = ?",
            "company = ?",
            "title = ?",
          ]);
        }).not.toThrow();
      });

      it("should reject invalid contact fields", () => {
        expect(() => {
          validateFields("contacts", ["display_name = ?", "password = ?"]);
        }).toThrow('Invalid field "password" for table "contacts"');
      });
    });

    describe("transactions table", () => {
      it("should accept valid transaction fields", () => {
        expect(() => {
          validateFields("transactions", [
            "property_address = ?",
            "status = ?",
            "closing_deadline = ?",
          ]);
        }).not.toThrow();
      });

      it("should accept AI detection fields", () => {
        expect(() => {
          validateFields("transactions", [
            "detection_source = ?",
            "detection_status = ?",
            "detection_confidence = ?",
            "detection_method = ?",
          ]);
        }).not.toThrow();
      });

      it("should reject invalid transaction fields", () => {
        expect(() => {
          validateFields("transactions", ["property_address = ?", "admin_override = ?"]);
        }).toThrow('Invalid field "admin_override" for table "transactions"');
      });
    });

    describe("communications table", () => {
      // BACKLOG-506: Communications is now a clean junction table.
      // Content fields (subject, body, etc.) have been moved to messages table.
      it("should accept valid communication fields (junction table)", () => {
        expect(() => {
          validateFields("communications", [
            "transaction_id = ?",
            "message_id = ?",
            "thread_id = ?",
            "link_source = ?",
          ]);
        }).not.toThrow();
      });

      it("should reject invalid communication fields", () => {
        expect(() => {
          validateFields("communications", ["message_id = ?", "internal_notes = ?"]);
        }).toThrow('Invalid field "internal_notes" for table "communications"');
      });

      it("should reject legacy content fields that were moved to messages table", () => {
        // These fields no longer exist in the communications table
        expect(() => {
          validateFields("communications", ["subject = ?"]);
        }).toThrow('Invalid field "subject" for table "communications"');
      });
    });

    describe("transaction_contacts table", () => {
      it("should accept valid transaction_contacts fields", () => {
        expect(() => {
          validateFields("transaction_contacts", [
            "role = ?",
            "role_category = ?",
            "specific_role = ?",
            "is_primary = ?",
          ]);
        }).not.toThrow();
      });

      it("should reject invalid transaction_contacts fields", () => {
        expect(() => {
          validateFields("transaction_contacts", ["role = ?", "secret_flag = ?"]);
        }).toThrow('Invalid field "secret_flag" for table "transaction_contacts"');
      });
    });

    describe("edge cases", () => {
      it("should handle empty fields array", () => {
        expect(() => {
          validateFields("contacts", []);
        }).not.toThrow();
      });

      it("should handle fields with extra whitespace", () => {
        expect(() => {
          validateFields("contacts", ["  display_name  = ?", "company=?"]);
        }).not.toThrow();
      });

      it("should reject fields that look like SQL injection", () => {
        const injectionAttempts = [
          "id OR 1=1",
          "id; DELETE FROM contacts",
          "id/**/",
          "id'--",
          "id UNION SELECT",
        ];

        injectionAttempts.forEach((attempt) => {
          expect(() => {
            validateFields("contacts", [attempt]);
          }).toThrow();
        });
      });

      it("should reject fields with special characters", () => {
        expect(() => {
          validateFields("contacts", ["display-name = ?"]);
        }).toThrow();
      });
    });
  });

  describe("isValidField", () => {
    it("should return true for valid fields", () => {
      expect(isValidField("contacts", "display_name")).toBe(true);
      expect(isValidField("contacts", "company")).toBe(true);
      expect(isValidField("transactions", "property_address")).toBe(true);
    });

    it("should return false for invalid fields", () => {
      expect(isValidField("contacts", "password")).toBe(false);
      expect(isValidField("contacts", "hacker_field")).toBe(false);
      expect(isValidField("transactions", "admin_override")).toBe(false);
    });
  });

  describe("getValidFields", () => {
    it("should return array of valid fields for each table", () => {
      const contactFields = getValidFields("contacts");
      expect(Array.isArray(contactFields)).toBe(true);
      expect(contactFields).toContain("display_name");
      expect(contactFields).toContain("company");
      expect(contactFields).toContain("title");
    });

    it("should return all fields defined in TABLE_FIELDS", () => {
      const tables: ValidatableTable[] = [
        "users_local",
        "oauth_tokens",
        "contacts",
        "transactions",
        "communications",
        "transaction_contacts",
      ];

      tables.forEach((table) => {
        const fields = getValidFields(table);
        expect(fields.length).toBe(TABLE_FIELDS[table].size);
      });
    });
  });
});
